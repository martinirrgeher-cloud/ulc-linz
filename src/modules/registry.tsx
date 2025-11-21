import { ReactNode } from "react";
import { Calendar, Users, Dumbbell, FilePlus, BookOpen, LayoutList } from "lucide-react";

export type ModuleKey =
  | "KINDERTRAINING"
  | "LEISTUNGSGRUPPE-ANMELDUNG"
  | "UEBUNGSKATALOG"
  | "UEBUNGSPFLEGE"
  | "ATHLETEN"
  | "TRAININGSPLAN"
  | "TRAININGSDOKU"
  | "TRAININGSBLOECKE";

export type AppModule = {
  key: ModuleKey;
  title: string;
  description?: string;
  route: string;
  icon?: ReactNode;
};

export const MODULES: AppModule[] = [
  {
    key: "KINDERTRAINING",
    title: "Kindertraining",
    description: "Anwesenheit & Notizen",
    route: "/kindertraining",
    icon: <Users size={18} />,
  },
  {
    key: "LEISTUNGSGRUPPE-ANMELDUNG",
    title: "Anmeldung",
    description: "Wochenweise Anmeldung",
    route: "/leistungsgruppe/anmeldung",
    icon: <Calendar size={18} />,
  },
  {
    key: "UEBUNGSKATALOG",
    title: "Übungskatalog",
    description: "Kategorien & Suche",
    route: "/uebungskatalog",
    icon: <BookOpen size={18} />,
  },
  {
    key: "UEBUNGSPFLEGE",
    title: "Übung hinzufügen",
    description: "Pflege & Uploads",
    route: "/uebungspflege",
    icon: <FilePlus size={18} />,
  },
  {
    key: "ATHLETEN",
    title: "Athleten",
    description: "Verwaltung",
    route: "/athleten",
    icon: <LayoutList size={18} />,
  },
  {
    key: "TRAININGSPLAN",
    title: "Trainingsplanung",
    description: "Pläne je Athlet/Tag",
    route: "/leistungsgruppe/plan",
    icon: <Dumbbell size={18} />,
  },
  {
    key: "TRAININGSBLOECKE",
    title: "Trainingsblöcke",
    description: "Vorlagen für Blöcke",
    route: "/leistungsgruppe/bloecke",
    icon: <LayoutList size={18} />,
  },
  {
    key: "TRAININGSDOKU",
    title: "Trainingsdoku",
    description: "Abarbeiten & Analyse",
    route: "/leistungsgruppe/doku",
    icon: <Dumbbell size={18} />,
  },
];

export const moduleByRoute = new Map(MODULES.map((m) => [m.route, m]));
