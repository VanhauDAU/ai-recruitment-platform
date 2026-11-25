import { ClusterOutlined, PlusOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Input, Select } from 'antd'
import { m } from '@/shared/config/i18n'
import { CLEANUP_FILTERS, ORDERING_LABELS, SOURCE_LABELS, formatCount } from '../model/skill-catalog'

/** Dải "Cần dọn" và thanh bộ lọc; khi đã chọn dòng thì thanh chọn nhiều thế chỗ thanh bộ lọc. */
export default function SkillToolbar({
  filters,
  summary,
  options,
  selected,
  searchRef,
  showShortcut,
  onFilter,
  onBulk,
  onClearSelection,
  onAdd,
  onGroups,
}) {
  const cleanupKeys = Object.keys(CLEANUP_FILTERS).filter((key) => summary?.[key] > 0 || filters.cleanup === key)

  return (
    <>
      <div className="skill-catalog__top">
        {cleanupKeys.length > 0 && (
          <div className="skill-catalog__cleanup" role="group" aria-label={m.admin_catalog_cleanup()}>
            <WarningOutlined aria-hidden="true" />
            <span>{m.admin_catalog_cleanup()}</span>
            {cleanupKeys.map((key) => (
              <Button
                key={key}
                size="small"
                shape="round"
                type={filters.cleanup === key ? 'primary' : 'default'}
                aria-pressed={filters.cleanup === key}
                onClick={() => onFilter({ cleanup: filters.cleanup === key ? undefined : key })}
              >
                {CLEANUP_FILTERS[key].label(formatCount(summary?.[key] ?? 0))}
              </Button>
            ))}
          </div>
        )}
        <div className="skill-catalog__actions">
          <Button icon={<ClusterOutlined />} onClick={onGroups}>{m.admin_catalog_groups()}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{m.admin_catalog_add_skill()}</Button>
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="skill-catalog__bulk" role="toolbar" aria-label={m.admin_catalog_bulk_label()}>
          <strong>{m.admin_catalog_selected({ count: selected.length })}</strong>
          <Select
            size="small"
            className="skill-catalog__bulk-group"
            placeholder={m.admin_catalog_bulk_group()}
            aria-label={m.admin_catalog_bulk_group()}
            options={options}
            showSearch={{ optionFilterProp: 'label' }}
            value={null}
            onChange={(group) => onBulk({ group }, m.admin_catalog_bulk_grouped({ count: selected.length }))}
          />
          <Button size="small" onClick={() => onBulk({ is_active: false }, m.admin_catalog_bulk_hidden({ count: selected.length }), { is_active: true })}>
            {m.admin_catalog_hide()}
          </Button>
          <Button size="small" onClick={() => onBulk({ is_active: true }, m.admin_catalog_bulk_shown({ count: selected.length }))}>
            {m.admin_catalog_show()}
          </Button>
          <Button size="small" type="text" className="skill-catalog__bulk-clear" onClick={onClearSelection}>{m.admin_catalog_clear_selection()}</Button>
        </div>
      ) : (
        <div className="skill-catalog__toolbar">
          <Input
            ref={searchRef}
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            suffix={showShortcut ? <kbd className="skill-catalog__kbd">/</kbd> : null}
            placeholder={m.admin_catalog_search_placeholder()}
            aria-label={m.admin_catalog_search_placeholder()}
            value={filters.search}
            onChange={(event) => onFilter({ search: event.target.value })}
            className="skill-catalog__search"
          />
          <Select allowClear placeholder={m.admin_catalog_col_group()} aria-label={m.admin_catalog_col_group()} options={options} value={filters.group} onChange={(group) => onFilter({ group })} showSearch={{ optionFilterProp: 'label' }} className="skill-catalog__filter" />
          <Select
            allowClear
            placeholder={m.admin_catalog_source()}
            aria-label={m.admin_catalog_source()}
            options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label: label() }))}
            value={filters.source}
            onChange={(source) => onFilter({ source })}
            className="skill-catalog__filter"
          />
          <Select
            aria-label={m.admin_catalog_status()}
            options={[
              { value: 'active', label: m.admin_catalog_status_active() },
              { value: 'hidden', label: m.admin_catalog_status_hidden() },
              { value: 'all', label: m.admin_catalog_status_all() },
            ]}
            value={filters.status}
            onChange={(status) => onFilter({ status })}
            className="skill-catalog__filter"
          />
          <Select
            aria-label={m.admin_catalog_ordering()}
            options={Object.entries(ORDERING_LABELS).map(([value, label]) => ({ value, label: label() }))}
            value={filters.ordering}
            onChange={(ordering) => onFilter({ ordering })}
            className="skill-catalog__filter"
          />
        </div>
      )}
    </>
  )
}
