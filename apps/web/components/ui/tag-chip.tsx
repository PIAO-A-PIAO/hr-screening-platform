type TagChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
};

export function TagChip({ label, selected = false, disabled = false, onClick, onRemove }: TagChipProps) {
  const className = ["dsTag", selected && "dsTag-selected"].filter(Boolean).join(" ");
  const action = onRemove ?? onClick;

  if (!action) return <span className={className}>{label}</span>;

  return (
    <button
      className={className}
      type="button"
      disabled={disabled}
      aria-pressed={onClick ? selected : undefined}
      aria-label={onRemove ? `Remove ${label}` : undefined}
      onClick={action}
    >
      <span>{label}</span>
      {onRemove && <span className="dsTagRemove" aria-hidden="true">×</span>}
    </button>
  );
}
