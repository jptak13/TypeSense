export function SegmentedControl({ label, options, value, onChange, className = '' }) {
  return (
    <div className={`control-group ${className}`}>
      <span className="control-label">{label}</span>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} className={value === option.value ? 'active' : ''}
            aria-pressed={value === option.value}
            onClick={() => value !== option.value && onChange(option.value)}>
            <span>{option.label}</span>
            {option.detail && <small>{option.detail}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
