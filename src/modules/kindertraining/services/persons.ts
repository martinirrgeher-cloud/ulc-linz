// src/modules/kindertraining/services/persons.ts
import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import type { Person } from "../lib/types";

function getPersonsFileId(): string {
  const id = import.meta.env.VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID;
  if (!id) throw new Error("VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID fehlt");
  return String(id);
}

// stabile ID aus dem Namen ableiten (kein Speichern von IDs notwendig)
function stableIdFromName(name: string): string {
  const s = (name || "").trim().toLowerCase();
  // FNV-1a simple hash → hex
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `p-${h.toString(16).padStart(8, "0")}`;
}

export async function loadPersons(): Promise<Person[]> {
  const raw = await downloadJson<any>(getPersonsFileId());
  if (Array.isArray(raw)) {
    return raw.map(toPerson);
  }
  if (raw && Array.isArray(raw.persons)) {
    return raw.persons.map(toPerson);
  }
  if (raw && typeof raw === "object") {
    return Object.values(raw).map(toPerson);
  }
  return [];
}

export async function savePersons(list: Person[]): Promise<void> {
  // Speichere wie Original: Array ohne id
  const plain = list.map(p => ({
    name: p.name,
    paid: !!p.paid,
    inactive: !!p.inactive,
    generalNote: p.generalNote ?? "",
  }));
  await overwriteJsonContent(getPersonsFileId(), plain);
}

function findIndexByIdOrName(list: Person[], id: string | undefined, name: string | undefined): number {
  if (id) {
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) return i;
  }
  if (name) {
    const key = (name || "").trim().toLowerCase();
    const i = list.findIndex(x => (x.name || "").trim().toLowerCase() === key);
    if (i >= 0) return i;
  }
  return -1;
}

export async function addPerson(name: string): Promise<Person> {
  const list = await loadPersons();
  const p: Person = { id: stableIdFromName(name), name: name.trim(), inactive: false, paid: false };
  // wenn gleicher Name existiert, ersetze statt duplizieren
  const idx = findIndexByIdOrName(list, p.id, p.name);
  if (idx >= 0) list[idx] = { ...list[idx], ...p };
  else list.push(p);
  await savePersons(list);
  return p;
}

export async function renamePerson(id: string, name: string): Promise<void> {
  const list = await loadPersons();
  const idx = findIndexByIdOrName(list, id, undefined);
  if (idx >= 0) {
    const nextId = stableIdFromName(name);
    list[idx] = { ...list[idx], id: nextId, name: name.trim() };
    await savePersons(list);
  }
}

export async function setInactive(id: string, inactive: boolean): Promise<void> {
  const list = await loadPersons();
  const idx = findIndexByIdOrName(list, id, undefined);
  if (idx >= 0) {
    list[idx] = { ...list[idx], inactive: !!inactive };
    await savePersons(list);
  }
}

export async function setPaid(id: string, paid: boolean): Promise<void> {
  const list = await loadPersons();
  const idx = findIndexByIdOrName(list, id, undefined);
  if (idx >= 0) {
    list[idx] = { ...list[idx], paid: !!paid };
    await savePersons(list);
  }
}

export async function setGeneralNote(id: string, note: string): Promise<void> {
  const list = await loadPersons();
  const idx = findIndexByIdOrName(list, id, undefined);
  if (idx >= 0) {
    const clean = (note ?? "").trim();
    list[idx] = { ...list[idx], generalNote: clean };
    await savePersons(list);
  }
}

function toPerson(x: any): Person {
  const name = String(x?.name ?? "");
  const id = stableIdFromName(name);
  return {
    id,
    name,
    inactive: !!x?.inactive,
    paid: !!x?.paid,
    generalNote: x?.generalNote ? String(x.generalNote) : "",
  };
}
