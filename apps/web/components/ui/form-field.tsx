import type { ReactNode } from "react";

type FormFieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  optional?: boolean;
};

export function FormField({ id, label, children, hint, error, optional = false }: FormFieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="dsFormField">
      <label className="dsFormLabel" htmlFor={id}>
        <span>{label}</span>
        {optional && <span className="dsFormOptional">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="dsFormError" id={descriptionId} role="alert">{error}</p>
      ) : hint ? (
        <p className="dsFormHint" id={descriptionId}>{hint}</p>
      ) : null}
    </div>
  );
}

export function formControlA11y(id: string, options: { error?: string; hint?: string }) {
  return {
    id,
    "aria-invalid": options.error ? true : undefined,
    "aria-describedby": options.error ? `${id}-error` : options.hint ? `${id}-hint` : undefined,
  };
}
