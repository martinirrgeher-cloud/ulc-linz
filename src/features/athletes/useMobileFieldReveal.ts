import { useCallback, useEffect, useRef, type FocusEventHandler } from "react";

const EDITABLE_FIELD_SELECTOR = "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']), select, textarea";

export function useMobileFieldReveal(): FocusEventHandler<HTMLElement> {
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return useCallback((event) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const target = event.target as HTMLElement | null;
    if (!target?.matches(EDITABLE_FIELD_SELECTOR)) return;

    clearTimers();
    const reveal = () => {
      if (!target.isConnected || document.activeElement !== target) return;
      const appHeader = document.querySelector<HTMLElement>(".app-header");
      const editorHeader = target.closest(".management-editor")
        ?.querySelector<HTMLElement>(".management-editor-sticky-header");
      const offset = (appHeader?.getBoundingClientRect().height ?? 66)
        + (editorHeader?.getBoundingClientRect().height ?? 0)
        + 10;
      const targetTop = Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset);
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    };

    timersRef.current = [80, 320].map((delay) => window.setTimeout(reveal, delay));
  }, [clearTimers]);
}
