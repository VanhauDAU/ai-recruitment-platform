import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Skeleton, Switch, Table, Typography } from 'antd'
import { useState } from 'react'
import {
  adminCatalogKeys,
  createAdminLookup,
  getAdminLookup,
  reorderAdminBenefits,
  updateAdminLookup,
} from '@/entities/system/admin-catalog'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { BENEFIT_CATEGORIES, LOOKUPS, notifyWithUndo } from '../model/catalog'
import { foldText } from '../model/category-tree'
import './catalog.css'

/**
 * Danh mục nhỏ (phúc lợi, lĩnh vực công ty, ngôn ngữ): thêm ở hàng đầu, sửa ngay trên
 * dòng, ẩn/hiện có hoàn tác; phúc lợi có thêm nhóm và thứ tự hiển thị.
 */
export default function LookupCatalog({ kind }) {
  const config = LOOKUPS[kind]
  const queryClient = useQueryClient()
  const key = adminCatalogKeys.lookup(kind)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({ name: '', extra: config.extra === 'category' ? 'other' : '' })
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getAdminLookup(kind, { signal }) })
  const rows = query.data ?? []
  const term = foldText(search.trim())
  const visible = term ? rows.filter((row) => foldText(row.name).includes(term)) : rows
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const onError = (error) => {
    refresh()
    message.error(getApiErrorMessage(error, m.admin_catalog_action_failed()))
  }

  const create = useMutation({
    mutationFn: () => createAdminLookup(kind, { name: draft.name.trim(), ...(config.extra && { [config.extra]: draft.extra.trim() }) }),
    onSuccess: (row) => {
      setDraft((current) => ({ ...current, name: '', extra: config.extra === 'category' ? current.extra : '' }))
      refresh()
      message.success(m.admin_catalog_item_created({ name: row.name }))
    },
    onError,
  })
  const update = useMutation({
    mutationFn: ({ row, changes }) => updateAdminLookup(kind, row.id, changes),
    onMutate: ({ row, changes }) => queryClient.setQueryData(key, (current) => current?.map((item) => (item.id === row.id ? { ...item, ...changes } : item))),
    onSuccess: refresh,
    onError,
  })
  const reorder = useMutation({
    mutationFn: (ids) => reorderAdminBenefits(ids),
    onMutate: (ids) => queryClient.setQueryData(key, (current = []) => ids.map((id) => current.find((item) => item.id === id))),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
    onError,
  })
  const move = (index, step) => {
    const ids = rows.map((row) => row.id)
    ;[ids[index], ids[index + step]] = [ids[index + step], ids[index]]
    reorder.mutate(ids)
  }
  const toggle = (row, active) => {
    update.mutate({ row, changes: { is_active: active } })
    notifyWithUndo(
      active ? m.admin_catalog_item_shown({ name: row.name }) : m.admin_catalog_item_hidden({ name: row.name }),
      () => update.mutate({ row, changes: { is_active: !active } }),
    )
  }
  const rename = (row, field, value) => {
    const next = value.trim()
    if (next && next !== row[field]) update.mutate({ row, changes: { [field]: next } })
  }

  const columns = [
    {
      key: 'name',
      title: m.admin_catalog_col_name(),
      render: (row) => (
        <Typography.Text strong editable={{ onChange: (value) => rename(row, 'name', value), triggerType: ['icon', 'text'] }}>
          {row.name}
        </Typography.Text>
      ),
    },
    config.extra === 'category' && {
      key: 'category',
      title: m.admin_catalog_benefit_category(),
      width: 220,
      render: (row) => (
        <Select
          size="small"
          className="skill-catalog__inline-group"
          aria-label={m.admin_catalog_benefit_category_for({ name: row.name })}
          value={row.category}
          options={BENEFIT_CATEGORIES.map(([value, label]) => ({ value, label: label() }))}
          onChange={(category) => update.mutate({ row, changes: { category } })}
        />
      ),
    },
    config.extra === 'code' && {
      key: 'code',
      title: m.admin_catalog_language_code(),
      width: 120,
      render: (row) => <Typography.Text code editable={{ onChange: (value) => rename(row, 'code', value) }}>{row.code}</Typography.Text>,
    },
    {
      key: 'usage',
      title: m.admin_catalog_col_usage(),
      width: 200,
      responsive: ['md'],
      render: (row) => <span className="skill-catalog__muted">{config.usage(row)}</span>,
    },
    {
      key: 'active',
      title: m.admin_catalog_col_active(),
      width: 64,
      render: (row) => <Switch size="small" checked={row.is_active} aria-label={m.admin_catalog_toggle_item({ name: row.name })} onChange={(active) => toggle(row, active)} />,
    },
    config.reorder && !term && {
      key: 'order',
      width: 80,
      render: (row, _, index) => (
        <span className="catalog-tree__actions">
          <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={m.admin_catalog_move_up({ name: row.name })} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={m.admin_catalog_move_down({ name: row.name })} disabled={index === rows.length - 1 || reorder.isPending} onClick={() => move(index, 1)} />
        </span>
      ),
    },
  ].filter(Boolean)

  return (
    <div className="skill-catalog">
      <div className="skill-catalog__toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder={m.admin_catalog_lookup_search()}
          aria-label={m.admin_catalog_lookup_search()}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="skill-catalog__search"
        />
        <form
          className="catalog-lookup__add"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.name.trim() && (!config.extra || draft.extra.trim())) create.mutate()
          }}
        >
          <Input value={draft.name} maxLength={255} placeholder={config.placeholder()} aria-label={config.placeholder()} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          {config.extra === 'category' && (
            <Select
              aria-label={m.admin_catalog_benefit_category()}
              value={draft.extra}
              options={BENEFIT_CATEGORIES.map(([value, label]) => ({ value, label: label() }))}
              onChange={(extra) => setDraft({ ...draft, extra })}
              className="skill-catalog__filter"
            />
          )}
          {config.extra === 'code' && (
            <Input value={draft.extra} maxLength={20} placeholder={m.admin_catalog_language_code()} aria-label={m.admin_catalog_language_code()} onChange={(event) => setDraft({ ...draft, extra: event.target.value })} className="catalog-lookup__code" />
          )}
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={create.isPending}>{m.admin_catalog_add()}</Button>
        </form>
      </div>
      {config.reorder && !term && <p className="skill-catalog__muted">{m.admin_catalog_benefit_order_help()}</p>}

      {query.isError && <Alert type="error" showIcon message={m.admin_catalog_load_failed()} action={<Button size="small" onClick={() => query.refetch()}>{m.admin_catalog_retry()}</Button>} />}
      {query.isPending && <Skeleton active title={false} paragraph={{ rows: 8 }} />}
      {query.isSuccess && (
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={visible}
          pagination={false}
          locale={{ emptyText: <Empty description={term ? m.admin_catalog_empty_search_items({ query: search.trim() }) : m.admin_catalog_empty_items()} /> }}
          rowClassName={(row) => (row.is_active ? '' : 'skill-catalog__row is-hidden')}
        />
      )}
    </div>
  )
}
