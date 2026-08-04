import { useState } from "react";
import { loadTrainingBlockVersions } from "@/features/training-blocks/api";
import type { TrainingBlock, TrainingBlockVersion } from "@/features/training-blocks/types";

export type TrainingBlockVersionHistoryProps = {
  organizationId: string;
  block: TrainingBlock;
};

function versionReason(version: TrainingBlockVersion): string {
  if (version.reason === "variant_created") return "Variante angelegt";
  if (version.reason === "created") return "Angelegt";
  return "Gespeichert";
}

export function TrainingBlockVersionHistory({
  organizationId,
  block,
}: TrainingBlockVersionHistoryProps) {
  const [versions, setVersions] = useState<TrainingBlockVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureLoaded(open: boolean) {
    if (!open || loading || versions !== null || block.versionCount === 0) return;
    setLoading(true);
    setError(null);
    try {
      setVersions(await loadTrainingBlockVersions(organizationId, block.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Der Versionsverlauf konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  if (block.versionCount === 0) return null;

  return (
    <details onToggle={(event) => void ensureLoaded(event.currentTarget.open)}>
      <summary>Versionsverlauf ({block.versionCount})</summary>
      {loading ? (
        <p>Versionen werden geladen …</p>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : versions && versions.length > 0 ? (
        <ol>
          {versions.map((version) => (
            <li key={version.id}>
              <strong>Version {version.versionNumber}</strong>
              {" · "}{versionReason(version)}
              {" · "}{new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(new Date(version.createdAt))}
              <small>
                {" · "}{version.snapshot.itemCount} Übung{version.snapshot.itemCount === 1 ? "" : "en"}
                {version.snapshot.estimatedMinutes ? ` · ${version.snapshot.estimatedMinutes} min` : ""}
                {version.snapshot.inactiveExerciseCount > 0 ? ` · ${version.snapshot.inactiveExerciseCount} inaktiv` : ""}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p>Keine Versionen gefunden.</p>
      )}
    </details>
  );
}
