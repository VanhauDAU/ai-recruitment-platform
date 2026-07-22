import { ArrowRightOutlined } from '@ant-design/icons'
import { Cascader } from 'antd'
import { useMemo } from 'react'

function buildTaxonomyOptions(categories) {
  const childrenByParent = new Map()
  categories.forEach((category) => {
    const parentId = category.parent ?? null
    const children = childrenByParent.get(parentId) || []
    children.push(category)
    childrenByParent.set(parentId, children)
  })

  const buildNode = (category) => {
    const children = (childrenByParent.get(category.id) || []).map(buildNode)
    return {
      value: category.id,
      label: category.name,
      categoryType: category.category_type,
      disabled: children.length === 0 && category.category_type !== 'specialization',
      ...(children.length ? { children } : {}),
    }
  }

  const roots = categories.filter((category) => category.parent == null)
  const hierarchical = roots.map(buildNode)
  const hasSelectableLeaf = (nodes) => nodes.some((node) => (
    node.categoryType === 'specialization' || hasSelectableLeaf(node.children || [])
  ))
  if (hasSelectableLeaf(hierarchical)) return hierarchical

  return [{
    value: '__all__',
    label: 'Tất cả nhóm nghề',
    children: categories
      .filter((category) => category.category_type === 'specialization')
      .map((category) => ({ value: category.id, label: category.name, categoryType: category.category_type })),
  }]
}

function findPath(options, target, path = []) {
  for (const option of options) {
    const nextPath = [...path, option.value]
    if (option.value === target) return nextPath
    const nested = findPath(option.children || [], target, nextPath)
    if (nested) return nested
  }
  return undefined
}

function findOptionPath(options, target, path = []) {
  for (const option of options) {
    const nextPath = [...path, option]
    if (option.value === target) return nextPath
    const nested = findOptionPath(option.children || [], target, nextPath)
    if (nested) return nested
  }
  return []
}

const PATH_LABELS = ['Nhóm nghề', 'Nghề', 'Chuyên môn']

export default function JobSpecializationCascader({ categories, value, onChange, ...props }) {
  const options = useMemo(() => buildTaxonomyOptions(categories), [categories])
  const path = useMemo(() => findPath(options, value), [options, value])
  const selectedPath = useMemo(
    () => findOptionPath(options, value).filter((option) => option.value !== '__all__'),
    [options, value],
  )

  return (
    <div className="space-y-2">
      <Cascader
        {...props}
        value={path}
        options={options}
        changeOnSelect={false}
        displayRender={(labels) => labels.at(-1)}
        onChange={(selectedPath) => {
          const selected = selectedPath?.at(-1)
          onChange?.(selected === '__all__' ? undefined : selected)
        }}
        showSearch={{
          filter: (inputValue, optionPath) => optionPath.some((option) => (
            String(option.label).toLocaleLowerCase('vi-VN').includes(inputValue.toLocaleLowerCase('vi-VN'))
          )),
        }}
      />
      {selectedPath.length > 0 && (
        <div className="rounded-lg border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] px-3 py-2.5">
          <p className="text-xs font-medium text-slate-600">Cách ứng viên tìm thấy tin tuyển dụng của bạn</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {selectedPath.map((option, index) => {
              const isSpecialization = index === selectedPath.length - 1
              return (
                <div key={option.value} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <ArrowRightOutlined className="shrink-0 text-[10px] text-slate-400" />}
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {PATH_LABELS[Math.min(index, PATH_LABELS.length - 1)]}
                  </span>
                  <span className={`max-w-full rounded-md px-2 py-1 text-xs font-semibold ${isSpecialization ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
                    {option.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
