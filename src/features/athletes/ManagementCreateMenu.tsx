import { ChevronDown, Layers3, Plus, UserRound, UserRoundCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CreateTarget = "athletes" | "groups" | "trainers";

type ManagementCreateMenuProps = {
  disabled: boolean;
  onCreate: (target: CreateTarget) => void;
};

const items = [
  { key: "athletes", label: "Athlet anlegen", Icon: UserRound },
  { key: "groups", label: "Gruppe anlegen", Icon: Layers3 },
  { key: "trainers", label: "Trainer anlegen", Icon: UserRoundCog },
] as const;

export function ManagementCreateMenu({ disabled, onCreate }: ManagementCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="masterdata-create-menu" ref={rootRef}>
      <button
        type="button"
        className={`primary-button masterdata-create-menu-toggle ${open ? "active" : ""}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Stammdaten anlegen"
        data-testid="masterdata-create-menu-toggle"
      >
        <Plus aria-hidden="true" />
        Neu
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="masterdata-create-menu-panel" role="menu" aria-label="Stammdaten anlegen">
          {items.map(({ key, label, Icon }) => (
            <button
              type="button"
              role="menuitem"
              data-testid={`masterdata-create-${key}`}
              onClick={() => {
                setOpen(false);
                onCreate(key);
              }}
              key={key}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
