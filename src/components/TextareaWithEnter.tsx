import React from "react";

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onEnter?: (value: string) => void;
}

const TextareaWithEnter = React.forwardRef<HTMLTextAreaElement, Props>(function TextareaWithEnter(
  { onEnter, onKeyUp, ...props }, ref
) {
  return (
    <textarea
      {...props}
      ref={ref}
      onKeyUp={(e) => {
        if (onKeyUp) onKeyUp(e);
        if (e.key === "Enter" && !e.shiftKey && onEnter) {
          e.preventDefault();
          const value = (e.target as HTMLTextAreaElement).value;
          onEnter(value);
        }
      }}
    />
  );
});

export default TextareaWithEnter;
