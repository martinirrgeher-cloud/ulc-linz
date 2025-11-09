import React from "react";
import { useAuth } from "@/store/AuthContext";

const MODULES = [
  { key: "KINDERTRAINING", label: "Kindertraining", to: "/kindertraining" },
  { key: "LEISTUNGSGRUPPE-ANMELDUNG", label: "Leistungsgruppe Anmeldung", to: "/leistungsgruppe/anmeldung" },
  { key: "UEBUNGSKATALOG", label: "Übungskatalog", to: "/uebungskatalog" },
  { key: "UEBUNGSPFLEGE", label: "Übungspflege", to: "/uebungspflege" },
  { key: "ATHLETEN", label: "Athleten", to: "/athleten" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const allowed = MODULES.filter(m => (user?.modules ?? []).includes(m.key));
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Module</h1>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {allowed.map(m => (
          <li key={m.key}>
            <a className="block rounded-xl border p-3 hover:shadow" href={m.to}>{m.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
