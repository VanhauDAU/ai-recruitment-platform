import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select } from 'antd'
import dayjs from 'dayjs'
import {
  CAMPAIGN_BUDGET_SOURCE_OPTIONS,
  campaignKeys,
  createCampaign,
  updateCampaign,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { campaignInfoPayload, campaignInfoValues } from '../lib/campaign-info'
import './campaign-info-form.css'

// Thông tin đợt tuyển (thời gian, ngân sách, ghi chú): bước 1 của wizard và hộp sửa trong workspace.
// Chưa có ``public_id`` thì form tạo chiến dịch (nháp) khi lưu.
// Vị trí, cấp bậc và số người cần tuyển thuộc từng tin, không thuộc chiến dịch.
export default function CampaignInfoForm({ campaign, submitLabel = 'Lưu thông tin', onSaved }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const isContinuous = Form.useWatch('is_continuous', form)
  const isNew = !campaign.public_id
  const startLocked = !isNew && !['draft', 'scheduled'].includes(campaign.status)
  const mutation = useMutation({
    mutationFn: (payload) => (isNew ? createCampaign(payload) : updateCampaign(campaign.public_id, payload)),
    onSuccess: (updated) => {
      queryClient.setQueryData(campaignKeys.detail(updated.public_id), (current) => ({
        ...current,
        ...updated,
      }))
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      message.success(isNew ? 'Đã tạo chiến dịch nháp.' : 'Đã lưu thông tin chiến dịch.')
      onSaved?.(updated)
    },
    onError: (error) => {
      const data = error?.response?.data || {}
      const fields = Object.keys(campaignInfoValues(campaign))
        .filter((name) => data[name])
        .map((name) => ({ name, errors: [].concat(data[name]).map(String) }))
      form.setFields(fields)
      message.error(getApiErrorMessage(error, 'Không thể lưu thông tin chiến dịch.'))
    },
  })

  function handleFinish(values) {
    mutation.mutate(campaignInfoPayload(values))
  }

  const startDate = Form.useWatch('start_date', form)
  const targetDate = Form.useWatch('target_date', form)
  const runDays = !isContinuous && targetDate
    ? targetDate.diff(startDate || dayjs(), 'day') + 1
    : null

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={campaignInfoValues(campaign)}
      onFinish={handleFinish}
      className="cg-form"
    >
      <Form.Item
        label="Tên chiến dịch"
        name="name"
        rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
      >
        <Input maxLength={255} autoFocus={isNew} placeholder="Ví dụ: Tuyển đội marketing tháng 12" />
      </Form.Item>

      <section className="cg-section">
        <h3 className="cg-section__title">Thời gian</h3>
        <Form.Item name="is_continuous" className="cg-switch">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: false, label: 'Có ngày kết thúc' },
              { value: true, label: 'Tuyển liên tục' },
            ]}
          />
        </Form.Item>
        <p className="cg-hint">
          {isContinuous
            ? 'Chiến dịch chạy tới khi bạn hoàn tất. Không tự kết thúc.'
            : 'Hết ngày kết thúc, chiến dịch tự hoàn tất và các tin ngừng nhận hồ sơ.'}
        </p>
        <div className="cg-grid cg-grid--2">
          <Form.Item
            label="Ngày bắt đầu"
            name="start_date"
            extra={startLocked ? 'Chiến dịch đã chạy nên không đổi được.' : 'Để trống thì bắt đầu khi bạn kích hoạt.'}
          >
            <DatePicker disabled={startLocked} format="DD/MM/YYYY" placeholder="Chọn ngày" className="!w-full" />
          </Form.Item>
          <Form.Item
            label="Ngày kết thúc"
            name="target_date"
            dependencies={['start_date', 'is_continuous']}
            extra={runDays > 0 ? `Khoảng ${runDays} ngày chạy.` : undefined}
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
            <DatePicker disabled={isContinuous} format="DD/MM/YYYY" placeholder="Chọn ngày" className="!w-full" />
          </Form.Item>
        </div>
      </section>

      <section className="cg-section">
        <h3 className="cg-section__title">Ngân sách <span className="cg-optional">không bắt buộc</span></h3>
        <div className="cg-grid cg-grid--3">
          <Form.Item label="Tối thiểu" name="budget_min">
            <InputNumber min={0} step={1_000_000} suffix="đ" className="!w-full" />
          </Form.Item>
          <Form.Item
            label="Tối đa"
            name="budget_max"
            dependencies={['budget_min']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const minimum = getFieldValue('budget_min')
                  return value != null && minimum != null && value < minimum
                    ? Promise.reject(new Error('Không được nhỏ hơn mức tối thiểu.'))
                    : Promise.resolve()
                },
              }),
            ]}
          >
            <InputNumber min={0} step={1_000_000} suffix="đ" className="!w-full" />
          </Form.Item>
          <Form.Item label="Nguồn" name="budget_source">
            <Select options={CAMPAIGN_BUDGET_SOURCE_OPTIONS} />
          </Form.Item>
        </div>
      </section>

      <section className="cg-section">
        <h3 className="cg-section__title">Trang tuyển dụng công khai</h3>
        <p className="cg-hint">
          Link của các kênh dẫn ứng viên tới trang này: giới thiệu đợt tuyển, công ty và các tin đang tuyển.
        </p>
        <Form.Item name="landing_enabled" valuePropName="checked" className="cg-switch">
          <Checkbox>Cho phép xem trang tuyển dụng của chiến dịch</Checkbox>
        </Form.Item>
        <Form.Item label="Lời giới thiệu" name="landing_intro">
          <Input.TextArea rows={3} maxLength={1500} showCount placeholder="Vì sao ứng viên nên tham gia đợt tuyển này" />
        </Form.Item>
      </section>

      <Form.Item label="Ghi chú nội bộ" name="description">
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Bối cảnh tuyển dụng, yêu cầu riêng của đợt này" />
      </Form.Item>

      <div className="cg-actions">
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          {submitLabel}
        </Button>
      </div>
    </Form>
  )
}
