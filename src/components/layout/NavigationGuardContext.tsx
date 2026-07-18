import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

type NavigationGuard = () => boolean | Promise<boolean>;

type NavigationGuardContextValue = {
  registerGuard: (guard: NavigationGuard) => () => void;
  runGuard: () => Promise<boolean>;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<NavigationGuard | null>(null);

  const registerGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;

    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);

  const runGuard = useCallback(async () => {
    const guard = guardRef.current;
    if (!guard) return true;

    try {
      return await guard();
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({ registerGuard, runGuard }),
    [registerGuard, runGuard],
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
