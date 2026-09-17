type SpinnerProps = {
  size?: "small" | "medium" | "large";
  label?: string;
};

export function Spinner({ size = "medium", label = "Loading" }: SpinnerProps) {
  const sizeClass = size === "small" ? "dsSpinner-sm" : size === "large" ? "dsSpinner-lg" : "";
  return <span className={`dsSpinner ${sizeClass}`} role="status" aria-label={label} />;
}
