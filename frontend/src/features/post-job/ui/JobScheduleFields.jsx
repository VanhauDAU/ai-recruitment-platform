import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, TimePicker } from 'antd'

const TIME_PICKER_PROPS = {
  allowClear: true,
  format: 'HH:mm',
  inputReadOnly: false,
  minuteStep: 5,
  needConfirm: false,
}

const WEEKDAYS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 7, label: 'Chủ nhật' },
]

export default function JobScheduleFields() {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-semibold text-slate-700">Thời gian làm việc</div>
      <p className="mb-3 text-xs text-slate-500">
        Có thể gõ trực tiếp giờ theo định dạng 08:30 hoặc chọn từ danh sách. Thời gian kết thúc là tùy chọn.
      </p>
      <Form.List name="work_schedules">
        {(fields, { add, remove }) => (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.key} className="grid gap-x-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.1fr_1.1fr_auto]">
                <Form.Item name={[field.name, 'weekday_from']} label="Từ thứ" rules={[{ required: true, message: 'Chọn thứ bắt đầu.' }]}> 
                  <Select options={WEEKDAYS} />
                </Form.Item>
                <Form.Item name={[field.name, 'weekday_to']} label="Đến thứ" rules={[{ required: true, message: 'Chọn thứ kết thúc.' }]}> 
                  <Select options={WEEKDAYS} />
                </Form.Item>
                <Form.Item name={[field.name, 'start_time']} label="Từ giờ" rules={[{ required: true, message: 'Chọn giờ.' }]}>
                  <TimePicker {...TIME_PICKER_PROPS} className="!w-full" placeholder="08:30" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'end_time']}
                  label="Đến giờ"
                  dependencies={[['work_schedules', field.name, 'start_time']]}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const start = getFieldValue(['work_schedules', field.name, 'start_time'])
                        if (!start || !value || value.isAfter(start)) return Promise.resolve()
                        return Promise.reject(new Error('Giờ kết thúc phải sau giờ bắt đầu.'))
                      },
                    }),
                  ]}
                >
                  <TimePicker {...TIME_PICKER_PROPS} className="!w-full" placeholder="17:30" />
                </Form.Item>
                <Button
                  className="self-center sm:col-span-2 lg:col-span-1 lg:mt-2"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  aria-label={`Xóa khung giờ ${index + 1}`}
                  onClick={() => remove(field.name)}
                />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ weekday_from: 1, weekday_to: 5, sort_order: fields.length })}>
              Thêm thời gian
            </Button>
          </div>
        )}
      </Form.List>
      <Form.Item className="!mb-0 !mt-3" name="work_schedule_note" label="Mô tả thời gian làm việc">
        <Input.TextArea rows={2} maxLength={500} showCount placeholder="Ghi chú thêm, ví dụ: nghỉ trưa 60 phút hoặc làm việc linh hoạt" />
      </Form.Item>
    </div>
  )
}
