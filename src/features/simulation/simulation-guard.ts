export const SIMULATION_WRITE_BLOCKED_CODE = "SIMULATION_WRITE_BLOCKED";

let simulationActive = false;
let simulatedDisplayName: string | null = null;

export class SimulationWriteBlockedError extends Error {
  readonly code = SIMULATION_WRITE_BLOCKED_CODE;

  constructor(action = "Diese Änderung") {
    super(`Simulation aktiv – ${action} wurde nicht gespeichert.`);
    this.name = "SimulationWriteBlockedError";
  }
}

export function setSimulationWriteGuard(active: boolean, displayName: string | null = null): void {
  simulationActive = active;
  simulatedDisplayName = active ? displayName : null;
}

export function isSimulationWriteGuardActive(): boolean {
  return simulationActive;
}

export function getSimulatedDisplayName(): string | null {
  return simulatedDisplayName;
}

export function assertSimulationWriteAllowed(action?: string): void {
  if (simulationActive) throw new SimulationWriteBlockedError(action);
}

export function isSimulationWriteBlockedError(error: unknown): error is SimulationWriteBlockedError {
  if (error instanceof SimulationWriteBlockedError) return true;
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === SIMULATION_WRITE_BLOCKED_CODE;
}
