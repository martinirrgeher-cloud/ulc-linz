import type { WorkbookSheet } from "@/features/data-import/types";

const UTF8 = new TextDecoder("utf-8");
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 200;
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_WORKBOOK_ROWS = 1_001;
const MAX_WORKBOOK_COLUMNS = 200;
const ALLOWED_XLSX_ENTRY = /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/;

function assertSheetLimits(name: string, rows: string[][]): void {
  if (rows.length > MAX_WORKBOOK_ROWS) {
    throw new Error(`Das Tabellenblatt „${name}“ enthält mehr als 1.000 Datenzeilen.`);
  }
  const columns = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (columns > MAX_WORKBOOK_COLUMNS) {
    throw new Error(`Das Tabellenblatt „${name}“ enthält zu viele Spalten.`);
  }
}


function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function xmlText(node: Element | null): string {
  return node?.textContent?.trim() ?? "";
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Dieser Browser kann Excel-Dateien nicht entpacken. Bitte einen aktuellen Browser verwenden.");
  }
  const StreamConstructor = DecompressionStream as unknown as new (format: string) => DecompressionStream;
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const stream = new Blob([payload]).stream().pipeThrough(new StreamConstructor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    if (view.getUint32(offset, true) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error("Die XLSX-Datei ist beschädigt oder kein gültiges Excel-Dokument.");

  const entries = view.getUint16(eocd + 10, true);
  if (entries > MAX_ZIP_ENTRIES) {
    throw new Error("Die XLSX-Datei enthält ungewöhnlich viele interne Dateien und wurde abgelehnt.");
  }

  let cursor = view.getUint32(eocd + 16, true);
  let totalUncompressed = 0;
  const result = new Map<string, Uint8Array>();

  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Die XLSX-Datei enthält ein ungültiges ZIP-Verzeichnis.");
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const entryEnd = cursor + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > bytes.length) throw new Error("Die XLSX-Datei ist unvollständig.");

    const fileName = UTF8.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("Die entpackten Excel-Daten überschreiten das Sicherheitslimit von 20 MB.");
    }

    if (ALLOWED_XLSX_ENTRY.test(fileName)) {
      if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error("Die XLSX-Datei enthält einen ungültigen ZIP-Eintrag.");
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error("Die XLSX-Datei enthält einen unvollständigen ZIP-Eintrag.");
      const compressed = bytes.slice(dataStart, dataEnd);
      let uncompressed: Uint8Array;
      if (method === 0) uncompressed = compressed;
      else if (method === 8) uncompressed = await inflateRaw(compressed);
      else throw new Error(`Nicht unterstützte Excel-Komprimierung (${method}).`);

      if (uncompressed.byteLength !== uncompressedSize) {
        throw new Error("Die Größe eines entpackten Excel-Eintrags ist ungültig.");
      }
      result.set(fileName, uncompressed);
    }

    cursor = entryEnd;
  }
  return result;
}

