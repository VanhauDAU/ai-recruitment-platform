import { useEffect } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd'
import dayjs from 'dayjs'
import {
  BUDGET_SOURCE_OPTIONS,
  CAMPAIGN_STATUS_LABELS,
  POSITION_LEVEL_OPTIONS,
} from '@/entities/campaign'

export default function CampaignForm({ initialValues, categories = [], submitting, onSubmit, onCancel }) {
  const [form] = Form.useForm()
  const continuous = Form.useWatch('is_continuous', form)

  useEffect(() => {
    form.setFieldsValue({
      ...initialValues,
      start_date: initialValues?.start_date ? dayjs(initialValues.start_date) : null,
      target_date: initialValues?.target_date ? dayjs(initialValues.target_date) : null,
    })
  }, [form, initialValues])

  function finish(values) {
    onSubmit({
      ...values,
      start_date: values.start_date?.format('YYYY-MM-DD') || null,
      target_date: values.is_continuous ? null : values.target_date?.format('YYYY-MM-DD'),
    })
  }

  return (
    <Form form={form} layout="vertical" onFinish={finish} initialValues={{ status: 'draft', headcount_target: 1, budget_source: 'company', is_continuous: false }}>
      <Form.Item name="name" label="Tên chiến dịch" rules={[{ required: true, message: 'Nhập tên chiến dịch.' }]}>
        <Input placeholder="Ví dụ: Tuyển kỹ sư quý III/2026" maxLength={255} />
      </Form.Item>
      <Form.Item name="description" label="Mô tả">
        <Input.TextArea rows={3} maxLength={3000} />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="position_category" label="Vị trí chuyên môn">
          <Select showSearch optionFilterProp="label" options={categories.map((item) => ({ value: item.id, label: item.name }))} />
        </Form.Item>
        <Form.Item name="position_level" label="Cấp bậc">
          <Select options={POSITION_LEVEL_OPTIONS.map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="headcount_target" label="Số lượng cần tuyển" rules={[{ required: true }]}>
          <InputNumber min={1} max={10000} className="!w-full" />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái">
          <Select options={Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
      </div>
      <Form.Item name="is_continuous" label="Tuyển liên tục" valuePropName="checked">
        <Switch />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="start_date" label="Ngày bắt đầu"><DatePicker className="!w-full" /></Form.Item>
        {!continuous && <Form.Item name="target_date" label="Hạn hoàn thành"><DatePicker className="!w-full" /></Form.Item>}
      </div>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <Form.Item name="budget_min" label="Ngân sách từ"><InputNumber min={0} className="!w-full" /></Form.Item>
        <Form.Item name="budget_max" label="Ngân sách đến"><InputNumber min={0} className="!w-full" /></Form.Item>
        <Form.Item name="budget_source" label="Nguồn ngân sách"><Select options={BUDGET_SOURCE_OPTIONS.map(([value, label]) => ({ value, label }))} /></Form.Item>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Hủy</Button>
        <Button type="primary" htmlType="submit" loading={submitting}>Lưu chiến dịch</Button>
      </div>
    </Form>
  )
}
