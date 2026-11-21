import {
  ApiOutlined, AuditOutlined, BgColorsOutlined, ControlOutlined, DatabaseOutlined, FileTextOutlined,
  GlobalOutlined, HomeOutlined, IdcardOutlined, LayoutOutlined, MailOutlined, PhoneOutlined,
  ReadOutlined, RobotOutlined, SafetyOutlined, SolutionOutlined, TeamOutlined, ToolOutlined,
} from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import './site-settings.css'

const GROUP_ICONS = {
  brand: BgColorsOutlined,
  homepage: HomeOutlined,
  seo: GlobalOutlined,
  contact: PhoneOutlined,
  footer: LayoutOutlined,
  blog: ReadOutlined,
  accounts: IdcardOutlined,
  employer: TeamOutlined,
  jobs: SolutionOutlined,
  applications: AuditOutlined,
  cv: FileTextOutlined,
  email: MailOutlined,
  ai: RobotOutlined,
  legal: SafetyOutlined,
  retention: DatabaseOutlined,
  features: ControlOutlined,
  operations: ToolOutlined,
}

/** Thanh bên chia khu (desktop) / dải chip cuộn ngang (mobile); số = mục khớp tìm kiếm. */
export default function SettingsGroupNav({ groups, activeKey, dirtyGroups, errorGroups, counts, onSelect }) {
  const areas = []
  groups.forEach((group) => {
    const area = areas.find((item) => item.key === group.area)
    if (area) area.groups.push(group)
    else areas.push({ key: group.area, label: group.area_label, groups: [group] })
  })

  return (
    <nav className="settings-nav" aria-label={m.admin_settings_nav_label()}>
      {areas.map((area) => (
        <div key={area.key} className="settings-nav__area">
          <p className="settings-nav__area-label">{area.label}</p>
          {area.groups.map((group) => {
            const Icon = GROUP_ICONS[group.key] || ApiOutlined
            const active = group.key === activeKey
            return (
              <button
                key={group.key}
                type="button"
                className={`settings-nav__item${active ? ' settings-nav__item--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(group.key)}
              >
                <Icon aria-hidden="true" />
                <span className="settings-nav__label">{group.label}</span>
                {counts && <span className="settings-nav__count">{counts[group.key] || 0}</span>}
                {errorGroups.has(group.key) ? (
                  <span className="settings-nav__dot settings-nav__dot--error" aria-hidden="true" />
                ) : dirtyGroups.has(group.key) && (
                  <span className="settings-nav__dot" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
