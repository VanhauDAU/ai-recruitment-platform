import { LinkOutlined } from '@ant-design/icons'
import { Empty, Typography } from 'antd'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import { displayProfileValue, isProfileValueEmpty, isScalarProfileField } from '../model/profile-value'

const LINK_FIELDS = new Set(['website_url', 'portfolio_url', 'github_url', 'linkedin_url'])

function FieldValue({ field, value }) {
  if (isProfileValueEmpty(value)) {
    return <span className="account-fields__empty">{displayProfileValue(field, value)}</span>
  }
  if (LINK_FIELDS.has(field)) {
    return (
      <a
        className="account-profile__link"
        href={String(value)}
        target="_blank"
        rel="noreferrer noopener"
      >
        <LinkOutlined />
        <span>{String(value)}</span>
      </a>
    )
  }
  return displayProfileValue(field, value)
}

/** Label-above-value grid; columns follow the available width instead of a fixed table. */
export function ProfileFieldGrid({ data, labels }) {
  const entries = Object.entries(labels).filter(([key]) => isScalarProfileField(data?.[key]))
  if (!entries.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
  return (
    <dl className="account-fields">
      {entries.map(([key, label]) => (
        <div key={key} className="account-fields__item">
          <dt>{label}</dt>
          <dd><FieldValue field={key} value={data[key]} /></dd>
        </div>
      ))}
    </dl>
  )
}

/** A titled group of fields inside a panel; `title` stays a heading so the panel reads as an outline. */
export function ProfileFieldSection({ title, extra, children }) {
  return (
    <section className="account-section">
      <div className="account-section__heading">
        <h3>{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function ProfileRichTextBlock({ label, html }) {
  return (
    <ProfileFieldSection title={label}>
      {isProfileValueEmpty(html) ? (
        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
      ) : (
        <div
          className="account-profile__richtext-body"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
      )}
    </ProfileFieldSection>
  )
}
