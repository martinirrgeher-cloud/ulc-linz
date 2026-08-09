import { Phone, X } from "lucide-react";
import type { AthleteEmergencyContact } from "@/features/training-session/types";

export type TrainingContactSelection = {
  athleteName: string;
  contacts: AthleteEmergencyContact[];
};

type TrainingContactDialogProps = {
  selection: TrainingContactSelection;
  onClose: () => void;
};

export function TrainingContactDialog({
  selection,
  onClose,
}: TrainingContactDialogProps) {
  return (
    <div className="contact-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="contact-dialog-heading">
          <div>
            <p className="eyebrow">Kontakt</p>
            <h2 id="contact-dialog-title">{selection.athleteName}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Kontakte schließen">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="contact-dialog-list">
          {selection.contacts.map((contact) => (
            <article key={contact.id}>
              <div>
                <strong>{contact.contactName}</strong>
                <small>{[contact.relationship, contact.isEmergency ? "Notfallkontakt" : null].filter(Boolean).join(" · ")}</small>
              </div>
              <a className="primary-button link-button" href={`tel:${contact.phone}`}>
                <Phone aria-hidden="true" /> {contact.phone}
              </a>
              {contact.notes && <p>{contact.notes}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