function parseXml(bytes: Uint8Array, label: string): XMLDocument {
  const document = new DOMParser().parseFromString(UTF8.decode(bytes), "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`${label} konnte nicht gelesen werden.`);
  return document;
}

function xlsxCellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute("t") ?? "";
  if (type === "inlineStr") return xmlText(cell.getElementsByTagNameNS("*", "t")[0] ?? null);
  const raw = xmlText(cell.getElementsByTagNameNS("*", "v")[0] ?? null);
  if (type === "s") return sharedStrings[Number.parseInt(raw, 10)] ?? "";
  if (type === "b") return raw === "1" ? "Ja" : "Nein";
  return raw;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<WorkbookSheet[]> {
  const entries = await unzipEntries(buffer);
  const workbookBytes = entries.get("xl/workbook.xml");
  const relBytes = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbookBytes || !relBytes) throw new Error("Die Excel-Arbeitsmappe ist unvollständig.");

  const workbook = parseXml(workbookBytes, "Die Arbeitsmappe");
  const relationships = parseXml(relBytes, "Die Arbeitsmappenbeziehungen");
  const targetById = new Map<string, string>();
  [...relationships.getElementsByTagNameNS("*", "Relationship")].forEach((relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) targetById.set(id, target.replace(/^\//, ""));
  });

  const sharedStrings: string[] = [];
  const sharedBytes = entries.get("xl/sharedStrings.xml");
  if (sharedBytes) {
    const shared = parseXml(sharedBytes, "Die Excel-Texte");
    [...shared.getElementsByTagNameNS("*", "si")].forEach((item) => {
      sharedStrings.push([...item.getElementsByTagNameNS("*", "t")].map((node) => node.textContent ?? "").join(""));
    });
  }

  const result: WorkbookSheet[] = [];
  [...workbook.getElementsByTagNameNS("*", "sheet")].forEach((sheet) => {
    const name = sheet.getAttribute("name") ?? "Tabelle";
    const relationId = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
      ?? sheet.getAttribute("r:id")
      ?? "";
    let target = targetById.get(relationId) ?? "";
    if (!target) return;
    target = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.\//, "")}`;
    const sheetBytes = entries.get(target);
    if (!sheetBytes) return;
    const document = parseXml(sheetBytes, `Das Tabellenblatt „${name}“`);
    const rows: string[][] = [];
    [...document.getElementsByTagNameNS("*", "row")].forEach((row) => {
      const values: string[] = [];
      [...row.getElementsByTagNameNS("*", "c")].forEach((cell) => {
        const index = columnIndex(cell.getAttribute("r") ?? "A1");
        while (values.length <= index) values.push("");
        values[index] = xlsxCellValue(cell, sharedStrings);
      });
      rows.push(values);
    });
    assertSheetLimits(name, rows);
    result.push({ name, rows });
  });
  return result;
}

function parseSpreadsheetXml(text: string): WorkbookSheet[] {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Die Excel-XML-Datei konnte nicht gelesen werden.");
  return [...document.getElementsByTagNameNS("*", "Worksheet")].map((worksheet) => {
    const name = worksheet.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Name")
      ?? worksheet.getAttribute("ss:Name")
      ?? "Tabelle";
    const rows = [...worksheet.getElementsByTagNameNS("*", "Row")].map((row) => {
      const values: string[] = [];
      [...row.children].filter((child) => child.localName === "Cell").forEach((cell) => {
        const explicitIndex = Number.parseInt(
          cell.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Index")
            ?? cell.getAttribute("ss:Index")
            ?? "0",
          10,
        );
        if (explicitIndex > 0) while (values.length < explicitIndex - 1) values.push("");
        values.push(xmlText(cell.getElementsByTagNameNS("*", "Data")[0] ?? null));
      });
      return values;
    });
    assertSheetLimits(name, rows);
    return { name, rows };
  });
}

export async function readExcelWorkbook(file: File): Promise<WorkbookSheet[]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("Die Importdatei ist größer als 5 MB.");
  }

  const fileName = file.name.trim().toLocaleLowerCase("de-AT");
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xml")) {
    throw new Error("Unterstützt werden ausschließlich XLSX- und Excel-XML-Dateien. Alte XLS-Dateien bitte zuerst als XLSX speichern.");
  }

  const buffer = await file.arrayBuffer();
  const textStart = UTF8.decode(new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 512))));
  if (textStart.includes("urn:schemas-microsoft-com:office:spreadsheet")) {
    return parseSpreadsheetXml(UTF8.decode(new Uint8Array(buffer)));
  }
  if (fileName.endsWith(".xml")) {
    throw new Error("Die XML-Datei ist keine unterstützte Excel-XML-Arbeitsmappe.");
  }
  return parseXlsx(buffer);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function downloadSpreadsheetXml(
  fileName: string,
  sheets: Array<{ name: string; rows: string[][]; widths?: number[] }>,
): void {
  const worksheets = sheets.map((sheet) => {
    const columns = (sheet.widths ?? []).map((width) => `<Column ss:Width="${width}"/>`).join("");
    const rows = sheet.rows.map((row, rowIndex) => (
      `<Row>${row.map((value) => `<Cell ss:StyleID="${rowIndex === 0 ? "Header" : "Cell"}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`
    )).join("");
    return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${columns}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
  }).join("");
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top"/><Font ss:FontName="Aptos" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#15803D" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style><Style ss:ID="Cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style></Styles>${worksheets}</Workbook>`;
  const url = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function workbookSheetRecords(
  sheets: WorkbookSheet[],
  name: string,
): Array<{ rowNumber: number; values: Record<string, string> }> {
  const sheet = sheets.find((candidate) => candidate.name.trim().toLocaleLowerCase("de") === name.toLocaleLowerCase("de"));
  if (!sheet || sheet.rows.length === 0) return [];
  const headerIndex = sheet.rows.findIndex((row) => row.some((cell) => cell.trim()));
  if (headerIndex < 0) return [];
  const headers = sheet.rows[headerIndex]!.map((header) => header.trim());
  return sheet.rows.slice(headerIndex + 1).flatMap((row, index) => {
    if (!row.some((cell) => cell.trim())) return [];
    const values: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) values[header] = row[column]?.trim() ?? "";
    });
    return [{ rowNumber: headerIndex + index + 2, values }];
  });
}

