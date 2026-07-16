export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  /** Kompatibilitätsfeld für alte Module */
  name: string;
  geburtsjahr?: number;
  altersklasse?: string; // vormals leistungsgruppe
  info?: string;
  active: boolean;
  anmeldung: any[];
  plaene: any[];
  feedback: any[];
  updatedAt?: string;
}

export interface AthletenDatei {
  version: number;
  athletes: Athlete[];
  updatedAt?: string;
}
