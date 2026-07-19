import { CalendarOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Form, InputNumber, Radio, Select } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployerRecruitmentNeed, saveEmployerRecruitmentNeed } from '@/entities/employer-profile'
import { getJobCategories, POSITION_LEVEL_LABELS } from '@/entities/job'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

const CONSULTATION_OPTIONS = [
  { value: 'free_posting', label: 'Tôi muốn được đăng tin miễn phí' },
  { value: 'service_packages', label: 'Tôi muốn tìm hiểu thêm về các gói dịch vụ' },
  { value: 'promotions', label: 'Tôi muốn biết thêm về các chương trình ưu đãi' },
  { value: 'other', label: 'Khác' },
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
    queryFn: getJobCategories,
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
      message.success('Đã ghi nhận nhu cầu tuyển dụng của bạn.')
      navigate(employerAppPath('/employer-verify'), { replace: true })
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
          message={getApiErrorMessage(mutation.error, 'Không thể lưu nhu cầu tuyển dụng.')}
          className="!mb-5 !rounded-lg"
        />
      )}

      <Form.Item
        name="position_category"
        label={<span className="font-semibold">Bạn đang tuyển dụng vị trí chuyên môn nào? <span className="text-red-500">*</span></span>}
        rules={[{ required: true, message: 'Vui lòng chọn vị trí chuyên môn' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          loading={categoriesQuery.isLoading}
          placeholder="Chọn vị trí chuyên môn"
          options={categoryOptions}
          className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px] [&_.ant-select-selection-placeholder]:!leading-[42px]"
        />
      </Form.Item>

      <Form.Item
        name="position_level"
        label={<span className="font-semibold">Cấp bậc <span className="text-red-500">*</span></span>}
        rules={[{ required: true, message: 'Vui lòng chọn cấp bậc' }]}
      >
        <Select options={POSITION_LEVEL_OPTIONS} className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px]" />
      </Form.Item>

      <div className="grid gap-x-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <Form.Item
            name="target_date"
            label={<span className="font-semibold">Thời gian cần tuyển xong là khi nào? <span className="text-red-500">*</span></span>}
            rules={[{
              validator: (_, value) => continuous || value
                ? Promise.resolve()
                : Promise.reject(new Error('Chọn thời gian hoặc chọn Tuyển liên tục')),
            }]}
          >
            <DatePicker
              format="DD/MM/YYYY"
              placeholder="Chọn thời gian"
              disabled={continuous}
              disabledDate={(current) => current?.startOf('day').isBefore(dayjs().startOf('day'))}
              suffixIcon={<CalendarOutlined />}
              className="!h-11 !w-full"
            />
          </Form.Item>
          <Form.Item name="is_continuous" valuePropName="checked" className="!-mt-3 !mb-5">
            <Checkbox onChange={(event) => event.target.checked && form.setFieldValue('target_date', null)}>Tuyển liên tục</Checkbox>
          </Form.Item>
        </div>

        <Form.Item
          name="headcount"
          label={<span className="font-semibold">Số lượng cần tuyển <span className="text-red-500">*</span></span>}
          rules={[{ required: true, message: 'Nhập số lượng cần tuyển' }]}
        >
          <InputNumber
            min={1}
            max={10000}
            controls={{ upIcon: <PlusOutlined />, downIcon: <MinusOutlined /> }}
            className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]"
          />
        </Form.Item>
      </div>

      <Form.Item label={<span className="font-semibold">Ngân sách tuyển dụng cho vị trí này của bạn là? <span className="text-xs font-normal text-slate-500">(tối thiểu 1.000.000đ)</span></span>}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Form.Item name="budget_min" noStyle rules={[{ type: 'number', min: MIN_BUDGET, message: 'Ngân sách tối thiểu là 1.000.000đ' }]}>
            <InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder="Từ" className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]" />
          </Form.Item>
          <span className="text-slate-400">–</span>
          <Form.Item name="budget_max" noStyle rules={[{ type: 'number', min: MIN_BUDGET, message: 'Ngân sách tối thiểu là 1.000.000đ' }]}>
            <InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder="Đến" className="!h-11 !w-full [&_.ant-input-number-input]:!h-[42px]" />
          </Form.Item>
        </div>
      </Form.Item>

      <Form.Item
        name="budget_source"
        label={<span className="font-semibold">Chọn nguồn ngân sách tuyển dụng của bạn</span>}
        rules={[{ required: true, message: 'Vui lòng chọn nguồn ngân sách' }]}
      >
        <Radio.Group><Radio value="company">Công ty</Radio><Radio value="personal">Cá nhân</Radio></Radio.Group>
      </Form.Item>

      <Form.Item name="consultation_topic" label={<span className="font-semibold">Bạn có nhu cầu cần tư vấn kỹ hơn về vấn đề nào không?</span>}>
        <Select allowClear placeholder="Chọn một nhu cầu tư vấn" options={CONSULTATION_OPTIONS} className="[&_.ant-select-selector]:!h-11 [&_.ant-select-selection-item]:!leading-[42px] [&_.ant-select-selection-placeholder]:!leading-[42px]" />
      </Form.Item>

      <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending} className="!mt-5 !h-12 !font-bold">
        Hoàn thành
      </Button>
    </Form>
  )
}
