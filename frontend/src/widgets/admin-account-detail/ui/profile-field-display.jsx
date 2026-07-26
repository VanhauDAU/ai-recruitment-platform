import { LinkOutlined } from '@ant-design/icons'
import { Descriptions, Empty, Typography } from 'antd'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import { displayProfileValue, isProfileValueEmpty } from '../model/profile-value'

const LINK_FIELDS = new Set(['website_url', 'portfolio_url', 'github_url', 'linkedin_url'])

function FieldValue({ field, value }) {
  if (LINK_FIELDS.has(field) && !isProfileValueEmpty(value)) {
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

export function ProfileFieldGrid({ data, labels }) {
  const entries = Object.entries(labels).filter(([key]) => {
    const value = data?.[key]
    return value !== undefined && (Array.isArray(value) || typeof value !== 'object')
  })
  if (!entries.length) return <Empty description="Chưa có dữ liệu" />
  return (
    <Descriptions
      bordered
      size="small"
      className="account-profile__grid"
      column={{ xs: 1, md: 2 }}
    >
      {entries.map(([key, label]) => (
        <Descriptions.Item key={key} label={label}>
          <FieldValue field={key} value={data[key]} />
        </Descriptions.Item>
      ))}
    </Descriptions>
  )
}

export function ProfileRichTextBlock({ label, html }) {
  return (
    <section className="account-profile__richtext">
      <h4>{label}</h4>
      {isProfileValueEmpty(html) ? (
        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
      ) : (
        <div
          className="account-profile__richtext-body"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
      )}
    </section>
  )
}
