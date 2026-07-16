import React, { useState } from "react";
import { getValidAccessToken } from "@/lib/googleAuth";

type Item = { name: string; id?: string; rk?: string };

const CANDIDATES: Item[] = [
  { name: "USERS", id: import.meta.env.VITE_DRIVE_USERS_FILE_ID, rk: import.meta.env.VITE_DRIVE_USERS_FILE_RESOURCE_KEY },
  { name: "ATHLETEN", id: import.meta.env.VITE_DRIVE_ATHLETEN_FILE_ID, rk: import.meta.env.VITE_DRIVE_ATHLETEN_FILE_RESOURCE_KEY },
  { name: "ANMELDUNG", id: import.meta.env.VITE_DRIVE_ANMELDUNG_FILE_ID, rk: import.meta.env.VITE_DRIVE_ANMELDUNG_FILE_RESOURCE_KEY },
  { name: "UEBUNGSKATALOG", id: import.meta.env.VITE_DRIVE_UEBUNGSKATALOG_FILE_ID, rk: import.meta.env.VITE_DRIVE_UEBUNGSKATALOG_FILE_RESOURCE_KEY },
  { name: "UEBUNGSPFLEGE", id: import.meta.env.VITE_DRIVE_UEBUNGSPFLEGE_FILE_ID, rk: import.meta.env.VITE_DRIVE_UEBUNGSPFLEGE_FILE_RESOURCE_KEY },
  { name: "TRAININGSPLAN", id: import.meta.env.VITE_DRIVE_TRAININGSPLAN_FILE_ID, rk: import.meta.env.VITE_DRIVE_TRAININGSPLAN_FILE_RESOURCE_KEY },
  { name: "KT_PERSONEN", id: import.meta.env.VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID, rk: import.meta.env.VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_RESOURCE_KEY },
  { name: "KT_DATA", id: import.meta.env.VITE_DRIVE_KINDERTRAINING_DATA_FILE_ID, rk: import.meta.env.VITE_DRIVE_KINDERTRAINING_DATA_FILE_RESOURCE_KEY },
];

export default function DriveDebug() {
  const [out, setOut] = useState<string>("");

  const run = async () => {
    const tok = await getValidAccessToken();
    const results: any[] = [];
    for (const it of CANDIDATES) {
      if (!it.id) continue;
      const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(it.id)}`;
      const rk = it.rk ? `&resourceKey=${encodeURIComponent(it.rk)}` : "";
      const metaUrl = `${base}?fields=id,name,mimeType,shortcutDetails,trashed${rk}&supportsAllDrives=true`;
      const dataUrl = `${base}?alt=media${rk}&supportsAllDrives=true`;

      const meta = await fetch(metaUrl, { headers: { Authorization: `Bearer ${tok}` } });
      const data = await fetch(dataUrl, { headers: { Authorization: `Bearer ${tok}` } });

      results.push({
        name: it.name,
        id: it.id,
        rk: it.rk || null,
        metaStatus: `${meta.status}`,
        dataStatus: `${data.status}`,
        metaText: meta.ok ? undefined : await meta.text().catch(()=>undefined),
        dataText: data.ok ? undefined : await data.text().catch(()=>undefined),
      });
    }
    setOut(JSON.stringify(results, null, 2));
  };

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold mb-2">Drive Debug</h1>
      <p className="mb-2">Prüft alle bekannten .env IDs (inkl. optionalem RESOURCE_KEY) für Meta- und Datenzugriff.</p>
      <button className="login-btn primary" onClick={run}>Test starten</button>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, fontSize: 12, background:"#f7f7f7", padding:12, borderRadius:8 }}>{out}</pre>
    </main>
  );
}
