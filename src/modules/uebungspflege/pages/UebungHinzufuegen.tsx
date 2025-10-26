import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Settings } from "lucide-react";
import { useUebungen } from "@/modules/uebungskatalog/hooks/useUebungen";
import { useUebungsGruppen } from "@/modules/uebungskatalog/hooks/useUebungsGruppen";
import { UploadField } from "../components/UploadField";
import { deleteFile } from "@/lib/drive/DriveClient";
import "../styles/Uebungspflege.css";

export default function UebungHinzufuegen() {
  const navigate = useNavigate();
  const { uebungen, addUebung, updateUebung, uploadMedia, loading, saving } = useUebungen();
  const { gruppen } = useUebungsGruppen();

  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hauptgruppe, setHauptgruppe] = useState("");
  const [untergruppe, setUntergruppe] = useState("");
  const [menge, setMenge] = useState<string>("");
  const [einheit, setEinheit] = useState<string>("WH");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [mediaName, setMediaName] = useState<string | undefined>(undefined);
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const [aktiv, setAktiv] = useState(true);
  const [difficulty, setDifficulty] = useState(1);

  const [filter, setFilter] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hauptgruppen = useMemo(() => {
    const all = new Set([...Object.keys(gruppen), ...uebungen.map(u => u.hauptgruppe)]);
    return Array.from(all);
  }, [gruppen, uebungen]);

  const untergruppen = useMemo(() => {
    const ausGruppe = gruppen[hauptgruppe] || [];
    const ausDaten = uebungen.filter(u => u.hauptgruppe === hauptgruppe).map(u => u.untergruppe);
    return Array.from(new Set([...ausGruppe, ...ausDaten]));
  }, [hauptgruppe, gruppen, uebungen]);

  const gefilterteUebungen = useMemo(() => {
    const q = filter.toLowerCase();
    return uebungen.filter(u => u.name.toLowerCase().includes(q)).slice(0, 15);
  }, [filter, uebungen]);

  const handleUpload = async (file: File) => {
    try {
      const result = await uploadMedia(file);
      setMediaUrl(result.url);
      etMediaType(result.type as "" | "video" | "image");
      setMediaName(result.name || file.name);
      setMediaId(result.id);
      return result;
    } catch {
      alert("Upload fehlgeschlagen. Bitte neu einloggen.");
      return undefined;
    }
  };

  const handleUploaded = (result: { id: string; url: string; type: string; name?: string }) => {
    setMediaUrl(result.url);
    setMediaType(result.type as "image" | "video" | "");
    setMediaName(result.name ?? "");
    setMediaId(result.id);
  };

  const handleCleared = async () => {
    if (mediaId) {
      try {
        await deleteFile(mediaId);
      } catch (err) {
        console.error("Löschen fehlgeschlagen:", err);
        alert("Datei konnte nicht gelöscht werden.");
      }
    }
    setMediaUrl("");
    setMediaType("");
    setMediaName(undefined);
    setMediaId(undefined);
  };

  const handleSelectUebung = (id: string) => {
    const u = uebungen.find(x => x.id === id);
    if (!u) return;
    setEditId(u.id);
    setName(u.name);
    setHauptgruppe(u.hauptgruppe);
    setUntergruppe(u.untergruppe);
    setMenge(u.menge?.toString() || "");
    setEinheit(u.einheit);
    setMediaUrl(u.mediaUrl || "");
    setMediaType(u.mediaType || "");
    setDifficulty(u.difficulty || 1);
    setAktiv(u.active);
    setFilter(u.name);

    if (u.mediaUrl) {
      const m = u.mediaUrl.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
      setMediaId(m?.[1] ?? undefined);
      setMediaName(u.mediaName ?? undefined);
    }
    setShowDropdown(false);
  };

  const resetForm = () => {
    setEditId(null);
    setName("");
    setHauptgruppe("");
    setUntergruppe("");
    setMenge("");
    setEinheit("WH");
    setMediaUrl("");
    setMediaType("");
    setMediaName(undefined);
    setMediaId(undefined);
    setDifficulty(1);
    setAktiv(true);
    setFilter("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hauptgruppe || !untergruppe) {
      alert("Bitte Name, Hauptgruppe und Untergruppe ausfüllen.");
      return;
    }

    const data = {
      name,
      hauptgruppe,
      untergruppe,
      menge: menge ? Number(menge) : null,
      einheit: einheit as "WH" | "m" | "sec" | "kg",
      mediaUrl: mediaUrl || "",
      mediaType: mediaType || "",
      mediaName: mediaName || "",
      difficulty,
      active: aktiv,
    };

    if (editId) {
      await updateUebung(editId, data);
    } else {
      await addUebung({ id: crypto.randomUUID(), ...data });
    }

    resetForm();
  };

  return (
    <div className="uebungspflege-container">
      <header className="uebungspflege-header small-title">
        <button className="icon-button" onClick={() => navigate("/dashboard")}>
          <Home size={22} />
        </button>
        <h1>Übung {editId ? "bearbeiten" : "hinzufügen"}</h1>
        <button className="icon-button" onClick={() => window.location.reload()}>
          <Settings size={22} />
        </button>
      </header>

      {/* 🔍 Autocomplete-Suche */}
      <div className="uebungsauswahl" ref={searchRef}>
        <input
          type="text"
          placeholder="Übung suchen..."
          value={filter}
          onFocus={() => setShowDropdown(true)}
          onChange={(e) => {
            setFilter(e.target.value);
            setShowDropdown(true);
          }}
        />
        {showDropdown && gefilterteUebungen.length > 0 && (
          <ul className="uebung-dropdown">
            {gefilterteUebungen.map(u => (
              <li key={u.id} onClick={() => handleSelectUebung(u.id)}>
                {u.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 📂 Auswahl nach Gruppen */}
      <div className="uebungsauswahl-drops">
        <select
          value={hauptgruppe}
          onChange={(e) => {
            setHauptgruppe(e.target.value);
            setUntergruppe("");
          }}
        >
          <option value="">Hauptgruppe wählen</option>
          {hauptgruppen.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={untergruppe}
          onChange={(e) => setUntergruppe(e.target.value)}
          disabled={!hauptgruppe}
        >
          <option value="">Untergruppe wählen</option>
          {untergruppen.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="uebungsauswahl-drops second-line">
        <select
          value={editId || ""}
          onChange={(e) => {
            if (e.target.value) handleSelectUebung(e.target.value);
          }}
          disabled={!hauptgruppe}
        >
          <option value="">Übung auswählen</option>
          {uebungen
            .filter(u =>
              (!hauptgruppe || u.hauptgruppe === hauptgruppe) &&
              (!untergruppe || u.untergruppe === untergruppe)
            )
            .map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
        </select>
      </div>

      <hr className="trenner" />

      <form className="uebungspflege-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          Hauptgruppe
          <input
            list="hauptgruppen"
            value={hauptgruppe}
            onChange={(e) => setHauptgruppe(e.target.value)}
            required
          />
          <datalist id="hauptgruppen">
            {hauptgruppen.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>

        <label>
          Untergruppe
          <input
            list="untergruppen"
            value={untergruppe}
            onChange={(e) => setUntergruppe(e.target.value)}
            required
          />
          <datalist id="untergruppen">
            {untergruppen.map((g) => <option key={g} value={g} />)}
          </datalist>
        </label>

        <label>
          Menge
          <div className="menge-einheit">
            <input
              type="number"
              min="0"
              value={menge}
              onChange={(e) => setMenge(e.target.value)}
            />
            <select value={einheit} onChange={(e) => setEinheit(e.target.value)}>
              <option value="WH">WH</option>
              <option value="m">m</option>
              <option value="sec">sec</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </label>

        {/* Schwierigkeit & Inaktiv */}
        <div className="row-between align-center">
          <div className="difficulty-wrapper">
            <span className="label-inline">Schwierigkeit</span>
            <div className="difficulty-stars">
              {[1, 2, 3].map((level) => (
                <span
                  key={level}
                  title={level === 1 ? "Einfach" : level === 2 ? "Mittel" : "Schwer"}
                  className={difficulty >= level ? "star active" : "star"}
                  onClick={() => setDifficulty(level)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <label className="inaktiv-checkbox-inline">
            <input
              type="checkbox"
              checked={!aktiv}
              onChange={(e) => setAktiv(!e.target.checked)}
            />
            Inaktiv
          </label>
        </div>

        {/* 📁 UploadBlock jetzt hier */}
        <UploadField
          onUpload={handleUpload}
          onUploaded={handleUploaded}
          onCleared={handleCleared}
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          mediaName={mediaName}
        />

        <div className="button-row spaced">
          <button
            type="button"
            className="secondary-button"
            onClick={resetForm}
          >
            Seite leeren
          </button>
          <button type="submit" disabled={loading || saving}>
            {saving ? "Speichern..." : editId ? "Änderungen speichern" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
