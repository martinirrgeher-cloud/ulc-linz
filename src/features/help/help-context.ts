import routeContextData from "@/features/help/help-route-contexts.json";

export type HelpRouteContext = {
  path: string;
  topicId: string;
  sectionId?: string;
};

const routeContexts = [...(routeContextData as HelpRouteContext[])].sort(
  (left, right) => right.path.length - left.path.length,
);

export const HELP_ROUTE_CONTEXTS = routeContextData as HelpRouteContext[];

export function getHelpContext(pathname: string): HelpRouteContext {
  const normalizedPath = pathname.split(/[?#]/, 1)[0] || "/";
  const match = routeContexts.find((context) => {
    if (context.path === "/") return normalizedPath === "/";
    return normalizedPath === context.path || normalizedPath.startsWith(`${context.path}/`);
  });
  return match ?? { path: normalizedPath, topicId: "troubleshooting" };
}

export function safeHelpReturnPath(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.startsWith("/hilfe")) return null;
  return candidate;
}

export function buildHelpHref(
  pathname: string,
  sectionOverride?: string,
): string {
  const context = getHelpContext(pathname);
  return buildHelpTopicHref(
    context.topicId,
    sectionOverride ?? context.sectionId,
    pathname,
  );
}

export function buildHelpTopicHref(
  topicId: string,
  sectionId?: string,
  returnPath?: string | null,
): string {
  const params = new URLSearchParams();
  const safeReturnPath = safeHelpReturnPath(returnPath);
  if (safeReturnPath) params.set("from", safeReturnPath);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const hash = sectionId ? `#${encodeURIComponent(sectionId)}` : "";
  return `/hilfe/${encodeURIComponent(topicId)}${query}${hash}`;
}
