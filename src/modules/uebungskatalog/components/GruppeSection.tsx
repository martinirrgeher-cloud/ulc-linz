import UebungCard from "./UebungCard";

interface Uebung {
  id: string;
  name: string;
  hauptgruppe: string;
  untergruppe: string;
  difficulty: number;
  mediaUrl?: string;
  mediaType?: string;
}

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
              <UebungCard
                key={u.id}
                uebung={u}
                onClick={(id) => console.log("Übung geklickt:", id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
