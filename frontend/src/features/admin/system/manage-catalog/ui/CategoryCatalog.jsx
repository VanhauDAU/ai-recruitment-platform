import { EditOutlined, PlusOutlined, SearchOutlined, SubnodeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Skeleton, Switch, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { adminCatalogKeys, getAdminJobCategories, updateAdminJobCategory } from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { formatCount, notifyWithUndo } from '../model/catalog'
import {
  CATEGORY_TYPES,
  branchKeys,
  buildCategoryTree,
  categoryMatcher,
  filterCategoryTree,
  foldText,
} from '../model/category-tree'
import CategoryDrawer from './CategoryDrawer'
import './catalog.css'

function Highlight({ text, term }) {
  const index = term ? foldText(text).indexOf(foldText(term)) : -1
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="catalog-mark">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  )
}

/** Tab Ngành nghề: bảng cây ba cấp, tìm kiếm tự mở nhánh, ẩn/hiện có hoàn tác. */
export default function CategoryCatalog() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({ search: '', type: '', status: 'all' })
  const [expanded, setExpanded] = useState([])
  const [editing, setEditing] = useState(null)
  const query = useQuery({ queryKey: adminCatalogKeys.categories, queryFn: getAdminJobCategories })
  const categories = useMemo(() => query.data ?? [], [query.data])
  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const filtering = Boolean(filters.search.trim() || filters.type || filters.status !== 'all')
  const visible = useMemo(
    () => (filtering ? filterCategoryTree(tree, categoryMatcher(filters)) : tree),
    [tree, filters, filtering],
  )
  const allBranches = useMemo(() => branchKeys(visible), [visible])

  const update = useMutation({
    mutationFn: ({ category, changes }) => updateAdminJobCategory(category.id, changes),
    onMutate: ({ category, changes }) => queryClient.setQueryData(
      adminCatalogKeys.categories,
      (current) => current?.map((row) => (row.id === category.id ? { ...row, ...changes } : row)),
    ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminCatalogKeys.categories }),
    onError: (error) => message.error(getApiErrorMessage(error, m.admin_catalog_action_failed())),
  })
  const toggle = (category, active) => {
    const status = active ? 'active' : 'inactive'
    update.mutate({ category, changes: { status } })
    const text = active
      ? m.admin_catalog_item_shown({ name: category.name })
      : category.child_count
        ? m.admin_catalog_category_hidden_children({ name: category.name, count: category.child_count })
        : m.admin_catalog_item_hidden({ name: category.name })
    notifyWithUndo(text, () => update.mutate({ category, changes: { status: active ? 'inactive' : 'active' } }))
  }
  const setFilter = (changes) => setFilters((current) => ({ ...current, ...changes }))

  const columns = [
    {
      key: 'name',
      title: m.admin_catalog_col_name(),
      render: (category) => (
        <span className="catalog-tree__name">
          {category.logo_preview && <img src={category.logo_preview} alt="" className="catalog-tree__icon" />}
          <span>
            <button type="button" className="skill-catalog__name-button" onClick={() => setEditing(category)}>
              <Highlight text={category.name} term={filters.search.trim()} />
            </button>
            {category.name_en && <span className="skill-catalog__source">{category.name_en}</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      title: m.admin_catalog_col_type(),
      width: 170,
      responsive: ['md'],
      render: (category) => <Tag color={CATEGORY_TYPES[category.category_type].color}>{CATEGORY_TYPES[category.category_type].label()}</Tag>,
    },
    {
      key: 'jobs',
      title: m.admin_catalog_col_jobs(),
      width: 72,
      align: 'right',
      responsive: ['md'],
      render: (category) => <span className={category.branch_job_count ? 'skill-catalog__usage' : 'skill-catalog__usage is-zero'}>{formatCount(category.branch_job_count ?? category.job_count)}</span>,
    },
    {
      key: 'active',
      title: m.admin_catalog_col_active(),
      width: 64,
      render: (category) => (
        <Switch
          size="small"
          checked={category.status === 'active'}
          aria-label={m.admin_catalog_toggle_item({ name: category.name })}
          onClick={(checked, event) => {
            event.stopPropagation()
            toggle(category, checked)
          }}
        />
      ),
    },
    {
      key: 'actions',
      width: 96,
      render: (category) => (
        <span className="catalog-tree__actions" onClick={(event) => event.stopPropagation()}>
          {CATEGORY_TYPES[category.category_type].child && (
            <Button size="small" type="text" icon={<SubnodeOutlined />} title={m.admin_catalog_add_child({ name: category.name })} aria-label={m.admin_catalog_add_child({ name: category.name })} onClick={() => setEditing({ parent: category.id })} />
          )}
          <Button size="small" type="text" icon={<EditOutlined />} aria-label={m.admin_catalog_edit_item({ name: category.name })} onClick={() => setEditing(category)} />
        </span>
      ),
    },
  ]

  return (
    <div className="skill-catalog">
      <div className="skill-catalog__toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder={m.admin_catalog_category_search()}
          aria-label={m.admin_catalog_category_search()}
          value={filters.search}
          onChange={(event) => setFilter({ search: event.target.value })}
          className="skill-catalog__search"
        />
        <Select
          allowClear
          placeholder={m.admin_catalog_col_type()}
          aria-label={m.admin_catalog_col_type()}
          value={filters.type || undefined}
          onChange={(type) => setFilter({ type: type ?? '' })}
          className="skill-catalog__filter catalog-tree__type-filter"
          options={Object.entries(CATEGORY_TYPES).map(([value, type]) => ({ value, label: type.label() }))}
        />
        <Select
          aria-label={m.admin_catalog_status()}
          value={filters.status}
          onChange={(status) => setFilter({ status })}
          className="skill-catalog__filter"
          options={[
            { value: 'all', label: m.admin_catalog_status_all() },
            { value: 'active', label: m.admin_catalog_status_active() },
            { value: 'hidden', label: m.admin_catalog_status_hidden() },
          ]}
        />
        <div className="skill-catalog__actions">
          {!filtering && (
            <Button onClick={() => setExpanded(expanded.length ? [] : allBranches)}>
              {expanded.length ? m.admin_catalog_collapse_all() : m.admin_catalog_expand_all()}
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ parent: null })}>{m.admin_catalog_add_group()}</Button>
        </div>
      </div>

      {query.isError && <Alert type="error" showIcon message={m.admin_catalog_load_failed()} action={<Button size="small" onClick={() => query.refetch()}>{m.admin_catalog_retry()}</Button>} />}
      {query.isPending && <Skeleton active title={false} paragraph={{ rows: 10 }} />}
      {query.isSuccess && (
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={visible}
          pagination={false}
          expandable={{
            expandedRowKeys: filtering ? allBranches : expanded,
            onExpandedRowsChange: (keys) => !filtering && setExpanded(keys),
          }}
          locale={{ emptyText: <Empty description={m.admin_catalog_category_empty()} /> }}
          rowClassName={(category) => (category.status === 'active' ? 'skill-catalog__row' : 'skill-catalog__row is-hidden')}
          onRow={(category) => ({ onClick: () => setEditing(category) })}
        />
      )}

      <CategoryDrawer category={editing} categories={categories} onClose={() => setEditing(null)} />
    </div>
  )
}
