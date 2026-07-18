import { useState, type FormEvent } from "react";
import { AlertTriangle, Save, UserPlus, X } from "lucide-react";
import type { QuickAthleteResult } from "@/features/kindertraining/types";

type QuickAthleteValues = {
  firstName: string;
  lastName: string;
  birthYear: number;
};

type QuickAthleteDialogProps = {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (
    values: QuickAthleteValues,
    attachExisting: boolean,
  ) => Promise<QuickAthleteResult>;
  onCompleted: (result: QuickAthleteResult) => void;
};

export function QuickAthleteDialog({
  busy: externalBusy = false,
  onClose,
  onSubmit,
  onCompleted,
}: QuickAthleteDialogProps) {
  const currentYear = new Date().getFullYear();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [duplicate, setDuplicate] = useState<QuickAthleteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = externalBusy || submitting;
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    birthYear !== null &&
    birthYear >= 1900 &&
    birthYear <= currentYear;

  async function submit(attachExisting: boolean): Promise<void> {
    if (!canSubmit || birthYear === null || busy) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(
        { firstName, lastName, birthYear },
        attachExisting,
      );

      if (result.status === "duplicate") {
        setDuplicate(result);
        return;
      }

      onCompleted(result);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Das Kind konnte nicht angelegt werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(false);
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="quick-athlete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-athlete-title"
      >
        <header>
          <div>
            <p className="eyebrow">Kindertraining</p>
            <h2 id="quick-athlete-title">Kind hinzufügen</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Dialog schließen"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <p className="dialog-intro">
          Das Kind wird aktiv angelegt und automatisch dem Kindertraining zugeordnet.
        </p>

        {error && <div className="alert error compact-alert">{error}</div>}

        {duplicate ? (
          <div className="duplicate-athlete-panel">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Dieses Kind ist bereits vorhanden.</strong>
              <p>
                {duplicate.athlete.firstName} {duplicate.athlete.lastName}, Jahrgang{" "}
                {duplicate.athlete.birthYear}
              </p>
              <p>
                Soll der vorhandene Datensatz aktiviert und dem Kindertraining zugeordnet werden?
              </p>
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDuplicate(null)}
                disabled={busy}
              >
                Zurück
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void submit(true)}
                disabled={busy}
              >
                <UserPlus aria-hidden="true" />
                {busy ? "Wird zugeordnet …" : "Bestehendes Kind zuordnen"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="quick-athlete-fields">
              <label>
                Vorname
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </label>
              <label>
                Nachname
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Jahrgang
                <input
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={currentYear}
                  value={birthYear ?? ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    setBirthYear(Number.isInteger(parsed) && event.target.value ? parsed : null);
                  }}
                  placeholder="z. B. 2018"
                  required
                />
              </label>
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!canSubmit || busy}
              >
                <Save aria-hidden="true" />
                {busy ? "Wird angelegt …" : "Kind anlegen"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
