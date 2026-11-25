import { Tabs } from 'antd'
import { useSearchParams } from 'react-router'
import { SkillCatalog } from '@/features/admin/system/manage-skills'
import { m } from '@/shared/config/i18n'

const TABS = [
  { key: 'skills', label: () => m.admin_catalog_tab_skills(), Content: SkillCatalog },
]

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = TABS.some((tab) => tab.key === searchParams.get('tab')) ? searchParams.get('tab') : TABS[0].key

  return (
    <Tabs
      activeKey={active}
      onChange={(tab) => setSearchParams({ tab }, { replace: true })}
      destroyOnHidden
      items={TABS.map(({ key, label, Content }) => ({ key, label: label(), children: <Content /> }))}
    />
  )
}
