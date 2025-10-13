export default function U14({ data, onSave }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">U14</h2>
      <p>Trainingsverwaltung für U14.</p>
      <button
        onClick={() => onSave({ ...data, module: "U14", updated: Date.now() })}
        className="bg-green-600 text-white px-3 py-1 rounded mt-3"
      >
        💾 Speichern
      </button>
    </div>
  );
}
