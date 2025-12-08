import { useEffect, useMemo, useState } from "react";
import type { Exercise, MediaItem } from "@/modules/uebungspflege/types/exercise";
import {
  addExercise,
  loadExercises,
  updateExercise,
  uploadExerciseMedia,
  unlinkMediaFromExercise,
} from "@/modules/uebungspflege/services/exercisesStore";
import { toPreviewIframeUrl } from "@/modules/uebungspflege/services/mediaUrl";
import { loadHauptgruppen, loadUntergruppen, addHauptgruppe, addUntergruppe } from "@/modules/uebungspflege/services/groups";
import { loadEinheiten } from "@/modules/uebungspflege/services/units";
import Stars from "@/modules/uebungspflege/components/Stars";
import { Save, Eraser, Plus } from "lucide-react";
import "./Uebungspflege.css";
import "@/modules/uebungspflege/services/authToken"; // Token-Provider

type Filter = { q: string; onlyActive: boolean; haupt: string; unter: string };
type ModalState = { open: boolean; type: 'haupt' | 'unter' | null; value: string };

export default function Uebungspflege() {
  const [all, setAll] = useState<Exercise[]>([]);
  const [flt, setFlt] = useState<Filter>({ q: "", onlyActive: true, haupt: "", unter: "" });
  const [sel, setSel] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);

  const [hauptgruppen, setHauptgruppen] = useState<string[]>([]);
  const [untergruppen, setUntergruppen] = useState<string[]>([]);
  const [einheiten, setEinheiten] = useState<string[]>([]);

  const [modal, setModal] = useState<ModalState>({ open: false, type: null, value: "" });

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const [exs, hg, ug, units] = await Promise.all([
          loadExercises(),
          loadHauptgruppen(),
          loadUntergruppen(undefined),
          loadEinheiten(),
        ]);
        setAll(exs);
        setHauptgruppen(hg);
        setUntergruppen(ug);
        setEinheiten(units);
        if (!sel) onClear();
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!sel?.hauptgruppe) return;
      const ug = await loadUntergruppen(sel.hauptgruppe);
      setUntergruppen(ug);
      if (sel.untergruppe && !ug.includes(sel.untergruppe)) {
        setSel(s => s ? { ...s, untergruppe: "" } : s);
      }
    })();
  }, [sel?.hauptgruppe]);

  const listAll = useMemo(() => {
    const qq = flt.q.trim().toLowerCase();
    const base = all.filter((x) => {
      if (flt.onlyActive && x.active === false) return false;

      if (flt.haupt && x.hauptgruppe !== flt.haupt) return false;
      if (flt.unter && x.untergruppe !== flt.unter) return false;

      if (!qq) return true;
      return (
        x.name?.toLowerCase().includes(qq) ||
        x.hauptgruppe?.toLowerCase().includes(qq) ||
        x.untergruppe?.toLowerCase().includes(qq) ||
        x.beschreibung?.toLowerCase().includes(qq)
      );
    });

    return base.slice().sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "de-AT", {
        sensitivity: "base",
      })
    );
  }, [all, flt]);

  // Limit auf 15 Einträge in der Vorschau-Liste
  const list = useMemo(() => listAll.slice(0, 15), [listAll]);

  function onClear() {
    const now = new Date().toISOString();
    // Menge bewusst leer (undefined), nicht 0
    setSel({ id: "NEW", name: "", active: true, createdAt: now, updatedAt: now, media: [], difficulty: 1, einheit: "" });
  }

  const valid = !!(sel && sel.name?.trim() && sel.hauptgruppe && sel.untergruppe && (sel.einheit && sel.einheit.trim()) && sel.menge !== undefined);

  async function saveOrUpdate(): Promise<Exercise | null> {
    if (!sel || !valid) return null;
    setBusy(true);
    try {
      if (sel.id === "NEW") {
        const { id, ...rest } = sel;
        const ex = await addExercise({ ...rest, name: rest.name.trim() });
        const refreshed = await loadExercises();
        setAll(refreshed);
        setSel(ex);
        return ex;
      } else {
        await updateExercise(sel);
        const refreshed = await loadExercises();
        const updated = refreshed.find(x => x.id === sel.id) || sel;
        setAll(refreshed);
        setSel(updated);
        return updated;
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!sel || !valid) return;
    await saveOrUpdate();
  }

  async function onUploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    if (!sel) return;
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (!valid) {
      alert("Bitte zuerst alle Pflichtfelder (ohne Beschreibung) ausfüllen und speichern.");
      e.target.value = "";
      return;
    }

    let current = sel;
    if (sel.id === "NEW") {
      const saved = await saveOrUpdate();
      if (!saved) {
        alert("Speichern fehlgeschlagen. Bitte erneut versuchen.");
        e.target.value = "";
        return;
      }
      current = saved;
    }

    setBusy(true);
    try {
      await uploadExerciseMedia(current.id, file);
      const refreshed = await loadExercises();
      setAll(refreshed);
      setSel(refreshed.find((x) => x.id === current!.id) || current);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function unlink(mid: string) {
    if (!sel) return;
    setBusy(true);
    try {
      await unlinkMediaFromExercise(sel.id, mid, false);
      const refreshed = await loadExercises();
      setAll(refreshed);
      setSel(refreshed.find((x) => x.id === sel.id) || null);
    } finally {
      setBusy(false);
    }
  }

  async function unlinkAndDelete(mid: string) {
    if (!sel) return;
    if (!confirm("Auch die Datei auf Google Drive löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
    setBusy(true);
    try {
      await unlinkMediaFromExercise(sel.id, mid, true);
      const refreshed = await loadExercises();
      setAll(refreshed);
      setSel(refreshed.find((x) => x.id === sel.id) || null);
    } finally {
      setBusy(false);
    }
  }

  function openModal(type: 'haupt'|'unter') {
    setModal({ open: true, type, value: "" });
  }
  function closeModal() {
    setModal({ open: false, type: null, value: "" });
  }
  async function confirmModal() {
    if (!modal.type || !modal.value.trim()) return;
    const name = modal.value.trim();
    if (modal.type === "haupt") {
      await addHauptgruppe(name);
      const hg = await loadHauptgruppen();
      setHauptgruppen(hg);
      setSel(s => s ? { ...s, hauptgruppe: name, untergruppe: "" } : s);
      const ug = await loadUntergruppen(name);
      setUntergruppen(ug);
    } else {
      await addUntergruppe(name, sel?.hauptgruppe);
      const ug = await loadUntergruppen(sel?.hauptgruppe);
      setUntergruppen(ug);
      setSel(s => s ? { ...s, untergruppe: name } : s);
    }
    closeModal();
  }

  const totalCount = all.length;
  const filteredCount = listAll.length;

  const filterHauptgruppen = useMemo(() => {
    const set = new Set<string>();
    for (const ex of all) {
      if (ex.hauptgruppe) set.add(ex.hauptgruppe);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de-AT", { sensitivity: "base" })
    );
  }, [all]);

  const filterUntergruppen = useMemo(() => {
    const set = new Set<string>();
    for (const ex of all) {
      if (flt.haupt && ex.hauptgruppe !== flt.haupt) continue;
      if (ex.untergruppe) set.add(ex.untergruppe);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de-AT", { sensitivity: "base" })
    );
  }, [all, flt.haupt]);

  const collator = new Intl.Collator('de', { sensitivity: 'base' });
  const hgSorted = [...hauptgruppen].sort((a,b) => collator.compare(a,b));
  const ugSorted = [...untergruppen].sort((a,b) => collator.compare(a,b));

  const modalItems = modal.open
    ? (modal.type === "haupt" ? hgSorted : (sel?.hauptgruppe ? ugSorted : []))
    : [];

  return (
    <main style={{ padding: 12 }}>
      {/* ---------- Editor ---------- */}
      <section
        aria-label="Übung bearbeiten oder neu anlegen"
        style={{
          maxWidth: 920,
          margin: "0 auto",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        
        
       <header className="ex-header ex-header--one">
  <div className="ex-header-line">
    <h3 className="ex-title">Neue Übung</h3>
    <div className="ex-actions-inline">
      <button className="btn btn--icon" type="button" onClick={onClear} title="Maske leeren" aria-label="Maske leeren">
        <Eraser size={18} />
      </button>
      <button
        className="btn btn--icon btn--primary-soft"
        type="button"
        onClick={onSave}
        disabled={busy || !valid}
        title={!valid ? "Alle Pflichtfelder (ohne Beschreibung) müssen befüllt sein" : "Speichern"}
        aria-label="Speichern"
      >
        <Save size={18} />
      </button>
      <button
        type="button"
        className={`toggle-switch ${sel?.active ? "on" : "off"}`}
        onClick={() => setSel(s => s ? { ...s, active: !s.active } : s)}
        aria-pressed={!!sel?.active}
        aria-label={sel?.active ? "Aktiv" : "Inaktiv"}
        title={sel?.active ? "Aktiv" : "Inaktiv"}
      >
        <span className="knob" />
      </button>
    </div>
  </div>
</header>




        {/* Einspaltig: Name -> Hauptgruppe -> Untergruppe -> Menge/Einheit -> Schwierigkeit -> Beschreibung */}
        <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
          <div
            className="grid"
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}
          >
            {/* Name */}
            <label>
              Name*
              <input
                className="input"
                value={sel?.name ?? ""}
                onChange={(e) => setSel((s) => (s ? { ...s, name: e.target.value } : s))}
                placeholder="z. B. Einlaufen 5min"
                required
              />
            </label>

            {/* Hauptgruppe */}
            <div>
              <label style={{ display: "block" }}>
                Hauptgruppe* <button className="btn btn--icon btn--tiny" type="button" onClick={() => openModal('haupt')} title="Neue Hauptgruppe" aria-label="Neue Hauptgruppe"><Plus size={16} /></button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
                  <select
                    className="input"
                    value={sel?.hauptgruppe ?? ""}
                    onChange={(e) => setSel((s) => (s ? { ...s, hauptgruppe: e.target.value } : s))}
                    required
                  >
                    <option value="" disabled>Bitte wählen…</option>
                    {hgSorted.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  
                </div>
              </label>
            </div>

            {/* Untergruppe */}
            <div>
              <label style={{ display: "block" }}>
                Untergruppe* <button className="btn btn--icon btn--tiny" type="button" onClick={() => openModal('unter')} title="Neue Untergruppe" aria-label="Neue Untergruppe"><Plus size={16} /></button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
                  <select
                    className="input"
                    value={sel?.untergruppe ?? ""}
                    onChange={(e) => setSel((s) => (s ? { ...s, untergruppe: e.target.value } : s))}
                    required
                  >
                    <option value="" disabled>Bitte wählen…</option>
                    {ugSorted.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  
                </div>
              </label>
            </div>

            {/* Menge links, Einheit rechts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                Menge*
                <input
                  className="input"
                  type="number"
                  value={sel?.menge ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSel((s) => (s ? { ...s, menge: v === "" ? undefined : Number(v) } : s));
                  }}
                  required
                />
              </label>
              <label>
                Einheit*
                <select
                  className="input"
                  value={sel?.einheit ?? ""}
                  onChange={(e) => setSel((s) => (s ? { ...s, einheit: e.target.value } : s))}
                  required
                >
                  <option value="" disabled>Bitte wählen…</option>
                  {einheiten.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
            </div>

            {/* Schwierigkeit mit Sternen */}
            <label>
              Schwierigkeit*
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Stars value={sel?.difficulty ?? 1} onChange={(v) => setSel(s => s ? { ...s, difficulty: v } : s)} />
              </div>
            </label>

            {/* Beschreibung: gleiche Schriftart */}
            <label className="ex-field ex-field--desc">
              Beschreibung
              <textarea
                className="input"
                value={sel?.beschreibung ?? ""}
                onChange={(e) => setSel((s) => (s ? { ...s, beschreibung: e.target.value } : s))}
                style={{ width: "100%", minHeight: 100, fontFamily: "inherit" }}
                placeholder="Details, Hinweise, Varianten …"
              />
            </label>

            {/* Medien */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label className={`btn ${(!valid || busy) ? "is-disabled" : ""}`} style={{ cursor: (!valid || busy) ? "not-allowed" : "pointer" }}>
                Medien hochladen
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={onUploadMedia}
                  style={{ display: "none" }}
                  disabled={!valid || busy}
                />
              </label>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {busy ? "Bitte warten…" : (!valid ? "Vor Upload: Pflichtfelder ausfüllen & speichern" : "Bilder oder Videos hinzufügen")}
              </span>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginTop: 6, marginBottom: 6 }}>Medien</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(sel?.media ?? []).map((m: MediaItem) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <iframe
                      src={toPreviewIframeUrl(m.fileId)}
                      loading="lazy"
                      style={{ maxWidth: 240, border: "1px solid #eee", borderRadius: 10 }}
                      title={m.name}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn--tiny" type="button" onClick={() => unlink(m.id)}>
                        Verknüpfung entfernen
                      </button>
                      <button className="btn btn--tiny" type="button" onClick={() => unlinkAndDelete(m.id)}>
                        Auch von Drive löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* ---------- Suche & Liste ---------- */}
      <section aria-label="Suchen & vorhandene Übungen" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "8px 0" }}>bestehende Übung suchen ({filteredCount}/{totalCount})</h3>
        <div
          className="toolbar"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <input
            className="input"
            placeholder="Suchen…"
            value={flt.q}
            onChange={(e) => setFlt((s) => ({ ...s, q: e.target.value }))}
            style={{ minWidth: 220, flex: "1 1 220px" }}
          />
          <label className="toggle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={flt.onlyActive}
              onChange={(e) => setFlt((s) => ({ ...s, onlyActive: e.target.checked }))}
            />
            Nur aktive
          </label>
        </div>

        <div
          className="toolbar"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <select
            className="input"
            value={flt.haupt}
            onChange={(e) =>
              setFlt((s) => ({ ...s, haupt: e.target.value, unter: "" }))
            }
            style={{ flex: "1 1 0", minWidth: 0 }}
          >
            <option value="">Alle Hauptgruppen</option>
            {filterHauptgruppen.map((hg) => (
              <option key={hg} value={hg}>
                {hg}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={flt.unter}
            onChange={(e) =>
              setFlt((s) => ({ ...s, unter: e.target.value }))
            }
            style={{ flex: "1 1 0", minWidth: 0 }}
          >
            <option value="">Alle Untergruppen</option>
            {filterUntergruppen.map((ug) => (
              <option key={ug} value={ug}>
                {ug}
              </option>
            ))}
          </select>
        </div>

        <div
          className="grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 8,
          }}
        >
          {busy && <div style={{ padding: 8, fontSize: 12 }}>Laden…</div>}

          {list.map((x) => (
            <article
              key={x.id}
              className={"card" + (sel?.id === x.id ? " is-selected" : "")}
              onClick={() => setSel(x)}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{x.name || "Ohne Name"}</strong>
                {!x.active && <span style={{ fontSize: 12, opacity: 0.7 }}>inaktiv</span>}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {x.hauptgruppe || "—"}
                {x.untergruppe ? " · " + x.untergruppe : ""}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Popup ---------- */}
      {modal.open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              minWidth: 300,
              maxWidth: "92vw",
              width: 420,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 10px 24px rgba(0,0,0,.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              {modal.type === "haupt" ? "Neue Hauptgruppe" : "Neue Untergruppe"}
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                autoFocus
                placeholder={modal.type === "haupt" ? "z. B. Kraft" : "z. B. Bauch-schräg"}
                value={modal.value}
                onChange={(e) => setModal((m) => ({ ...m, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmModal(); }
                }}
                style={{ flex: 1 }}
              />
              <button className="btn btn--primary" type="button" onClick={confirmModal} disabled={!modal.value.trim()}>
                Anlegen
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {modal.type === "haupt" ? "Vorhandene Hauptgruppen" : (sel?.hauptgruppe ? `Untergruppen von \"${sel.hauptgruppe}\"` : "Untergruppen")}
              </div>
              {modalItems.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Keine Einträge vorhanden.</div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  {modalItems.map((it) => (
                    <li key={it} style={{ border: "1px solid #eee", borderRadius: 8, padding: "6px 8px" }}>
                      <span style={{ fontSize: 14 }}>{it}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button className="btn" type="button" onClick={closeModal}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @media (min-width: 640px) {
            section[aria-label="Suchen & vorhandene Übungen"] .grid {
              grid-template-columns: 1fr 1fr;
            }
          }
          .btn.is-disabled { opacity: .6; pointer-events: none; }
          textarea.input { font-family: inherit; }
        `}
      </style>
    </main>
  );
}