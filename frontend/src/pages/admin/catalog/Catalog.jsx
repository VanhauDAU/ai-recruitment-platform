import { Tabs } from 'antd'
import { useSearchParams } from 'react-router'
import { CategoryCatalog, LookupCatalog, SkillCatalog } from '@/features/admin/system/manage-catalog'
import { m } from '@/shared/config/i18n'

const TABS = [
  { key: 'skills', label: () => m.admin_catalog_tab_skills(), render: () => <SkillCatalog /> },
  { key: 'categories', label: () => m.admin_catalog_tab_categories(), render: () => <CategoryCatalog /> },
  { key: 'benefits', label: () => m.admin_catalog_tab_benefits(), render: () => <LookupCatalog kind="benefits" /> },
  { key: 'industries', label: () => m.admin_catalog_tab_industries(), render: () => <LookupCatalog kind="industries" /> },
  { key: 'languages', label: () => m.admin_catalog_tab_languages(), render: () => <LookupCatalog kind="languages" /> },
]

/** Danh mục dữ liệu dùng chung: mỗi tab một danh mục, tab đang mở nằm trên URL (`?tab=`). */
export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const active = TABS.some((tab) => tab.key === requested) ? requested : TABS[0].key

  return (
    <Tabs
      activeKey={active}
      onChange={(tab) => setSearchParams({ tab }, { replace: true })}
      destroyOnHidden
      items={TABS.map(({ key, label, render }) => ({ key, label: label(), children: render() }))}
    />
  )
}
