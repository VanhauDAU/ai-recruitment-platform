import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd'
import { useMemo } from 'react'
import {
  CAMPAIGN_BUDGET_SOURCE_OPTIONS,
  campaignKeys,
  updateCampaign,
} from '@/entities/campaign'
import { getJobCategories, jobKeys, POSITION_LEVEL_LABELS } from '@/entities/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { campaignGoalPayload, campaignGoalValues } from '../lib/campaign-goal'

const POSITION_LEVEL_OPTIONS = Object.entries(POSITION_LEVEL_LABELS)
  .map(([value, label]) => ({ value, label }))

// Mục tiêu chiến dịch: dùng ở bước 1 của wizard và khi sửa trong workspace.
export default function CampaignGoalForm({ campaign, submitLabel = 'Lưu mục tiêu', onSaved }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const isContinuous = Form.useWatch('is_continuous', form)
  const categoriesQuery = useQuery({ queryKey: jobKeys.categories, queryFn: () => getJobCategories() })
  const categoryOptions = useMemo(
    () => (categoriesQuery.data || [])
      .filter((category) => category.category_type === 'specialization')
      .map((category) => ({ value: category.id, label: category.name })),
    [categoriesQuery.data],
  )
  const startLocked = !['draft', 'scheduled'].includes(campaign.status)
  const mutation = useMutation({
    mutationFn: (payload) => updateCampaign(campaign.public_id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.public_id), (current) => ({
        ...current,
        ...updated,
      }))
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      message.success('Đã lưu mục tiêu chiến dịch.')
      onSaved?.(updated)
    },
    onError: (error) => {
      const data = error?.response?.data || {}
      const fields = Object.keys(campaignGoalValues(campaign))
        .filter((name) => data[name])
        .map((name) => ({ name, errors: [].concat(data[name]).map(String) }))
      form.setFields(fields)
      message.error(getApiErrorMessage(error, 'Không thể lưu mục tiêu chiến dịch.'))
    },
  })

  function handleFinish(values) {
    mutation.mutate(campaignGoalPayload(values))
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={campaignGoalValues(campaign)}
      onFinish={handleFinish}
      className="grid gap-x-4 sm:grid-cols-2"
    >
      <Form.Item
        className="sm:col-span-2"
        label="Tên chiến dịch"
        name="name"
        rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
      >
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item
        label="Vị trí tuyển"
        name="position_category"
        rules={[{ required: true, message: 'Chọn vị trí tuyển.' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          loading={categoriesQuery.isLoading}
          options={categoryOptions}
          placeholder="Chọn vị trí chuyên môn"
        />
      </Form.Item>
      <Form.Item label="Cấp bậc" name="position_level">
        <Select allowClear options={POSITION_LEVEL_OPTIONS} placeholder="Chọn cấp bậc" />
      </Form.Item>
      <Form.Item
        label="Chỉ tiêu tuyển (người)"
        name="headcount_target"
        rules={[{ required: true, message: 'Nhập chỉ tiêu tuyển.' }]}
      >
        <InputNumber min={1} max={10000} className="!w-full" />
      </Form.Item>
      <Form.Item label="Tuyển liên tục, không có ngày kết thúc" name="is_continuous" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        label="Ngày bắt đầu"
        name="start_date"
        extra={startLocked ? 'Chiến dịch đã chạy nên không đổi được ngày bắt đầu.' : 'Để trống thì bắt đầu ngay khi kích hoạt.'}
      >
        <DatePicker disabled={startLocked} format="DD/MM/YYYY" className="!w-full" />
      </Form.Item>
      <Form.Item
        label="Ngày kết thúc"
        name="target_date"
        dependencies={['start_date', 'is_continuous']}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (getFieldValue('is_continuous')) return Promise.resolve()
              if (!value) return Promise.reject(new Error('Chọn ngày kết thúc hoặc bật tuyển liên tục.'))
              const start = getFieldValue('start_date')
              if (start && value.isBefore(start, 'day')) {
                return Promise.reject(new Error('Ngày kết thúc phải sau ngày bắt đầu.'))
              }
              return Promise.resolve()
            },
          }),
        ]}
      >
        <DatePicker disabled={isContinuous} format="DD/MM/YYYY" className="!w-full" />
      </Form.Item>
      <Form.Item label="Ngân sách tối thiểu (VNĐ)" name="budget_min">
        <InputNumber min={0} step={1_000_000} className="!w-full" />
      </Form.Item>
      <Form.Item
        label="Ngân sách tối đa (VNĐ)"
        name="budget_max"
        dependencies={['budget_min']}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              const minimum = getFieldValue('budget_min')
              return value != null && minimum != null && value < minimum
                ? Promise.reject(new Error('Ngân sách tối đa không được nhỏ hơn tối thiểu.'))
                : Promise.resolve()
            },
          }),
        ]}
      >
        <InputNumber min={0} step={1_000_000} className="!w-full" />
      </Form.Item>
      <Form.Item label="Nguồn ngân sách" name="budget_source">
        <Select options={CAMPAIGN_BUDGET_SOURCE_OPTIONS} />
      </Form.Item>
      <Form.Item className="sm:col-span-2" label="Mô tả ngắn" name="description">
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Mục tiêu, bối cảnh tuyển dụng của chiến dịch" />
      </Form.Item>
      <div className="flex justify-end sm:col-span-2">
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          {submitLabel}
        </Button>
      </div>
    </Form>
  )
}
