import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import {
  CAMPAIGN_BUDGET_SOURCE_OPTIONS,
  campaignKeys,
  createCampaign,
  updateCampaign,
} from '@/entities/campaign/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { useUnsavedChanges } from '@/shared/hooks/use-unsaved-changes'
import { message } from '@/shared/lib/toast'
import { campaignInfoPayload, campaignInfoValues } from '../lib/campaign-info'
import './campaign-info-form.css'

// Thông tin đợt tuyển (thời gian, ngân sách, ghi chú): bước 1 của wizard và hộp sửa trong workspace.
// Chưa có ``public_id`` thì form tạo chiến dịch (nháp) khi lưu.
// Vị trí, cấp bậc và số người cần tuyển thuộc từng tin, không thuộc chiến dịch.
export default function CampaignInfoForm({ campaign, submitLabel = m.employer_campaign_info_submit(), onSaved }) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [dirty, setDirty] = useState(false)
  useUnsavedChanges(dirty)
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
      setDirty(false)
      message.success(isNew ? m.employer_campaign_info_created() : m.employer_campaign_info_saved())
      onSaved?.(updated)
    },
    onError: (error) => {
      const data = error?.response?.data || {}
      const fields = Object.keys(campaignInfoValues(campaign))
        .filter((name) => data[name])
        .map((name) => ({ name, errors: [].concat(data[name]).map(String) }))
      form.setFields(fields)
      message.error(getApiErrorMessage(error, m.employer_campaign_info_save_error()))
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
      onValuesChange={() => setDirty(true)}
      className="cg-form"
    >
      <Form.Item
        label={m.employer_campaign_info_name()}
        name="name"
        rules={[{ required: true, whitespace: true, message: m.employer_campaign_info_name_required() }]}
      >
        <Input maxLength={255} autoFocus={isNew} placeholder={m.employer_campaign_info_name_placeholder()} />
      </Form.Item>

      <section className="cg-section">
        <h3 className="cg-section__title">{m.employer_campaign_info_timeline()}</h3>
        <Form.Item name="is_continuous" className="cg-switch">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: false, label: m.employer_campaign_info_has_end_date() },
              { value: true, label: m.employer_campaign_info_continuous() },
            ]}
          />
        </Form.Item>
        <p className="cg-hint">
          {isContinuous
            ? m.employer_campaign_info_continuous_hint()
            : m.employer_campaign_info_end_date_hint()}
        </p>
        <div className="cg-grid cg-grid--2">
          <Form.Item
            label={m.employer_campaign_info_start_date()}
            name="start_date"
            extra={startLocked ? m.employer_campaign_info_start_locked() : m.employer_campaign_info_start_empty_hint()}
          >
            <DatePicker disabled={startLocked} format="DD/MM/YYYY" placeholder={m.employer_campaign_info_pick_date()} className="!w-full" />
          </Form.Item>
          <Form.Item
            label={m.employer_campaign_info_end_date()}
            name="target_date"
            dependencies={['start_date', 'is_continuous']}
            extra={runDays > 0 ? m.employer_campaign_info_run_days({ count: runDays }) : undefined}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('is_continuous')) return Promise.resolve()
                  if (!value) return Promise.reject(new Error(m.employer_campaign_info_end_date_required()))
                  const start = getFieldValue('start_date')
                  if (start && value.isBefore(start, 'day')) {
                    return Promise.reject(new Error(m.employer_campaign_info_end_after_start()))
                  }
                  return Promise.resolve()
                },
              }),
            ]}
          >
            <DatePicker disabled={isContinuous} format="DD/MM/YYYY" placeholder={m.employer_campaign_info_pick_date()} className="!w-full" />
          </Form.Item>
        </div>
      </section>

      <section className="cg-section">
        <h3 className="cg-section__title">{m.employer_campaign_info_budget()} <span className="cg-optional">{m.employer_campaign_info_optional()}</span></h3>
        <div className="cg-grid cg-grid--3">
          <Form.Item label={m.employer_campaign_info_budget_min()} name="budget_min">
            <InputNumber min={0} step={1_000_000} suffix={m.employer_campaign_currency_suffix()} className="!w-full" />
          </Form.Item>
          <Form.Item
            label={m.employer_campaign_info_budget_max()}
            name="budget_max"
            dependencies={['budget_min']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const minimum = getFieldValue('budget_min')
                  return value != null && minimum != null && value < minimum
                    ? Promise.reject(new Error(m.employer_campaign_info_budget_max_invalid()))
                    : Promise.resolve()
                },
              }),
            ]}
          >
            <InputNumber min={0} step={1_000_000} suffix={m.employer_campaign_currency_suffix()} className="!w-full" />
          </Form.Item>
          <Form.Item label={m.employer_campaign_info_budget_source()} name="budget_source">
            <Select options={CAMPAIGN_BUDGET_SOURCE_OPTIONS} />
          </Form.Item>
        </div>
      </section>

      <section className="cg-section">
        <h3 className="cg-section__title">{m.employer_campaign_info_landing()}</h3>
        <p className="cg-hint">
          {m.employer_campaign_info_landing_hint()}
        </p>
        <Form.Item name="landing_enabled" valuePropName="checked" className="cg-switch">
          <Checkbox>{m.employer_campaign_info_landing_enabled()}</Checkbox>
        </Form.Item>
        <Form.Item label={m.employer_campaign_info_landing_intro()} name="landing_intro">
          <Input.TextArea rows={3} maxLength={1500} showCount placeholder={m.employer_campaign_info_landing_intro_placeholder()} />
        </Form.Item>
      </section>

      <Form.Item label={m.employer_campaign_info_notes()} name="description">
        <Input.TextArea rows={3} maxLength={2000} showCount placeholder={m.employer_campaign_info_notes_placeholder()} />
      </Form.Item>

      <div className="cg-actions">
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>
          {submitLabel}
        </Button>
      </div>
    </Form>
  )
}
