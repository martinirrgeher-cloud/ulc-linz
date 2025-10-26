import { ISOWeekDay } from "./TrainingsplanTypes";

export interface Anmeldung {
  athletId: string;
  kw: number;
  jahr: number;
  tag: ISOWeekDay;
  zusage: "ja" | "nein" | "vielleicht" | "";
  notiz?: string;
}
