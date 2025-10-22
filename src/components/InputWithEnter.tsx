import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Wird ausgelöst, wenn Enter gedrückt wurde (nachdem der Input den neuesten Wert hat). */
  onEnter?: (value: string) => void;
}

const InputWithEnter = React.forwardRef<HTMLInputElement, Props>(function InputWithEnter(
  { onEnter, onKeyUp, ...props }, ref
) {
  return (
    <input
      {...props}
      ref={ref}
      onKeyUp={(e) => {
        if (onKeyUp) onKeyUp(e);
        if (e.key === "Enter" && onEnter) {
          const value = (e.target as HTMLInputElement).value;
          onEnter(value);
        }
      }}
    />
  );
});

export default InputWithEnter;
