import { CircleHelp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { buildHelpHref } from "@/features/help/help-context";

export function PublicHelpButton() {
  const location = useLocation();
  const pathname = location.pathname;
  const hasProtectedHeader =
    pathname === "/" || pathname.startsWith("/module/") || pathname.startsWith("/hilfe");

  if (hasProtectedHeader) return null;

  return (
    <Link
      className="public-help-button"
      to={buildHelpHref(`${pathname}${location.search}`)}
      aria-label="Hilfe für diese Seite"
      title="Hilfe für diese Seite"
    >
      <CircleHelp aria-hidden="true" />
    </Link>
  );
}