export type WorkbookListValidation = {
  range: string;
  definedName: string;
  errorMessage?: string;
};

export type DownloadWorkbookSheet = {
  name: string;
  rows: string[][];
  widths?: number[];
  hidden?: boolean;
  validations?: WorkbookListValidation[];
};

export type DownloadWorkbookDefinition = {
  sheets: DownloadWorkbookSheet[];
  definedNames?: Array<{ name: string; sheetName: string; range: string }>;
};

const ZIP_ENCODER = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.byteLength;
  });
  return result;
}

function zipStored(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const nameBytes = ZIP_ENCODER.encode(entry.name);
    const checksum = crc32(entry.data);
    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.byteLength, true);
    localView.setUint32(22, entry.data.byteLength, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.byteLength, true);
    centralView.setUint32(24, entry.data.byteLength, true);
    centralView.setUint16(28, nameBytes.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.byteLength + entry.data.byteLength;
  });

  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirectory.byteLength, true);
  eocdView.setUint32(16, localOffset, true);
  eocdView.setUint16(20, 0, true);
  return concatBytes([...localParts, centralDirectory, eocd]);
}

function excelColumn(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function sheetXml(sheet: DownloadWorkbookSheet): string {
  const rowXml = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndexValue) => {
      const reference = `${excelColumn(columnIndexValue)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const columns = (sheet.widths ?? []).map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${Math.max(6, width)}" customWidth="1"/>`
  )).join("");
  const validations = (sheet.validations ?? []).map((validation) => (
    `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Ungültige Auswahl" error="${escapeXml(validation.errorMessage ?? "Bitte einen Wert aus der Auswahlliste wählen.")}" sqref="${validation.range}"><formula1>${escapeXml(validation.definedName)}</formula1></dataValidation>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${excelColumn(maxColumns - 1)}${maxRows}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columns}</cols><sheetData>${rowXml}</sheetData>${validations ? `<dataValidations count="${sheet.validations?.length ?? 0}">${validations}</dataValidations>` : ""}</worksheet>`;
}

function workbookXml(definition: DownloadWorkbookDefinition): string {
  const sheets = definition.sheets.map((sheet, index) => (
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" state="${sheet.hidden ? "hidden" : "visible"}" r:id="rId${index + 1}"/>`
  )).join("");
  const definedNames = (definition.definedNames ?? []).map((item) => (
    `<definedName name="${escapeXml(item.name)}">'${escapeXml(item.sheetName.replace(/'/g, "''"))}'!${escapeXml(item.range)}</definedName>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ""}</workbook>`;
}

function workbookRelationships(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypes(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF15803D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function downloadXlsxWorkbook(fileName: string, definition: DownloadWorkbookDefinition): void {
  const entries: Array<{ name: string; data: Uint8Array }> = [
    { name: "[Content_Types].xml", data: ZIP_ENCODER.encode(contentTypes(definition.sheets.length)) },
    { name: "_rels/.rels", data: ZIP_ENCODER.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: ZIP_ENCODER.encode(workbookXml(definition)) },
    { name: "xl/_rels/workbook.xml.rels", data: ZIP_ENCODER.encode(workbookRelationships(definition.sheets.length)) },
    { name: "xl/styles.xml", data: ZIP_ENCODER.encode(XLSX_STYLES) },
    ...definition.sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: ZIP_ENCODER.encode(sheetXml(sheet)),
    })),
  ];
  const bytes = zipStored(entries);
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
