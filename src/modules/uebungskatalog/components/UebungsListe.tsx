import React, { useState, useMemo } from "react";
import UebungCard from "./UebungCard";

export default function UebungsListe({ titel, uebungen }:{ titel:string; uebungen:any[] }) {
  const [visible, setVisible] = useState(15);
  const list = useMemo(() => (uebungen ?? []), [uebungen]);
  const canMore = visible < list.length;

  return (
    <section className="uk-list-section">
      <div className="uk-list-head">
        <h3>{titel}</h3>
        <div className="uk-hint">es werden {Math.min(visible, list.length)} von {list.length} angezeigt</div>
      </div>

      <div className="uk-cards-grid">
        {list.slice(0, visible).map((u) => <UebungCard key={u.id} uebung={u} />)}
        {!list.length && <p>Keine Übungen gefunden.</p>}
      </div>

      {canMore && (
        <button className="uk-btn-more" onClick={() => setVisible(v => v + 15)}>Mehr anzeigen</button>
      )}
    </section>
  );
}
