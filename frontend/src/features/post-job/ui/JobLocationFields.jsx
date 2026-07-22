import { CloseOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, Popover, Select } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getWards } from '@/entities/location'

const sameId = (left, right) => String(left) === String(right)
const includesId = (ids, id) => ids.some((item) => sameId(item, id))
const focusAfterOpen = (ref) => requestAnimationFrame(() => ref.current?.focus())

function uniqueIds(ids) {
  return ids.filter((id, index) => ids.findIndex((item) => sameId(item, id)) === index)
}

function WardPicker({ open, wards, loading, allWardId, onOpenChange, onApply }) {
  const [search, setSearch] = useState('')
  const [draftIds, setDraftIds] = useState([])
  const searchInputRef = useRef(null)
  const visibleWards = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN')
    return normalizedSearch
      ? wards.filter((ward) => ward.name.toLocaleLowerCase('vi-VN').includes(normalizedSearch))
      : wards
  }, [search, wards])

  function close() {
    setSearch('')
    setDraftIds([])
    onOpenChange(false)
  }

  function toggleWard(wardId) {
    setDraftIds((current) => {
      if (sameId(wardId, allWardId)) {
        return includesId(current, allWardId) ? [] : [allWardId]
      }
      const withoutAll = current.filter((id) => !sameId(id, allWardId))
      return includesId(withoutAll, wardId)
        ? withoutAll.filter((id) => !sameId(id, wardId))
        : [...withoutAll, wardId]
    })
  }

  useEffect(() => {
    if (open) focusAfterOpen(searchInputRef)
  }, [open])

  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomLeft"
      title="Chọn phường/xã"
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setSearch('')
          setDraftIds([])
          onOpenChange(true)
        } else {
          close()
        }
      }}
      content={(
        <div className="w-[min(360px,calc(100vw-48px))]">
          <Input
            ref={searchInputRef}
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm kiếm phường/xã"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {loading && <p className="p-4 text-sm text-slate-500">Đang tải phường/xã...</p>}
            {!loading && visibleWards.length === 0 && <p className="p-4 text-sm text-slate-500">Không tìm thấy phường/xã phù hợp.</p>}
            {!loading && visibleWards.map((ward) => (
              <label key={ward.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0 hover:bg-emerald-50">
                <Checkbox checked={includesId(draftIds, ward.id)} onChange={() => toggleWard(ward.id)} />
                <span className="text-sm text-slate-700">{ward.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="small" onClick={close}>Hủy</Button>
            <Button
              size="small"
              type="primary"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onApply(draftIds)
              }}
            >
              Áp dụng ({draftIds.length})
            </Button>
          </div>
        </div>
      )}
    >
      <Button type="dashed" icon={<PlusOutlined />}>Thêm phường/xã</Button>
    </Popover>
  )
}

function WorkplaceRow({ areaIndex, index, wards, loading, onRemove }) {
  const locationPath = [areaIndex, 'workplaces', index, 'location']
  const wardSelectRef = useRef(null)
  return (
    <div className="relative grid gap-2 pr-9 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
      <Form.Item
        className="!mb-0"
        name={locationPath}
        rules={[{ required: true, message: 'Chọn phường/xã.' }]}
      >
        <Select
          ref={wardSelectRef}
          aria-label={`Phường/xã ${index + 1} của khu vực ${areaIndex + 1}`}
          showSearch
          optionFilterProp="label"
          loading={loading}
          placeholder="Chọn phường/xã"
          onOpenChange={(nextOpen) => {
            if (nextOpen) focusAfterOpen(wardSelectRef)
          }}
          options={wards.map((ward) => ({
            value: ward.id,
            label: ward.name,
          }))}
        />
      </Form.Item>
      <Form.Item
        className="!mb-0"
        name={[areaIndex, 'workplaces', index, 'address_detail']}
      >
        <Input aria-label={`Địa điểm chi tiết ${index + 1} của khu vực ${areaIndex + 1}`} placeholder="Nhập địa điểm chi tiết..." />
      </Form.Item>
      <Button
        className="!absolute right-0 top-0"
        type="text"
        icon={<CloseOutlined />}
        aria-label={`Xóa phường/xã ${index + 1} của khu vực ${areaIndex + 1}`}
        onClick={onRemove}
      />
    </div>
  )
}

function WorkArea({ field, index, form, provinces, canRemove, onRemove }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const provinceSelectRef = useRef(null)
  const provinceId = Form.useWatch(['work_areas', field.name, 'province_id'], form)
  const workplaces = Form.useWatch(
    ['work_areas', field.name, 'workplaces'],
    { form, preserve: true },
  ) || []
  const wardsQuery = useQuery({
    queryKey: ['locations', 'wards', provinceId],
    queryFn: () => getWards(provinceId),
    enabled: Boolean(provinceId),
  })
  const selectableWards = useMemo(() => (
    provinceId
      ? [{ id: provinceId, name: 'Tất cả' }, ...(wardsQuery.data || [])]
      : []
  ), [provinceId, wardsQuery.data])
  const selectedWardIds = workplaces
    .map((workplace) => workplace.location)
    .filter((id) => id !== null && id !== undefined && id !== '')
  const displayedWorkplaces = workplaces.length ? workplaces : [{}]

  function changeProvince(value) {
    form.setFieldValue(['work_areas', field.name, 'province_id'], value)
    form.setFieldValue(['work_areas', field.name, 'workplaces'], [])
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <UpOutlined className="text-xs text-slate-500" />
        <span className="text-sm font-semibold text-slate-500">Khu vực {index + 1}:</span>
        <Form.Item
          className="!mb-0 min-w-[180px] flex-1 sm:max-w-[340px]"
          name={[field.name, 'province_id']}
          rules={[{ required: true, message: 'Chọn tỉnh/thành phố.' }]}
        >
          <Select
            ref={provinceSelectRef}
            aria-label={`Khu vực ${index + 1} - Tỉnh/thành phố`}
            showSearch
            optionFilterProp="label"
            options={provinces.map((item) => ({ value: item.id, label: item.name }))}
            placeholder="Chọn tỉnh/thành phố"
            onOpenChange={(nextOpen) => {
              if (nextOpen) focusAfterOpen(provinceSelectRef)
            }}
            onChange={changeProvince}
          />
        </Form.Item>
        <Button
          className="ml-auto"
          danger
          type="text"
          icon={<DeleteOutlined />}
          disabled={!canRemove}
          aria-label={`Xóa khu vực ${index + 1}`}
          onClick={onRemove}
        />
      </div>

      <div className="mt-4 space-y-3">
        {!provinceId && (
          <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">
            Chọn tỉnh/thành phố trước khi thêm phường/xã và địa điểm chi tiết.
          </p>
        )}
        {provinceId && (
          <div className="space-y-2">
            {displayedWorkplaces.map((_, workplaceIndex) => (
              <WorkplaceRow
                key={workplaceIndex}
                areaIndex={field.name}
                index={workplaceIndex}
                wards={selectableWards}
                loading={wardsQuery.isLoading}
                onRemove={() => {
                  form.setFieldValue(
                    ['work_areas', field.name, 'workplaces'],
                    workplaces.filter((_, itemIndex) => itemIndex !== workplaceIndex),
                  )
                }}
              />
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <WardPicker
                open={pickerOpen}
                wards={selectableWards}
                loading={wardsQuery.isLoading}
                allWardId={provinceId}
                onOpenChange={setPickerOpen}
                onApply={(wardIds) => {
                  const distinctWardIds = uniqueIds(wardIds)
                  form.setFieldValue(
                    ['work_areas', field.name, 'workplaces'],
                    [
                      ...workplaces.filter((workplace) => workplace.location),
                      ...distinctWardIds.map((wardId) => ({ location: wardId, address_detail: '' })),
                    ],
                  )
                  setPickerOpen(false)
                }}
              />
              {selectedWardIds.length > 0 && (
                <Button
                  size="small"
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => form.setFieldValue(['work_areas', field.name, 'workplaces'], [])}
                >
                  Xóa tất cả ({selectedWardIds.length})
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default function JobLocationFields({ form, provinces }) {
  return (
    <Form.List name="work_areas">
      {(fields, { add, remove }) => (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <WorkArea
              key={field.key}
              field={field}
              index={index}
              form={form}
              provinces={provinces}
              canRemove={fields.length > 1}
              onRemove={() => remove(field.name)}
            />
          ))}
          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => add({ workplaces: [] })}>
            Thêm khu vực làm việc
          </Button>
        </div>
      )}
    </Form.List>
  )
}
