import { UebungCard } from "./UebungCard";
import { Uebung } from "../hooks/useUebungen";

interface Props {
  hauptgruppe: string;
  unterMap: Map<string, Uebung[]>;
}

export function GruppeSection({ hauptgruppe, unterMap }: Props) {
  return (
    <section className="gruppe-section">
      <h2 className="hauptgruppe-title">{hauptgruppe}</h2>
      {[...unterMap.entries()].map(([untergruppe, uebungen]) => (
        <div key={untergruppe} className="untergruppe-section">
          <h3 className="untergruppe-title">{untergruppe}</h3>
          <div className="uebung-grid">
            {uebungen.map((u) => (
              <UebungCard key={u.id} uebung={u} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
