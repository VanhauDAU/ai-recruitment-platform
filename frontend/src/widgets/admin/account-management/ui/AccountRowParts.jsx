import { EditOutlined, EyeOutlined, MoreOutlined, SafetyCertificateOutlined, SolutionOutlined } from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'
import { m } from '@/shared/config/i18n'

function initials(value) {
  return (value || '?').split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()
}

// Avatar, name and email; opens the quick view. `meta` adds one muted line.
export function AccountIdentity({ row, meta, onQuickView }) {
  const name = row.full_name || row.email
  return (
    <button
      type="button"
      className="aml-identity"
      aria-label={m.admin_account_list_quick_view_of({ name })}
      onClick={() => onQuickView(row)}
    >
      <Avatar size={36} src={row.avatar_url || undefined}>{initials(name)}</Avatar>
      <span className="aml-identity__text">
        <span className="wt-title aml-truncate">{row.full_name || m.admin_account_list_no_name()}</span>
        <span className="wt-meta"><span className="aml-truncate">{row.email}</span></span>
        {meta && <span className="wt-meta"><span className="ws-muted aml-truncate" title={meta}>{meta}</span></span>}
      </span>
    </button>
  )
}

// On a narrow table each cell carries its own label; a wide one has a header.
export function Stat({ label, children }) {
  return (
    <div className="wt-cell">
      <span className="wt-label">{label}</span>
      {children}
    </div>
  )
}

export function AccountRowActions({ row, onQuickView, onOpenDetail, onEdit, onSecurity, canEdit, canManageSecurity }) {
  const items = [
    ...(canEdit(row) ? [{ key: 'edit', icon: <EditOutlined />, label: m.admin_account_list_edit(), onClick: () => onEdit(row) }] : []),
    ...(canManageSecurity(row) ? [{ key: 'security', icon: <SafetyCertificateOutlined />, label: m.admin_account_list_security(), onClick: () => onSecurity(row) }] : []),
  ]
  return (
    <div className="wt-cell wt-cell--actions">
      <div className="wt-actions aml-actions">
        <button type="button" className="wt-btn wt-btn--primary" onClick={() => onQuickView(row)}>
          <EyeOutlined aria-hidden /><span>{m.admin_account_list_quick_view()}</span>
        </button>
        <button type="button" className="wt-btn aml-icon" aria-label={m.admin_account_list_detail()} title={m.admin_account_list_detail()} onClick={() => onOpenDetail(row)}>
          <SolutionOutlined aria-hidden />
        </button>
        {items.length > 0 && (
          <Dropdown menu={{ items }} trigger={['click']}>
            <button type="button" className="wt-btn aml-icon" aria-label={m.admin_account_list_more()} title={m.admin_account_list_more()}>
              <MoreOutlined aria-hidden />
            </button>
          </Dropdown>
        )}
      </div>
    </div>
  )
}
