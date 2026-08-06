import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useBlocker } from "react-router-dom";

type NavigationGuard = () => boolean | Promise<boolean>;

type NavigationGuardContextValue = {
  registerGuard: (guard: NavigationGuard) => () => void;
  runGuard: () => Promise<boolean>;
  allowNextNavigation: () => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<NavigationGuard | null>(null);
  const pendingGuardRef = useRef<Promise<boolean> | null>(null);
  const bypassNextNavigationRef = useRef(false);
  const bypassTimerRef = useRef<number | null>(null);

  const registerGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;

    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);

  const runGuard = useCallback(async () => {
    if (pendingGuardRef.current) return pendingGuardRef.current;

    const guard = guardRef.current;
    if (!guard) return true;

    const pendingGuard = (async () => {
      try {
        return await guard();
      } catch {
        return false;
      }
    })();
    pendingGuardRef.current = pendingGuard;

    try {
      return await pendingGuard;
    } finally {
      if (pendingGuardRef.current === pendingGuard) pendingGuardRef.current = null;
    }
  }, []);

  const allowNextNavigation = useCallback(() => {
    bypassNextNavigationRef.current = true;
    if (bypassTimerRef.current !== null) window.clearTimeout(bypassTimerRef.current);
    bypassTimerRef.current = window.setTimeout(() => {
      bypassNextNavigationRef.current = false;
      bypassTimerRef.current = null;
    }, 2000);
  }, []);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const locationUnchanged =
      currentLocation.pathname === nextLocation.pathname
      && currentLocation.search === nextLocation.search
      && currentLocation.hash === nextLocation.hash;
    if (locationUnchanged) return false;

    if (bypassNextNavigationRef.current) {
      bypassNextNavigationRef.current = false;
      if (bypassTimerRef.current !== null) {
        window.clearTimeout(bypassTimerRef.current);
        bypassTimerRef.current = null;
      }
      return false;
    }

    return guardRef.current !== null;
  });
  const blockerState = blocker.state;

  useEffect(() => {
    if (blocker.state !== "blocked") return undefined;

    const blockedNavigation = blocker;
    let active = true;

    void runGuard().then((allowed) => {
      if (!active) return;
      if (allowed) blockedNavigation.proceed();
      else blockedNavigation.reset();
    });

    return () => {
      active = false;
    };
  }, [blockerState, runGuard]);

  useEffect(() => () => {
    if (bypassTimerRef.current !== null) window.clearTimeout(bypassTimerRef.current);
  }, []);

  const value = useMemo(
    () => ({ registerGuard, runGuard, allowNextNavigation }),
    [allowNextNavigation, registerGuard, runGuard],
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(guard: NavigationGuard | null) {
  const context = useContext(NavigationGuardContext);

  useEffect(() => {
    if (!context || !guard) return undefined;
    return context.registerGuard(guard);
  }, [context, guard]);
}

export function useNavigationGuardController() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error("NavigationGuardProvider fehlt im Layout.");
  }

  return context;
}
