import { DiffOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import { Alert, Empty, Tag } from 'antd'
import { useMemo } from 'react'
import { formatAdminJobDate, formatAdminJobDateTime } from '@/entities/admin-job'
import { normalizeRichTextHtml } from '@/shared/lib/rich-text-html'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import AdminJobPanel from './AdminJobPanel'

function RichValue({ html }) {
  const safeHtml = useMemo(
    () => sanitizeHtml(normalizeRichTextHtml(html || '')),
    [html],
  )
  if (!safeHtml) return <p className="admin-job-change__empty">Chưa cung cấp</p>
  return (
    <div
      className="admin-job-rich-content"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}

function ListValue({ items, comparedTo, tone }) {
  if (!items?.length) return <p className="admin-job-change__empty">Chưa cung cấp</p>
  return (
    <div className="admin-job-change__tags">
      {items.map((item) => (
        <Tag color={comparedTo?.includes(item) ? undefined : tone} key={item}>{item}</Tag>
      ))}
    </div>
  )
}

function ChangeValue({ change, side }) {
  const value = side === 'before' ? change.before : change.after
  if (change.kind === 'rich') return <RichValue html={value} />
  if (change.kind === 'date') return <p>{formatAdminJobDate(value)}</p>
  if (change.kind === 'list') {
    return (
      <ListValue
        comparedTo={side === 'before' ? change.after : change.before}
        items={value}
        tone={side === 'before' ? 'red' : 'green'}
      />
    )
  }
  return value ? <p>{value}</p> : <p className="admin-job-change__empty">Chưa cung cấp</p>
}

export default function AdminJobChangeReview({ job }) {
  const contentChanges = job.content_changes || {}
  const changes = contentChanges.changes || []
  const badge = contentChanges.has_baseline
    ? `${contentChanges.changed_count || 0} thay đổi`
    : 'Chưa có bản gốc'

  return (
    <AdminJobPanel
      badge={badge}
      description="Đối chiếu nội dung hiện tại với nội dung của lần đăng gần nhất"
      icon={<DiffOutlined />}
      title="Thay đổi sau khi đăng"
    >
      {!contentChanges.has_baseline ? (
        <Alert
          description="Tin chưa có bản nội dung được lưu ở lần đăng, nên không có gì để đối chiếu. Từ lần đăng kế tiếp, mọi chỉnh sửa của nhà tuyển dụng sẽ được liệt kê tại đây."
          showIcon
          title="Chưa có bản đã đăng để so sánh"
          type="info"
        />
      ) : (
        <>
          <p className="admin-job-change__baseline">
            So với bản đăng lúc {formatAdminJobDateTime(contentChanges.baseline_captured_at)}
          </p>
          {contentChanges.hidden_sensitive_count > 0 && (
            <p className="admin-job-change__restricted">
              <EyeInvisibleOutlined /> {contentChanges.hidden_sensitive_count} thay đổi thuộc thông tin
              liên hệ bị ẩn theo quyền của bạn.
            </p>
          )}
          {changes.length ? (
            <div className="admin-job-change-list">
              {changes.map((change) => (
                <article className="admin-job-change" key={change.key}>
                  <h3>{change.label}</h3>
                  <div className="admin-job-change__columns">
                    <div className="admin-job-change__side admin-job-change__side--before">
                      <span>Bản đã đăng</span>
                      <ChangeValue change={change} side="before" />
                    </div>
                    <div className="admin-job-change__side admin-job-change__side--after">
                      <span>Bản hiện tại</span>
                      <ChangeValue change={change} side="after" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              description="Nội dung trùng khớp bản đã đăng"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </>
      )}
    </AdminJobPanel>
  )
}
