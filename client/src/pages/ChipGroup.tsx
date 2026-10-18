import styles from './Lobby.module.css';

type Option = { value: string; label: string; hint?: string };

// A row of pill buttons behaving as a single-choice radio group.
export function ChipGroup({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.chips}>
        {options.map((o) => (
          <label key={o.value} className={`${styles.chip} ${o.value === value ? styles.chipOn : ''}`}>
            <input type="radio" name={label} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
