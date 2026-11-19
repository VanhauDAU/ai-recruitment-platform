import { sanitizeHtml } from '@/shared/lib/sanitize-html'

const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)

function Value({ kind, value, side }) {
  if (isEmpty(value)) return <span className="content-change-diff__empty">Trống</span>
  if (kind === 'html') {
    return <div className="content-change-diff__html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />
  }
  if (kind === 'image' || kind === 'images') {
    const urls = kind === 'image' ? [value] : value
    return (
      <div className="content-change-diff__images">
        {urls.map((url, index) => <img key={url} src={url} alt={`Ảnh ${side} ${index + 1}`} loading="lazy" />)}
      </div>
    )
  }
  if (kind === 'list') return <ul className="content-change-diff__list">{value.map((item) => <li key={item}>{item}</li>)}</ul>
  return <p className="content-change-diff__text">{value}</p>
}

/** Từng trường đã đổi, trước và sau, đúng như đang/đã hiển thị trên trang công ty. */
export default function ContentChangeDiff({ fields }) {
  return (
    <dl className="content-change-diff">
      {fields.map(({ field, label, kind, before, after }) => (
        <div key={field} className="content-change-diff__row">
          <dt className="content-change-diff__label">{label}</dt>
          <dd className="content-change-diff__side">
            <span className="content-change-diff__caption">Trước</span>
            <Value kind={kind} value={before} side="trước" />
          </dd>
          <dd className="content-change-diff__side content-change-diff__side--after">
            <span className="content-change-diff__caption">Sau</span>
            <Value kind={kind} value={after} side="sau" />
          </dd>
        </div>
      ))}
    </dl>
  )
}
