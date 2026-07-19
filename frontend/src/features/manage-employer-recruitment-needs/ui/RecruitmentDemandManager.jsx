import { DeleteOutlined, DownOutlined, EditOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, InputNumber, Modal, Popconfirm, Popover, Radio, Select, Switch } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import {
  createEmployerRecruitmentNeed,
  deleteEmployerRecruitmentNeed,
  getEmployerRecruitmentNeeds,
  updateEmployerRecruitmentNeed,
} from '@/entities/employer-profile'
import { getJobCategories, POSITION_LEVEL_LABELS } from '@/entities/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const MIN_BUDGET = 1_000_000
const CONSULTATION_OPTIONS = [
  { value: 'free_posting', label: 'Tôi muốn được đăng tin miễn phí' },
  { value: 'service_packages', label: 'Tìm hiểu các gói dịch vụ' },
  { value: 'promotions', label: 'Chương trình ưu đãi' },
  { value: 'other', label: 'Khác' },
]
const levelOptions = Object.entries(POSITION_LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const money = (value) => value == null ? '' : new Intl.NumberFormat('vi-VN').format(value)
const moneyFormatter = (value) => value == null ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const moneyParser = (value) => value?.replace(/\D/g, '') || ''

function RecruitmentDemandForm({ initialValues, onSubmit, saving, categories }) {
  const [form] = Form.useForm()
  const continuous = Form.useWatch('is_continuous', form)
  const values = initialValues && {
    ...initialValues,
    target_date: initialValues.target_date ? dayjs(initialValues.target_date) : null,
    consultation_topic: initialValues.consultation_topics?.[0],
  }
  return <Form form={form} layout="vertical" className="mt-2" initialValues={values || { position_level: 'employee', headcount: 1, is_continuous: false }} onFinish={(formValues) => onSubmit({
    ...formValues,
    target_date: formValues.is_continuous ? null : formValues.target_date?.format('YYYY-MM-DD'),
    consultation_topics: formValues.consultation_topic ? [formValues.consultation_topic] : [],
  })}>
    <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-slate-600">Cập nhật chính xác nhu cầu để đội ngũ tư vấn hỗ trợ phù hợp hơn.</div>
    <Form.Item name="position_category" label={<span className="font-semibold text-slate-700">Bạn đang tuyển vị trí chuyên môn nào? <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Chọn vị trí chuyên môn' }]}><Select size="large" showSearch optionFilterProp="label" placeholder="Chọn vị trí chuyên môn" options={categories} /></Form.Item>
    <div className="grid gap-4 sm:grid-cols-2">
      <Form.Item name="position_level" label={<span className="font-semibold text-slate-700">Cấp bậc <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Chọn cấp bậc' }]}><Select size="large" options={levelOptions} /></Form.Item>
      <Form.Item name="headcount" label={<span className="font-semibold text-slate-700">Số lượng cần tuyển <span className="text-red-500">*</span></span>} rules={[{ required: true, message: 'Nhập số lượng' }]}><InputNumber size="large" min={1} max={10000} className="!w-full" /></Form.Item>
    </div>
    <Form.Item name="target_date" label={<span className="font-semibold text-slate-700">Thời gian cần tuyển xong là khi nào? <span className="text-red-500">*</span></span>} rules={[{ validator: (_, value) => continuous || value ? Promise.resolve() : Promise.reject(new Error('Chọn thời gian hoặc Tuyển liên tục')) }]}><DatePicker size="large" disabled={continuous} format="DD/MM/YYYY" className="!w-full" /></Form.Item>
    <Form.Item name="is_continuous" valuePropName="checked" className="!-mt-2"><Switch checkedChildren="Tuyển liên tục" unCheckedChildren="Theo thời hạn" onChange={(checked) => checked && form.setFieldValue('target_date', null)} /></Form.Item>
    <Form.Item label="Ngân sách tuyển dụng"><div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3"><Form.Item name="budget_min" noStyle><InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder="Từ" className="!w-full" /></Form.Item><span className="hidden sm:inline">–</span><Form.Item name="budget_max" noStyle><InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder="Đến" className="!w-full" /></Form.Item></div></Form.Item>
    <Form.Item name="consultation_topic" label={<span className="font-semibold text-slate-700">Bạn có nhu cầu cần tư vấn thêm không?</span>}><Select size="large" allowClear placeholder="Chọn nhu cầu tư vấn" options={CONSULTATION_OPTIONS} /></Form.Item>
    <div className="mt-7 grid gap-2 border-t border-slate-100 pt-5 sm:flex sm:justify-end sm:gap-3"><Button size="large" onClick={() => form.resetFields()}>Đặt lại</Button><Button type="primary" size="large" htmlType="submit" loading={saving}>Lưu nhu cầu</Button></div>
  </Form>
}

export default function RecruitmentDemandManager() {
  const client = useQueryClient()
  const [budgetSource, setBudgetSource] = useState('company')
  const [budgetFilterOpen, setBudgetFilterOpen] = useState(false)
  const [pendingBudgetSource, setPendingBudgetSource] = useState('company')
  const [editing, setEditing] = useState(undefined)
  const needsQuery = useQuery({ queryKey: ['employer', 'recruitment-needs'], queryFn: getEmployerRecruitmentNeeds })
  const categoriesQuery = useQuery({ queryKey: ['job-categories', 'recruitment-demand'], queryFn: getJobCategories, staleTime: 600000 })
  const categories = useMemo(() => (categoriesQuery.data || []).filter((item) => item.category_type === 'specialization').map((item) => ({ value: item.id, label: item.name })), [categoriesQuery.data])
  const refresh = () => client.invalidateQueries({ queryKey: ['employer', 'recruitment-needs'] })
  const saveMutation = useMutation({ mutationFn: ({ id, payload }) => id ? updateEmployerRecruitmentNeed(id, payload) : createEmployerRecruitmentNeed(payload), onSuccess: () => { message.success('Đã lưu nhu cầu tuyển dụng.'); setEditing(undefined); refresh() }, onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu nhu cầu tuyển dụng.')) })
  const deleteMutation = useMutation({ mutationFn: deleteEmployerRecruitmentNeed, onSuccess: () => { message.success('Đã xóa nhu cầu tuyển dụng.'); refresh() }, onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xóa nhu cầu tuyển dụng.')) })
  const toggleMutation = useMutation({ mutationFn: ({ id, active }) => updateEmployerRecruitmentNeed(id, { is_active: active }), onSuccess: refresh, onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái.')) })
  const budgetSourceMutation = useMutation({
    mutationFn: (source) => Promise.all((needsQuery.data || []).map((need) => updateEmployerRecruitmentNeed(need.public_id, { budget_source: source }))),
    onSuccess: (_, source) => { setBudgetSource(source); setBudgetFilterOpen(false); message.success('Đã lưu nguồn ngân sách.'); refresh() },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu nguồn ngân sách.')),
  })
  useEffect(() => {
    const source = needsQuery.data?.[0]?.budget_source
    if (source) setBudgetSource(source)
  }, [needsQuery.data])
  const needs = needsQuery.data || []
  const applyBudgetSource = () => budgetSourceMutation.mutate(pendingBudgetSource)
  const budgetFilter = <div className="w-[min(16rem,calc(100vw-48px))]"><p className="mb-3 font-semibold text-slate-800">Nguồn ngân sách</p><Radio.Group value={pendingBudgetSource} onChange={(event) => setPendingBudgetSource(event.target.value)} className="flex flex-col gap-3"><Radio value="company">Công ty</Radio><Radio value="personal">Cá nhân</Radio></Radio.Group><div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3"><Button size="small" disabled={budgetSourceMutation.isPending} onClick={() => { setPendingBudgetSource(budgetSource); setBudgetFilterOpen(false) }}>Hủy</Button><Button type="primary" size="small" loading={budgetSourceMutation.isPending} onClick={applyBudgetSource}>Lưu</Button></div></div>
  return <div>
    <div className="grid items-start gap-4 sm:flex sm:justify-between"><p className="text-sm leading-6 text-slate-600">Vui lòng cập nhật nhu cầu tuyển dụng của doanh nghiệp để chúng tôi có thể hỗ trợ bạn tốt nhất.</p><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)} className="w-full sm:w-auto">Thêm nhu cầu</Button></div>
    <div className="mt-5 grid gap-2 sm:flex sm:items-center sm:gap-3"><div className="flex items-center gap-3"><WalletOutlined className="rounded-full bg-emerald-50 p-2 text-emerald-600" /><span className="text-sm font-medium text-slate-700">Nguồn ngân sách:</span></div><Popover content={budgetFilter} trigger="click" placement="bottomLeft" open={budgetFilterOpen} onOpenChange={(open) => { setBudgetFilterOpen(open); if (open) setPendingBudgetSource(budgetSource) }}><Button className="w-full !text-left sm:!min-w-52 sm:w-auto">{budgetSource === 'company' ? 'Công ty' : 'Cá nhân'} <DownOutlined className="float-right mt-1 text-xs" /></Button></Popover></div>
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
      <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.15fr_.8fr_.38fr_.85fr_1.15fr_1.25fr_140px] lg:gap-3"><span>Vị trí chuyên môn</span><span>Cấp bậc</span><span>SL tuyển</span><span>Thời gian</span><span>Ngân sách</span><span>Nhu cầu tư vấn</span><span>Thao tác</span></div>
      {needs.map((item) => <div key={item.public_id} className="grid min-w-0 gap-3 border-t border-slate-100 px-4 py-4 text-sm first:border-t-0 sm:grid-cols-2 lg:grid-cols-[1.15fr_.8fr_.38fr_.85fr_1.15fr_1.25fr_140px] lg:items-center lg:gap-3"><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">Vị trí chuyên môn</span><p className="break-words font-medium text-slate-700">{item.position_category_name}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">Cấp bậc</span><p className="break-words">{item.position_level_label}</p></div><div><span className="text-xs text-slate-400 lg:hidden">SL tuyển</span><p>{item.headcount}</p></div><div><span className="text-xs text-slate-400 lg:hidden">Thời gian</span><p>{item.is_continuous ? 'Tuyển liên tục' : dayjs(item.target_date).format('DD/MM/YYYY')}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">Ngân sách</span><p className="break-words">{item.budget_min == null ? 'Chưa cập nhật' : `${money(item.budget_min)} - ${money(item.budget_max)}`}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">Nhu cầu tư vấn</span><p className="break-words">{CONSULTATION_OPTIONS.find((option) => option.value === item.consultation_topics?.[0])?.label || '—'}</p></div><div className="flex items-center justify-end gap-1 sm:justify-start"><Switch size="small" checked={item.is_active} loading={toggleMutation.isPending} onChange={(active) => toggleMutation.mutate({ id: item.public_id, active })} /><Button type="text" aria-label="Chỉnh sửa nhu cầu" icon={<EditOutlined />} onClick={() => setEditing(item)} /><Popconfirm title="Xóa nhu cầu tuyển dụng này?" okText="Xóa" cancelText="Hủy" onConfirm={() => deleteMutation.mutate(item.public_id)}><Button type="text" danger aria-label="Xóa nhu cầu" icon={<DeleteOutlined />} /></Popconfirm></div></div>)}
      {!needsQuery.isLoading && needs.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Chưa có nhu cầu tuyển dụng.</p>}
    </div>
    <Modal open={editing !== undefined} title={editing ? 'Chỉnh sửa nhu cầu tuyển dụng' : 'Thêm nhu cầu tuyển dụng'} footer={null} width={680} onCancel={() => setEditing(undefined)} destroyOnHidden className="max-sm:!top-3 max-sm:!m-0 max-sm:!w-[calc(100vw-24px)] max-sm:!max-w-none">
      <RecruitmentDemandForm initialValues={editing} categories={categories} saving={saveMutation.isPending} onSubmit={(payload) => saveMutation.mutate({ id: editing?.public_id, payload: { ...payload, budget_source: budgetSource } })} />
    </Modal>
  </div>
}
