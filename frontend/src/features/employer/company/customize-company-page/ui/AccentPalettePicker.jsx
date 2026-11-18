/** Bảng màu nhấn từ `registry.accents`; radio gốc của trình duyệt lo bàn phím và ngữ nghĩa. */
export default function AccentPalettePicker({ accents, value, disabled = false, onChange }) {
  return (
    <fieldset className="company-accent-picker" disabled={disabled}>
      <legend className="sr-only">Màu nhấn của trang công ty</legend>
      {accents.map((accent) => (
        <label key={accent.key} className={`company-accent-option ${accent.key === value ? 'company-accent-option--active' : ''}`}>
          <input
            type="radio"
            name="company-page-accent"
            className="sr-only"
            value={accent.key}
            checked={accent.key === value}
            onChange={() => onChange(accent.key)}
          />
          <span className="company-accent-option__swatch" style={{ background: accent.primary }} aria-hidden="true" />
          {accent.label}
        </label>
      ))}
    </fieldset>
  )
}
