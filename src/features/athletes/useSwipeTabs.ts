import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type PointerEventHandler } from "react";

type SwipeableTabOptions<T extends string> = {
  tabs: readonly T[];
  activeTab: T;
  onChange: (tab: T) => void;
  enabled?: boolean;
  threshold?: number;
};

type SwipeState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
};

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[data-swipe-ignore='true']",
].join(",");

export function useSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  enabled = true,
  threshold = 56,
}: SwipeableTabOptions<T>) {
  const swipeRef = useRef<SwipeState>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  return useMemo(() => {
    const resetSwipe = () => {
      swipeRef.current.active = false;
      swipeRef.current.pointerId = null;
    };

    const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
      const target = event.target as Element | null;
      const ignored =
        !enabled
        || !event.isPrimary
        || event.pointerType !== "touch"
        || Boolean(target?.closest(INTERACTIVE_SELECTOR));

      swipeRef.current = {
        active: !ignored,
        pointerId: ignored ? null : event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
      };

      if (!ignored) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Some test environments do not implement pointer capture.
        }
      }
    };

    const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
      const swipe = swipeRef.current;
      if (!swipe.active || swipe.pointerId !== event.pointerId) return;
      swipe.lastX = event.clientX;
      swipe.lastY = event.clientY;
    };

    const finishSwipe = (event: ReactPointerEvent<HTMLElement>) => {
      const swipe = swipeRef.current;
      if (!swipe.active || swipe.pointerId !== event.pointerId || !enabled) {
        resetSwipe();
        return;
      }

      swipe.lastX = event.clientX;
      swipe.lastY = event.clientY;
      resetSwipe();

      const deltaX = swipe.lastX - swipe.startX;
      const deltaY = swipe.lastY - swipe.startY;
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex < 0) return;
      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextTab = tabs[nextIndex];
      if (nextTab) onChange(nextTab);
    };

    const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
      finishSwipe(event);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may not exist in synthetic browser tests.
      }
    };

    const onPointerCancel: PointerEventHandler<HTMLElement> = () => {
      resetSwipe();
    };

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
  }, [activeTab, enabled, onChange, tabs, threshold]);
}
