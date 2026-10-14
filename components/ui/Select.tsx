import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, id, ...props }: SelectProps) {
  const resolvedId = id ?? props.name;
  return (
    <label className="field" htmlFor={resolvedId}>
      <span className="field__label">{label}</span>
      <select className="field__control" id={resolvedId} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
