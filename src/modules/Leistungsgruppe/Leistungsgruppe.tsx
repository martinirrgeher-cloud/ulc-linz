export default function Leistungsgruppe({ data, onSave }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Leistungsgruppe</h2>
      <p>Hier kommen Leistungsdaten & Analysen.</p>
      <button
        onClick={() =>
          onSave({ ...data, module: "Leistungsgruppe", updated: Date.now() })
        }
        className="bg-green-600 text-white px-3 py-1 rounded mt-3"
      >
        💾 Speichern
      </button>
    </div>
  );
}
