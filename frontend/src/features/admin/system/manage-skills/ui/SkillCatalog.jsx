import { PlusOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Grid, Pagination, Select, Skeleton, Switch, Table, Tag, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAccess } from '@/entities/account/admin-access'
import { useSession } from '@/entities/account/session'
import {
  adminCatalogKeys,
  bulkUpdateAdminSkills,
  getAdminSkillGroups,
  getAdminSkills,
  getAdminSkillSummary,
  updateAdminSkill,
} from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { message } from '@/shared/lib/toast'
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  SOURCE_LABELS,
  emptyText,
  formatCount,
  groupOptions,
  skillListParams,
  usageText,
} from '../model/skill-catalog'
import SkillDrawer from './SkillDrawer'
import SkillGroupsModal from './SkillGroupsModal'
import SkillMergeModal from './SkillMergeModal'
import SkillToolbar from './SkillToolbar'
import './skill-catalog.css'

const UNDO_DURATION = 15000

function isTyping(target) {
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function stop(event) {
  event.stopPropagation()
}

/** Tab Kỹ năng: dọn danh mục bằng bộ lọc "Cần dọn", gán nhóm tại chỗ, chọn nhiều, gộp. */
export default function SkillCatalog() {
  const queryClient = useQueryClient()
  const screens = Grid.useBreakpoint()
  const { user } = useSession()
  const { isSuperuser } = useAdminAccess(user)
  const searchRef = useRef(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [editing, setEditing] = useState(null)
  const [merging, setMerging] = useState(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const search = useDebouncedValue(filters.search, 300)
  const params = useMemo(() => skillListParams({ ...filters, search }, page), [filters, search, page])

  const skillsQuery = useQuery({
    queryKey: adminCatalogKeys.skills(params),
    queryFn: ({ signal }) => getAdminSkills(params, { signal }),
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({ queryKey: adminCatalogKeys.skillSummary, queryFn: getAdminSkillSummary })
  const groupsQuery = useQuery({ queryKey: adminCatalogKeys.skillGroups, queryFn: getAdminSkillGroups })
  const skills = skillsQuery.data?.results ?? []
  const groups = groupsQuery.data ?? []
  const options = groupOptions(groups)
  const summary = summaryQuery.data

  useEffect(() => {
    const focusSearch = (event) => {
      if (event.key !== '/' || isTyping(event.target)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminCatalogKeys.root })
  const onError = (error) => {
    refresh()
    message.error(getApiErrorMessage(error, m.admin_catalog_action_failed()))
  }
  const undoToast = (text, undo) => message(text, {
    duration: UNDO_DURATION,
    action: { label: m.admin_catalog_undo(), onClick: undo },
  })

  const update = useMutation({
    mutationFn: ({ skill, changes }) => updateAdminSkill(skill.id, changes),
    onMutate: ({ skill, changes }) => queryClient.setQueryData(adminCatalogKeys.skills(params), (current) => current && {
      ...current,
      results: current.results.map((row) => (row.id === skill.id ? { ...row, ...changes } : row)),
    }),
    onSuccess: refresh,
    onError,
  })
  const bulk = useMutation({
    mutationFn: ({ ids, changes }) => bulkUpdateAdminSkills(ids, changes),
    onSuccess: refresh,
    onError,
  })

  const setFilter = (changes) => {
    setFilters((current) => ({ ...current, ...changes }))
    setPage(1)
    setSelected([])
  }
  const toggleActive = (skill, active) => {
    update.mutate({ skill, changes: { is_active: active } })
    undoToast(
      active ? m.admin_catalog_skill_shown({ name: skill.name }) : m.admin_catalog_skill_hidden({ name: skill.name }),
      () => update.mutate({ skill, changes: { is_active: !active } }),
    )
  }
  const assignGroup = (skill, groupId) => {
    const group = groups.find((item) => item.id === groupId)
    update.mutate({ skill, changes: { group: groupId, group_name: group?.name } })
    undoToast(
      m.admin_catalog_skill_grouped({ name: skill.name, group: group?.name ?? '' }),
      () => update.mutate({ skill, changes: { group: null, group_name: '' } }),
    )
  }
  const bulkUpdate = (changes, text, undoChanges) => {
    const ids = selected
    bulk.mutate({ ids, changes })
    setSelected([])
    if (undoChanges) undoToast(text, () => bulk.mutate({ ids, changes: undoChanges }))
    else message.success(text)
  }

  const groupCell = (skill) => (skill.group ? skill.group_name : (
    <Select
      size="small"
      className="skill-catalog__inline-group"
      placeholder={m.admin_catalog_choose_group()}
      aria-label={m.admin_catalog_choose_group_for({ name: skill.name })}
      options={options}
      showSearch={{ optionFilterProp: 'label' }}
      onClick={stop}
      onChange={(groupId) => assignGroup(skill, groupId)}
    />
  ))
  const activeSwitch = (skill) => (
    <Switch
      size="small"
      checked={skill.is_active}
      aria-label={m.admin_catalog_toggle_skill({ name: skill.name })}
      onClick={(checked, event) => {
        stop(event)
        toggleActive(skill, checked)
      }}
    />
  )
  const nameCell = (skill) => (
    <span className="skill-catalog__name">
      <button type="button" className="skill-catalog__name-button" onClick={() => setEditing(skill)}>{skill.name}</button>
      {skill.source !== 'seed' && <span className="skill-catalog__source">{SOURCE_LABELS[skill.source]()}</span>}
    </span>
  )
  const usageCell = (skill) => (
    <Tooltip title={usageText(skill.usage)}>
      <span className={skill.usage_total ? 'skill-catalog__usage' : 'skill-catalog__usage is-zero'}>{formatCount(skill.usage_total)}</span>
    </Tooltip>
  )
  const aliasCell = (skill) => {
    if (!skill.aliases.length) return <span className="skill-catalog__muted">—</span>
    const rest = skill.aliases.slice(2)
    return (
      <span className="skill-catalog__aliases">
        {skill.aliases.slice(0, 2).map((alias) => <Tag key={alias}>{alias}</Tag>)}
        {rest.length > 0 && <Tooltip title={rest.join(', ')}><Tag>+{rest.length}</Tag></Tooltip>}
      </span>
    )
  }

  const columns = [
    { key: 'name', title: m.admin_catalog_col_name(), render: nameCell },
    { key: 'group', title: m.admin_catalog_col_group(), width: 200, render: groupCell },
    { key: 'aliases', title: m.admin_catalog_col_aliases(), render: aliasCell },
    { key: 'usage', title: m.admin_catalog_col_usage(), width: 72, align: 'right', render: usageCell },
    { key: 'active', title: m.admin_catalog_col_active(), width: 64, render: activeSwitch },
  ]
  const pagination = {
    current: page,
    pageSize: PAGE_SIZE,
    total: skillsQuery.data?.count ?? 0,
    showSizeChanger: false,
    size: 'small',
    onChange: (next) => {
      setPage(next)
      setSelected([])
    },
  }
  const editingIndex = editing?.id ? skills.findIndex((skill) => skill.id === editing.id) : -1
  const nextSkill = editingIndex >= 0 ? skills[editingIndex + 1] : undefined
  const empty = (
    <Empty description={emptyText(filters)}>
      {!filters.cleanup && !filters.search && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>{m.admin_catalog_add_skill()}</Button>
      )}
    </Empty>
  )

  return (
    <div className="skill-catalog">
      <SkillToolbar
        filters={filters}
        summary={summary}
        options={options}
        selected={selected}
        searchRef={searchRef}
        showShortcut={screens.md}
        onFilter={setFilter}
        onBulk={bulkUpdate}
        onClearSelection={() => setSelected([])}
        onAdd={() => setEditing({})}
        onGroups={() => setGroupsOpen(true)}
      />

      {skillsQuery.isError && (
        <Alert type="error" showIcon message={m.admin_catalog_load_failed()} action={<Button size="small" onClick={() => skillsQuery.refetch()}>{m.admin_catalog_retry()}</Button>} />
      )}
      {skillsQuery.isPending && <Skeleton active title={false} paragraph={{ rows: 10 }} />}
      {skillsQuery.isSuccess && (screens.md ? (
        <Table
          rowKey="id"
          size="middle"
          sticky
          columns={columns}
          dataSource={skills}
          loading={skillsQuery.isFetching && skillsQuery.isPlaceholderData}
          pagination={pagination}
          locale={{ emptyText: empty }}
          rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
          rowClassName={(skill) => (skill.is_active ? 'skill-catalog__row' : 'skill-catalog__row is-hidden')}
          onRow={(skill) => ({ onClick: () => setEditing(skill) })}
        />
      ) : (
        <>
          {skills.length === 0 && empty}
          <ul className="skill-catalog__cards" aria-label={m.admin_catalog_tab_skills()}>
            {skills.map((skill) => (
              <li key={skill.id} className={skill.is_active ? 'skill-catalog__card' : 'skill-catalog__card is-hidden'}>
                <div className="skill-catalog__card-body">
                  {nameCell(skill)}
                  <span className="skill-catalog__card-meta">
                    {groupCell(skill)}
                    <span>{usageText(skill.usage)}</span>
                  </span>
                </div>
                {activeSwitch(skill)}
              </li>
            ))}
          </ul>
          {skills.length > 0 && <Pagination {...pagination} align="center" />}
        </>
      ))}

      <SkillDrawer
        skill={editing}
        groups={groups}
        nextSkill={nextSkill}
        canMerge={isSuperuser}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          refresh()
          setEditing(next ?? null)
        }}
        onMerge={(skill) => setMerging(skill)}
      />
      <SkillMergeModal
        source={merging}
        onClose={() => setMerging(null)}
        onMerged={(target) => {
          setMerging(null)
          setEditing(null)
          refresh()
          message.success(m.admin_catalog_merged({ name: target.name }))
        }}
      />
      <SkillGroupsModal open={groupsOpen} groups={groups} loading={groupsQuery.isPending} onClose={() => setGroupsOpen(false)} />
    </div>
  )
}
