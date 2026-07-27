import { Clock3, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react";
import type { EditLockState } from "@/features/collaboration/useEditLock";

export type EditLockNoticeProps = {
  lock: EditLockState;
};

function timeLabel(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

export function EditLockNotice({ lock }: EditLockNoticeProps) {
  if (lock.status === "idle" || lock.status === "acquired") return null;

  if (lock.status === "acquiring") {
    return (
      <div className="edit-lock-notice info" role="status">
        <RefreshCw className="spin" aria-hidden="true" />
        <span>Bearbeitung wird reserviert …</span>
      </div>
    );
  }

  if (lock.status === "blocked") {
    return (
      <div className="edit-lock-notice warning" role="alert">
        <LockKeyhole aria-hidden="true" />
        <div>
          <strong>Der Datensatz wird bereits bearbeitet.</strong>
          <p>
            {lock.owner?.isOwnOtherSession
              ? "Du hast ihn vermutlich in einem anderen Browserfenster geöffnet."
              : `${lock.owner?.displayName ?? "Ein anderer Benutzer"} arbeitet gerade daran.`}
            {lock.owner?.acquiredAt ? ` Seit ${timeLabel(lock.owner.acquiredAt)} Uhr.` : ""}
          </p>
          <small>Die Ansicht bleibt schreibgeschützt und prüft automatisch, ob sie wieder frei wird.</small>
        </div>
        <div className="edit-lock-actions">
          <button type="button" className="secondary-button compact-button" onClick={() => void lock.retry()}>
            <RefreshCw aria-hidden="true" /> Prüfen
          </button>
          {lock.canForce && (
            <button type="button" className="secondary-button compact-button danger-outline" onClick={() => void lock.forceAcquire()}>
              Bearbeitung übernehmen
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="edit-lock-notice error" role="alert">
      {lock.status === "lost" ? <Clock3 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
      <div>
        <strong>Bearbeitungsschutz nicht aktiv</strong>
        <p>{lock.error ?? "Bitte Datensatz neu prüfen, bevor du Änderungen speicherst."}</p>
      </div>
      <button type="button" className="secondary-button compact-button" onClick={() => void lock.retry()}>
        <RefreshCw aria-hidden="true" /> Erneut versuchen
      </button>
    </div>
  );
}
