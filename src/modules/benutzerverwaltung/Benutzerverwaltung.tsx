// src/modules/benutzerverwaltung/Benutzerverwaltung.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Benutzerverwaltung.css";
import { MODULES, type ModuleKey } from "@/modules/registry";
import {
  loadUsersFile,
  saveUsersFile,
  type UsersFile,
  type UserRecord,
} from "./services/UsersAdminStore";

type FormState = {
  username: string;
  displayName: string;
  password: string;
  modules: ModuleKey[];
  active: boolean;
  updatedAt?: string;
};

const emptyForm = (): FormState => ({
  username: "",
  displayName: "",
  password: "",
  modules: [],
  active: true,
  updatedAt: undefined,
});

function generatePassword(length: number = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars.charAt(idx);
  }
  return result;
}

const Benutzerverwaltung: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersFile, setUsersFile] = useState<UsersFile | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const pendingSaveRef = useRef<UsersFile | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const file = await loadUsersFile();
        if (cancelled) return;
        setUsersFile(file);

        const first = (file.users && file.users[0]) || null;
        if (first) {
          setSelectedUsername(first.username);
          setForm({
            username: first.username,
            displayName: first.displayName ?? first.username,
            password: first.password ?? "",
            modules: (first.modules ?? []) as ModuleKey[],
            active: first.active ?? true,
            updatedAt: first.updatedAt,
          });
        } else {
          setSelectedUsername("");
          setForm(emptyForm());
        }
      } catch (err) {
        console.error("Benutzerverwaltung: Fehler beim Laden", err);
        if (!cancelled) setError("Fehler beim Laden der Benutzer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  function queueSave(nextFile: UsersFile) {
    pendingSaveRef.current = nextFile;
    if (saveTimerRef.current != null) return;
    saveTimerRef.current = window.setTimeout(async () => {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      if (!toSave) return;
      try {
        setSaving(true);
        await saveUsersFile(toSave);
      } catch (err) {
        console.error("Benutzerverwaltung: Autosave fehlgeschlagen", err);
        setError("Fehler beim Speichern.");
      } finally {
        setSaving(false);
      }
    }, 400);
  }

  const sortedUsers = useMemo(() => {
    if (!usersFile?.users) return [];
    let list = [...usersFile.users];
    if (showOnlyActive) {
      list = list.filter((u) => u.active !== false);
    }
    return list.sort((a, b) =>
      (a.displayName || a.username || "").localeCompare(
        b.displayName || b.username || "",
        "de",
        { sensitivity: "base" }
      )
    );
  }, [usersFile, showOnlyActive]);

  const currentUser: UserRecord | null = useMemo(
    () =>
      usersFile?.users?.find((u) => u.username === selectedUsername) ?? null,
    [usersFile, selectedUsername]
  );

  const isExistingUser = !!currentUser;

  const handleSelectUser = (username: string) => {
    if (!usersFile) return;
    const u = usersFile.users.find((x) => x.username === username);
    if (!u) return;
    setSelectedUsername(username);
    setShowPassword(false);
    setForm({
      username: u.username,
      displayName: u.displayName ?? u.username,
      password: u.password ?? "",
      modules: (u.modules ?? []) as ModuleKey[],
      active: u.active ?? true,
      updatedAt: u.updatedAt,
    });
  };

  const handleNewUser = () => {
    setSelectedUsername("");
    setShowPassword(false);
    setForm(emptyForm());
  };

  const commitForm = (next: FormState) => {
    const username = next.username.trim();
    if (!username) return;
    const now = new Date().toISOString();

    setUsersFile((prev) => {
      const base: UsersFile = prev ?? { version: 2, users: [] as any[] };
      const idx = base.users.findIndex(
        (u: UserRecord) => u.username === username
      );

      const mapped: UserRecord = {
        ...(idx >= 0 ? base.users[idx] : {}),
        username,
        displayName: next.displayName?.trim() || username,
        password: next.password ?? "",
        modules: (next.modules ?? []) as ModuleKey[],
        active: next.active,
        updatedAt: now,
      };

      const users =
        idx >= 0
          ? base.users.map((u, i) => (i === idx ? mapped : u))
          : [...base.users, mapped];

      const updatedFile: UsersFile = {
        ...base,
        version:
          typeof base.version === "number" && Number.isFinite(base.version)
            ? base.version
            : 2,
        users,
      };

      queueSave(updatedFile);
      return updatedFile;
    });

    setSelectedUsername(username);
    setForm({
      ...next,
      username,
      displayName: next.displayName?.trim() || username,
      updatedAt: now,
    });
  };

  const handleChangeText =
    (field: "username" | "displayName" | "password") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        const next: FormState = {
          ...prev,
          [field]: value,
        };

        // Username nur lokal ändern, nicht sofort speichern
        if (field === "username") {
          return next;
        }

        // Andere Felder: speichern, sobald Username vorhanden ist
        if (next.username.trim()) {
          commitForm(next);
        }
        return next;
      });
    };

  const handleToggleActive = () => {
    setForm((prev) => {
      const next: FormState = { ...prev, active: !prev.active };
      if (next.username.trim()) {
        commitForm(next);
      }
      return next;
    });
  };

  const handleToggleModule = (key: ModuleKey) => {
    setForm((prev) => {
      const currentModules = prev.modules ?? [];
      const has = currentModules.includes(key);
      const nextModules = has
        ? currentModules.filter((m) => m !== key)
        : [...currentModules, key];
      const next: FormState = { ...prev, modules: nextModules };
      if (next.username.trim()) {
        commitForm(next);
      }
      return next;
    });
  };

  const handleToggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleGeneratePasswordClick = () => {
    const pwd = generatePassword(12);
    setForm((prev) => {
      const next: FormState = { ...prev, password: pwd };
      if (next.username.trim()) {
        commitForm(next);
      }
      return next;
    });
    setShowPassword(true);
  };

  const handleResetPasswordClick = () => {
    setForm((prev) => {
      const next: FormState = { ...prev, password: "" };
      if (next.username.trim()) {
        commitForm(next);
      }
      return next;
    });
  };

  if (loading) {
    return <div className="user-admin-root">Lade Benutzer…</div>;
  }

  if (error) {
    return (
      <div className="user-admin-root">
        <div className="user-admin-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="user-admin-root">
      <div className="user-admin-header-row">
        <select
          className="user-admin-select"
          value={selectedUsername}
          onChange={(e) => handleSelectUser(e.target.value)}
        >
          <option value="">– Benutzer auswählen –</option>
          {sortedUsers.map((u) => (
            <option key={u.username} value={u.username}>
              {u.displayName || u.username} ({u.username})
            </option>
          ))}
        </select>

        <button
          type="button"
          className="user-admin-btn"
          onClick={handleNewUser}
        >
          Neuen User anlegen
        </button>

        <label className="user-admin-toggle">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(e) => setShowOnlyActive(e.target.checked)}
          />
          <span>Nur aktive anzeigen</span>
        </label>

        {saving && (
          <span className="user-admin-saving">Speichern…</span>
        )}
      </div>

      <div className="user-admin-hint">
        Hinweis: Der Benutzer muss zuerst als Google-Konto angelegt sein.
        Hier werden nur App-Rechte und das Login-Passwort verwaltet.
      </div>

      <div className="user-admin-card">
        <div className="user-admin-section-title">Benutzerdaten</div>

        <div className="user-admin-row">
          <label className="user-admin-label">Username</label>
          <input
            className="user-admin-input"
            value={form.username}
            onChange={handleChangeText("username")}
            placeholder="z.B. martin"
            disabled={isExistingUser}
          />
        </div>

        <div className="user-admin-row">
          <label className="user-admin-label">Anzeigename</label>
          <input
            className="user-admin-input"
            value={form.displayName}
            onChange={handleChangeText("displayName")}
            placeholder="Name für Anzeige"
          />
        </div>

        <div className="user-admin-row">
          <label className="user-admin-label">Passwort</label>
          <div className="user-admin-password-wrapper">
            <input
              className="user-admin-input"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChangeText("password")}
              placeholder="Passwort"
            />
            <button
              type="button"
              className="user-admin-btn-small"
              onClick={handleToggleShowPassword}
              disabled={!form.password}
            >
              {showPassword ? "Verbergen" : "Anzeigen"}
            </button>
          </div>
          <div className="user-admin-password-actions">
            <button
              type="button"
              className="user-admin-btn-small"
              onClick={handleGeneratePasswordClick}
              disabled={!form.username.trim()}
            >
              Passwort generieren
            </button>
            <button
              type="button"
              className="user-admin-btn-small"
              onClick={handleResetPasswordClick}
              disabled={!form.username.trim()}
            >
              Passwort zurücksetzen
            </button>
          </div>
        </div>

        <div className="user-admin-status-row">
          <button
            type="button"
            className="user-admin-btn"
            onClick={handleToggleActive}
            disabled={!form.username.trim()}
          >
            {form.active ? "Aktiv" : "Inaktiv"}
          </button>
          <span
            className={
              "user-admin-badge" + (form.active ? "" : " inactive")
            }
          >
            {form.active ? "Benutzer ist aktiv" : "Benutzer ist inaktiv"}
          </span>
        </div>

        {form.updatedAt && (
          <div className="user-admin-meta">
            Zuletzt geändert:{" "}
            {new Date(form.updatedAt).toLocaleString("de-AT")}
          </div>
        )}

        <hr className="user-admin-separator" />

        <div className="user-admin-section-title">Module / Rechte</div>
        <div className="user-admin-modules">
          {MODULES.map((m) => (
            <label key={m.key} className="user-admin-module-item">
              <input
                type="checkbox"
                checked={form.modules.includes(m.key)}
                onChange={() => handleToggleModule(m.key)}
                disabled={!form.username.trim()}
              />
              <span>
                {m.title}
                {m.description ? ` – ${m.description}` : ""}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Benutzerverwaltung;
