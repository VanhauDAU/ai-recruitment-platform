import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, TimePicker } from 'antd'
import { m } from '@/shared/config/i18n'

const TIME_PICKER_PROPS = {
  allowClear: true,
  format: 'HH:mm',
  inputReadOnly: false,
  minuteStep: 5,
  needConfirm: false,
}

const WEEKDAYS = [
  { value: 1, label: m.employer_job_schedule_weekday_1() },
  { value: 2, label: m.employer_job_schedule_weekday_2() },
  { value: 3, label: m.employer_job_schedule_weekday_3() },
  { value: 4, label: m.employer_job_schedule_weekday_4() },
  { value: 5, label: m.employer_job_schedule_weekday_5() },
  { value: 6, label: m.employer_job_schedule_weekday_6() },
  { value: 7, label: m.employer_job_schedule_weekday_7() },
]

export default function JobScheduleFields() {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-semibold text-slate-700">{m.employer_job_schedule_title()}</div>
      <p className="mb-3 text-xs text-slate-500">
        {m.employer_job_schedule_hint()}
      </p>
      <Form.List name="work_schedules">
        {(fields, { add, remove }) => (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.key} className="grid gap-x-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.1fr_1.1fr_auto]">
                <Form.Item name={[field.name, 'weekday_from']} label={m.employer_job_schedule_from_day()} rules={[{ required: true, message: m.employer_job_schedule_from_day_required() }]}> 
                  <Select options={WEEKDAYS} />
                </Form.Item>
                <Form.Item name={[field.name, 'weekday_to']} label={m.employer_job_schedule_to_day()} rules={[{ required: true, message: m.employer_job_schedule_to_day_required() }]}> 
                  <Select options={WEEKDAYS} />
                </Form.Item>
                <Form.Item name={[field.name, 'start_time']} label={m.employer_job_schedule_start_time()} rules={[{ required: true, message: m.employer_job_schedule_time_required() }]}>
                  <TimePicker {...TIME_PICKER_PROPS} className="!w-full" placeholder="08:30" />
                </Form.Item>
                <Form.Item
                  name={[field.name, 'end_time']}
                  label={m.employer_job_schedule_end_time()}
                  dependencies={[['work_schedules', field.name, 'start_time']]}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const start = getFieldValue(['work_schedules', field.name, 'start_time'])
                        if (!start || !value || value.isAfter(start)) return Promise.resolve()
                        return Promise.reject(new Error(m.employer_job_schedule_end_before_start()))
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
                  aria-label={m.employer_job_schedule_remove_aria({ index: index + 1 })}
                  onClick={() => remove(field.name)}
                />
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ weekday_from: 1, weekday_to: 5, sort_order: fields.length })}>
              {m.employer_job_schedule_add()}
            </Button>
          </div>
        )}
      </Form.List>
      <Form.Item className="!mb-0 !mt-3" name="work_schedule_note" label={m.employer_job_schedule_note()}>
        <Input.TextArea rows={2} maxLength={500} showCount placeholder={m.employer_job_schedule_note_placeholder()} />
      </Form.Item>
    </div>
  )
}
