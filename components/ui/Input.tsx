import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, id, ...props }: InputProps) {
  const resolvedId = id ?? props.name;
  return (
    <label className="field" htmlFor={resolvedId}>
      <span className="field__label">{label}</span>
      <input className="field__control" id={resolvedId} {...props} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}
