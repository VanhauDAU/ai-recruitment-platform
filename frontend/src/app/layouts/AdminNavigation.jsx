import {
  AppstoreOutlined,
  ContactsOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  IdcardOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Menu } from 'antd'
import { useEffect, useMemo, useState } from 'react'

const ICONS = {
  access: <KeyOutlined />,
  account: <IdcardOutlined />,
  accounts: <TeamOutlined />,
  cv: <FileTextOutlined />,
  blog: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  leads: <ContactsOutlined />,
  moderation: <FileDoneOutlined />,
  services: <SolutionOutlined />,
  settings: <SettingOutlined />,
  shield: <SafetyCertificateOutlined />,
}

const NAVIGATION_SECTIONS = [
  {
    key: 'content',
    label: 'Nội dung & kiểm duyệt',
    icon: <FileDoneOutlined />,
    routeIcons: ['cv', 'moderation', 'blog'],
  },
  {
    key: 'commercial',
    label: 'Dịch vụ & khách hàng',
    icon: <ContactsOutlined />,
    routeIcons: ['services', 'leads'],
  },
  {
    key: 'accounts',
    label: 'Quản trị tài khoản',
    icon: <TeamOutlined />,
    routeIcons: ['accounts', 'account'],
  },
  {
    key: 'governance',
    label: 'Phân quyền & cấu hình',
    icon: <SafetyCertificateOutlined />,
    routeIcons: ['shield', 'settings'],
  },
]

function toMenuItem(item) {
  return {
    key: item.path,
    icon: ICONS[item.iconKey],
    label: item.navLabel,
  }
}

export default function AdminNavigation({
  items,
  pathname,
  navigate,
  onNavigate,
  collapsed = false,
}) {
  const { menuItems, activeSectionKey, sectionKeys } = useMemo(() => {
    const dashboard = items.find((item) => item.iconKey === 'dashboard')
    const assignedIcons = new Set(['dashboard'])
    const sections = NAVIGATION_SECTIONS.map((section) => {
      section.routeIcons.forEach((iconKey) => assignedIcons.add(iconKey))
      const children = items
        .filter((item) => section.routeIcons.includes(item.iconKey))
        .map(toMenuItem)
      return { ...section, children }
    })
    const extraItems = items
      .filter((item) => !assignedIcons.has(item.iconKey))
      .map(toMenuItem)
    const result = dashboard ? [toMenuItem(dashboard)] : []

    sections.forEach((section) => {
      if (section.children.length === 1) {
        result.push(section.children[0])
      } else if (section.children.length > 1) {
        result.push({
          key: `section-${section.key}`,
          icon: section.icon,
          label: section.label,
          children: section.children,
        })
      }
    })
    if (extraItems.length === 1) {
      result.push(extraItems[0])
    } else if (extraItems.length > 1) {
      result.push({
        key: 'section-more',
        icon: <AppstoreOutlined />,
        label: 'Khác',
        children: extraItems,
      })
    }

    const activeSection = sections.find((section) => (
      section.children.length > 1 && section.children.some((item) => item.key === pathname)
    ))
    return {
      menuItems: result,
      activeSectionKey: activeSection ? `section-${activeSection.key}` : null,
      sectionKeys: result.filter((item) => item.children).map((item) => item.key),
    }
  }, [items, pathname])
  const [openKeys, setOpenKeys] = useState([])

  useEffect(() => {
    setOpenKeys(activeSectionKey ? [activeSectionKey] : [])
  }, [activeSectionKey])

  const handleOpenChange = (nextOpenKeys) => {
    const newlyOpenedKey = nextOpenKeys.find((key) => !openKeys.includes(key))
    if (newlyOpenedKey && sectionKeys.includes(newlyOpenedKey)) {
      setOpenKeys([newlyOpenedKey])
      return
    }
    setOpenKeys(nextOpenKeys)
  }

  return (
    <nav className="admin-sider__navigation" aria-label="Điều hướng quản trị">
      <Menu
        theme="dark"
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[pathname]}
        openKeys={collapsed ? [] : openKeys}
        items={menuItems}
        onOpenChange={handleOpenChange}
        onClick={({ key }) => {
          navigate(key)
          onNavigate?.()
        }}
      />
    </nav>
  )
}
