import { RefreshCw, ShieldAlert } from "lucide-react";

export type RemoteChangeNoticeProps = {
  visible: boolean;
  busy?: boolean;
  onLoadServer: () => void | Promise<void>;
  onKeepDraft: () => void | Promise<void>;
};

export function RemoteChangeNotice({
  visible,
  busy = false,
  onLoadServer,
  onKeepDraft,
}: RemoteChangeNoticeProps) {
  if (!visible) return null;

  return (
    <div className="edit-lock-notice warning" role="alert">
      <ShieldAlert aria-hidden="true" />
      <div>
        <strong>Neuerer Serverstand vorhanden</strong>
        <p>
          Der Datensatz wurde auf einem anderen Gerät geändert. Deine Eingaben
          bleiben erhalten, bis du dich bewusst entscheidest.
        </p>
        <small>
          „Serverstand laden“ verwirft den lokalen Entwurf. „Eigene Eingaben
          behalten“ übernimmt nur die aktuelle Datensatzversion und lässt deine
          Formularwerte unverändert.
        </small>
      </div>
      <div className="edit-lock-actions">
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => void onLoadServer()}
          disabled={busy}
        >
          <RefreshCw aria-hidden="true" /> Serverstand laden
        </button>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => void onKeepDraft()}
          disabled={busy}
        >
          Eigene Eingaben behalten
        </button>
      </div>
    </div>
  );
}
