import { CalendarOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Form, InputNumber, Radio, Select } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { getEmployerRecruitmentNeed, saveEmployerRecruitmentNeed } from '@/entities/account/employer-profile'
import { getJobCategories, POSITION_LEVEL_LABELS } from '@/entities/job/job'
import { useSession } from '@/entities/account/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

const CONSULTATION_OPTIONS = [
  { value: 'free_posting', label: m.employer_account_need_topic_free_posting() },
  { value: 'promotions', label: m.employer_account_need_topic_promotions() },
  { value: 'other', label: m.employer_account_need_topic_other() },
]

const POSITION_LEVEL_OPTIONS = Object.entries(POSITION_LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const MIN_BUDGET = 1_000_000
const moneyFormatter = (value) => value == null ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const moneyParser = (value) => value?.replace(/\D/g, '') || ''

export default function RecruitmentNeedForm({ onCompleted }) {
  const [form] = Form.useForm()
  const { refreshSession } = useSession()
  const navigate = useNavigate()
  const continuous = Form.useWatch('is_continuous', form) === true

  const categoriesQuery = useQuery({
    queryKey: ['job-categories', 'consulting-need'],
    queryFn: () => getJobCategories(),
    staleTime: 10 * 60 * 1000,
  })
  const needQuery = useQuery({
    queryKey: ['employer', 'recruitment-need'],
    queryFn: getEmployerRecruitmentNeed,
  })
  const categoryOptions = useMemo(() => (categoriesQuery.data || [])
    .filter((item) => item.category_type === 'specialization')
    .map((item) => ({ value: item.id, label: item.name })), [categoriesQuery.data])

  useEffect(() => {
    const need = needQuery.data
    if (needQuery.isSuccess) {
      form.setFieldsValue(need ? {
        ...need,
        consultation_topic: need.consultation_topics?.[0] || undefined,
        target_date: need.target_date ? dayjs(need.target_date) : null,
      } : {
        position_level: 'employee',
        is_continuous: false,
        headcount: 1,
        budget_source: 'company',
        consultation_topic: undefined,
      })
    }
  }, [form, needQuery.data, needQuery.isSuccess])

  const mutation = useMutation({
    mutationFn: saveEmployerRecruitmentNeed,
    onSuccess: async () => {
      onCompleted?.()
      await refreshSession()
      message.success(m.employer_account_need_saved())
      navigate(employerAppPath('/xac-thuc-tai-khoan'), { replace: true })
    },
    onError: (error) => {
      const data = error.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = Object.entries(data)
          .filter(([name]) => form.getFieldInstance(name))
          .map(([name, errors]) => ({ name, errors: Array.isArray(errors) ? errors.map(String) : [String(errors)] }))
        if (fieldErrors.length) form.setFields(fieldErrors)
      }
    },
  })

  function submit(values) {
    const { consultation_topic: consultationTopic, ...needValues } = values
    mutation.mutate({
      ...needValues,
      target_date: values.is_continuous ? null : values.target_date?.format('YYYY-MM-DD'),
      budget_min: values.budget_min ?? null,
      budget_max: values.budget_max ?? null,
      consultation_topics: consultationTopic ? [consultationTopic] : [],
    })
  }

  return (
    <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} className="mt-7">
      {mutation.isError && (
        <Alert
          type="error"
          showIcon
          message={getApiErrorMessage(mutation.error, m.employer_account_need_save_failed())}
          className="!mb-5 !rounded-lg"
        />
      )}

      <Form.Item
        name="position_category"
        label={<span className="font-semibold">{m.employer_account_need_category_label()} <span className="text-red-500">*</span></span>}
        rules={[{ required: true, message: m.employer_account_need_category_required() }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          loading={categoriesQuery.isLoading}
          placeholder={m.employer_account_need_category_placeholder()}
          options={categoryOptions}
          className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px] [&_.ant-select-selection-placeholder]:!leading-[42px]"
        />
      </Form.Item>

      <Form.Item
        name="position_level"
        label={<span className="font-semibold">{m.employer_account_need_level_label()} <span className="text-red-500">*</span></span>}
        rules={[{ required: true, message: m.employer_account_need_level_required() }]}
      >
        <Select options={POSITION_LEVEL_OPTIONS} className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px]" />
      </Form.Item>

      <div className="grid gap-x-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <Form.Item
            name="target_date"
            label={<span className="font-semibold">{m.employer_account_need_target_date_label()} <span className="text-red-500">*</span></span>}
            rules={[{
              validator: (_, value) => continuous || value
                ? Promise.resolve()
                : Promise.reject(new Error(m.employer_account_need_target_date_required())),
            }]}
          >
            <DatePicker
              format="DD/MM/YYYY"
              placeholder={m.employer_account_need_target_date_placeholder()}
              disabled={continuous}
              disabledDate={(current) => current?.startOf('day').isBefore(dayjs().startOf('day'))}
              suffixIcon={<CalendarOutlined />}
              className="!h-11 !w-full"
            />
          </Form.Item>
          <Form.Item name="is_continuous" valuePropName="checked" className="!-mt-3 !mb-5">
            <Checkbox onChange={(event) => event.target.checked && form.setFieldValue('target_date', null)}>{m.employer_account_need_continuous()}</Checkbox>
          </Form.Item>
        </div>

        <Form.Item
          name="headcount"
          label={<span className="font-semibold">{m.employer_account_need_headcount_label()} <span className="text-red-500">*</span></span>}
          rules={[{ required: true, message: m.employer_account_need_headcount_required() }]}
        >
          <InputNumber
            min={1}
            max={10000}
            controls={{ upIcon: <PlusOutlined />, downIcon: <MinusOutlined /> }}
            className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]"
          />
        </Form.Item>
      </div>

      <Form.Item label={<span className="font-semibold">{m.employer_account_need_budget_label()} <span className="text-xs font-normal text-slate-500">{m.employer_account_need_budget_min_hint()}</span></span>}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Form.Item name="budget_min" noStyle rules={[{ type: 'number', min: MIN_BUDGET, message: m.employer_account_need_budget_min_error() }]}>
            <InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder={m.employer_account_need_budget_from()} className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]" />
          </Form.Item>
          <span className="text-slate-400">–</span>
          <Form.Item name="budget_max" noStyle rules={[{ type: 'number', min: MIN_BUDGET, message: m.employer_account_need_budget_min_error() }]}>
            <InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder={m.employer_account_need_budget_to()} className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]" />
          </Form.Item>
        </div>
      </Form.Item>

      <Form.Item
        name="budget_source"
        label={<span className="font-semibold">{m.employer_account_need_budget_source_label()}</span>}
        rules={[{ required: true, message: m.employer_account_need_budget_source_required() }]}
      >
        <Radio.Group><Radio value="company">{m.employer_account_need_budget_company()}</Radio><Radio value="personal">{m.employer_account_need_budget_personal()}</Radio></Radio.Group>
      </Form.Item>

      <Form.Item name="consultation_topic" label={<span className="font-semibold">{m.employer_account_need_topic_label()}</span>}>
        <Select allowClear placeholder={m.employer_account_need_topic_placeholder()} options={CONSULTATION_OPTIONS} className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px] [&_.ant-select-selection-placeholder]:!leading-[42px]" />
      </Form.Item>

      <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending} className="!mt-5 !h-12 !font-bold">
        {m.employer_account_need_submit()}
      </Button>
    </Form>
  )
}
