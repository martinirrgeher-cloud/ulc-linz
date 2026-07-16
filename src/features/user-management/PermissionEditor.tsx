import type { AppRole } from "@/types/auth";
import type {
  ManagedModule,
  ManagedPermission,
} from "@/features/user-management/types";

export type PermissionEditorProps = {
  modules: ManagedModule[];
  permissions: ManagedPermission[];
  role: AppRole;
  disabled?: boolean;
  onChange: (permissions: ManagedPermission[]) => void;
};

function permissionFor(
  permissions: ManagedPermission[],
  moduleKey: string,
): ManagedPermission {
  return (
    permissions.find((permission) => permission.moduleKey === moduleKey) ?? {
      moduleKey,
      canView: false,
      canEdit: false,
    }
  );
}

export function PermissionEditor({
  modules,
  permissions,
  role,
  disabled = false,
  onChange,
}: PermissionEditorProps) {
  const isAdmin = role === "admin";

  function updatePermission(
    moduleKey: string,
    field: "canView" | "canEdit",
    checked: boolean,
  ) {
    const next = modules.map((module) => {
      const current = permissionFor(permissions, module.key);
      if (module.key !== moduleKey) return current;

      if (field === "canEdit") {
        return {
          ...current,
          canEdit: checked,
          canView: checked ? true : current.canView,
        };
      }

      return {
        ...current,
        canView: checked,
        canEdit: checked ? current.canEdit : false,
      };
    });

    onChange(next);
  }

  return (
    <fieldset className="permission-editor" disabled={disabled || isAdmin}>
      <legend>Modulrechte</legend>
      {isAdmin && (
        <p className="field-hint">
          Administratoren besitzen automatisch Lese- und Bearbeitungsrechte für alle Module.
        </p>
      )}
      <div className="permission-table" role="table" aria-label="Modulrechte">
        <div className="permission-row permission-header" role="row">
          <span role="columnheader">Modul</span>
          <span role="columnheader">Lesen</span>
          <span role="columnheader">Bearbeiten</span>
        </div>
        {modules.map((module) => {
          const permission = permissionFor(permissions, module.key);
          const isUserManagement = module.key === "user_management";
          const canView = isAdmin ? true : permission.canView;
          const canEdit = isAdmin ? true : permission.canEdit;

          return (
            <div className="permission-row" role="row" key={module.key}>
              <div className="permission-module" role="cell">
                <strong>{module.title}</strong>
                {module.description && <small>{module.description}</small>}
                {isUserManagement && !isAdmin && (
                  <small className="permission-note">Nur für Administratoren</small>
                )}
              </div>
              <label className="check-cell" role="cell">
                <input
                  type="checkbox"
                  checked={canView}
                  disabled={disabled || isAdmin || isUserManagement}
                  onChange={(event) =>
                    updatePermission(module.key, "canView", event.target.checked)
                  }
                  aria-label={`${module.title} lesen`}
                />
              </label>
              <label className="check-cell" role="cell">
                <input
                  type="checkbox"
                  checked={canEdit}
                  disabled={disabled || isAdmin || isUserManagement}
                  onChange={(event) =>
                    updatePermission(module.key, "canEdit", event.target.checked)
                  }
                  aria-label={`${module.title} bearbeiten`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
