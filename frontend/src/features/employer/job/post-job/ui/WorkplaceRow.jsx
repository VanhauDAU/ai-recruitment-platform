import { CloseOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select } from 'antd'
import { useRef, useState } from 'react'
import { m } from '@/shared/config/i18n'
import { focusAfterOpen, sameId } from '../lib/location-ids'
import WorkplacePinModal from './WorkplacePinModal'

// Một nơi làm việc trong vùng: phường/xã + địa chỉ chi tiết + ghim tùy chọn (ADR-0029).
export default function WorkplaceRow({ form, areaIndex, index, wards, provinceId, loading, onRemove }) {
  const basePath = ['work_areas', areaIndex, 'workplaces', index]
  const locationPath = [areaIndex, 'workplaces', index, 'location']
  const wardSelectRef = useRef(null)
  const [pinOpen, setPinOpen] = useState(false)
  const workplace = Form.useWatch(basePath, { form, preserve: true }) || {}
  // "Tất cả" (cả tỉnh) không có điểm trên bản đồ: chỉ ghim cho phường/xã cụ thể.
  const ward = workplace.location && !sameId(workplace.location, provinceId)
    ? wards.find((item) => sameId(item.id, workplace.location))
    : null
  const clearPin = () => form.setFieldValue([...basePath, 'pin'], null)

  return (
    <div className="relative grid gap-2 pr-9 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
      <Form.Item
        className="!mb-0"
        name={locationPath}
        rules={[{ required: true, message: m.employer_job_location_ward_required() }]}
      >
        <Select
          ref={wardSelectRef}
          aria-label={m.employer_job_location_ward_aria({ index: index + 1, area: areaIndex + 1 })}
          showSearch
          optionFilterProp="label"
          loading={loading}
          placeholder={m.employer_job_location_choose_ward()}
          onOpenChange={(nextOpen) => {
            if (nextOpen) focusAfterOpen(wardSelectRef)
          }}
          onChange={clearPin}
          options={wards.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      </Form.Item>
      <Form.Item
        className="!mb-0"
        name={[areaIndex, 'workplaces', index, 'address_detail']}
      >
        {/* Sửa địa chỉ thì ghim cũ không còn đúng: bỏ để hệ thống geocode lại. */}
        <Input
          aria-label={m.employer_job_location_address_aria({ index: index + 1, area: areaIndex + 1 })}
          placeholder={m.employer_job_location_address_placeholder()}
          onChange={clearPin}
        />
      </Form.Item>
      <Form.Item hidden name={[areaIndex, 'workplaces', index, 'pin']}><Input /></Form.Item>
      {ward && (
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            size="small"
            type={workplace.pin ? 'default' : 'dashed'}
            icon={<EnvironmentOutlined />}
            onClick={() => setPinOpen(true)}
          >
            {workplace.pin ? m.employer_job_location_pin_set() : m.employer_job_location_pin_add()}
          </Button>
          {!workplace.pin && <span className="text-xs text-slate-500">{m.employer_job_location_pin_hint()}</span>}
          <WorkplacePinModal
            open={pinOpen}
            pin={workplace.pin}
            address={workplace.address_detail?.trim()}
            ward={ward}
            onClose={() => setPinOpen(false)}
            onSave={(pin) => {
              form.setFieldValue([...basePath, 'pin'], pin)
              setPinOpen(false)
            }}
          />
        </div>
      )}
      <Button
        className="!absolute right-0 top-0"
        type="text"
        icon={<CloseOutlined />}
        aria-label={m.employer_job_location_remove_ward_aria({ index: index + 1, area: areaIndex + 1 })}
        onClick={onRemove}
      />
    </div>
  )
}
