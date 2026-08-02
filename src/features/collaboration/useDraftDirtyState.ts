import { useEffect, useRef } from "react";

export function useDraftDirtyState<T>(
  value: T,
  onDirtyChange: ((dirty: boolean) => void) | undefined,
): void {
  const initialValueRef = useRef(JSON.stringify(value));

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(value) !== initialValueRef.current);
  }, [onDirtyChange, value]);

  useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);
}
