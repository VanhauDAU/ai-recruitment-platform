import { DeleteOutlined, DownOutlined, EditOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, InputNumber, Modal, Popover, Radio, Select, Switch } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useEffect, useMemo, useState } from 'react'
import {
  createEmployerRecruitmentNeed,
  deleteEmployerRecruitmentNeed,
  getEmployerRecruitmentNeeds,
  updateEmployerRecruitmentNeed,
} from '@/entities/account/employer-profile'
import { getJobCategories, POSITION_LEVEL_LABELS } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import { getIntlLocale, m } from '@/shared/config/i18n'

const MIN_BUDGET = 1_000_000
const CONSULTATION_OPTIONS = [
  { value: 'free_posting', label: m.employer_account_need_topic_free_posting() },
  { value: 'service_packages', label: m.employer_account_need_topic_service_packages_short() },
  { value: 'promotions', label: m.employer_account_need_topic_promotions_short() },
  { value: 'other', label: m.employer_account_need_topic_other() },
]
const levelOptions = Object.entries(POSITION_LEVEL_LABELS).map(([value, label]) => ({ value, label }))
const money = (value) => value == null ? '' : new Intl.NumberFormat(getIntlLocale()).format(value)
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
    <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm leading-6 text-slate-600">{m.employer_account_need_form_intro()}</div>
    <Form.Item name="position_category" label={<span className="font-semibold text-slate-700">{m.employer_account_need_category_label_short()} <span className="text-red-500">*</span></span>} rules={[{ required: true, message: m.employer_account_need_category_placeholder() }]}><Select size="large" showSearch optionFilterProp="label" placeholder={m.employer_account_need_category_placeholder()} options={categories} /></Form.Item>
    <div className="grid gap-4 sm:grid-cols-2">
      <Form.Item name="position_level" label={<span className="font-semibold text-slate-700">{m.employer_account_need_level_label()} <span className="text-red-500">*</span></span>} rules={[{ required: true, message: m.employer_account_need_level_choose() }]}><Select size="large" options={levelOptions} /></Form.Item>
      <Form.Item name="headcount" label={<span className="font-semibold text-slate-700">{m.employer_account_need_headcount_label()} <span className="text-red-500">*</span></span>} rules={[{ required: true, message: m.employer_account_need_headcount_short() }]}><InputNumber size="large" min={1} max={10000} className="!w-full" /></Form.Item>
    </div>
    <Form.Item name="target_date" label={<span className="font-semibold text-slate-700">{m.employer_account_need_target_date_label()} <span className="text-red-500">*</span></span>} rules={[{ validator: (_, value) => continuous || value ? Promise.resolve() : Promise.reject(new Error(m.employer_account_need_target_date_required_short())) }]}><DatePicker size="large" disabled={continuous} format="DD/MM/YYYY" className="!w-full" /></Form.Item>
    <Form.Item name="is_continuous" valuePropName="checked" className="!-mt-2"><Switch checkedChildren={m.employer_account_need_continuous()} unCheckedChildren={m.employer_account_need_deadline()} onChange={(checked) => checked && form.setFieldValue('target_date', null)} /></Form.Item>
    <Form.Item label={m.employer_account_need_budget()}><div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3"><Form.Item name="budget_min" noStyle><InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder={m.employer_account_need_budget_from()} className="!w-full" /></Form.Item><span className="hidden sm:inline">–</span><Form.Item name="budget_max" noStyle><InputNumber min={MIN_BUDGET} formatter={moneyFormatter} parser={moneyParser} placeholder={m.employer_account_need_budget_to()} className="!w-full" /></Form.Item></div></Form.Item>
    <Form.Item name="consultation_topic" label={<span className="font-semibold text-slate-700">{m.employer_account_need_topic_label_short()}</span>}><Select size="large" allowClear placeholder={m.employer_account_need_topic_placeholder()} options={CONSULTATION_OPTIONS} /></Form.Item>
    <div className="mt-7 grid gap-2 border-t border-slate-100 pt-5 sm:flex sm:justify-end sm:gap-3"><Button size="large" onClick={() => form.resetFields()}>{m.employer_account_need_reset()}</Button><Button type="primary" size="large" htmlType="submit" loading={saving}>{m.employer_account_need_save()}</Button></div>
  </Form>
}

export default function RecruitmentDemandManager() {
  const client = useQueryClient()
  const [budgetSource, setBudgetSource] = useState('company')
  const [budgetFilterOpen, setBudgetFilterOpen] = useState(false)
  const [pendingBudgetSource, setPendingBudgetSource] = useState('company')
  const [editing, setEditing] = useState(undefined)
  const needsQuery = useQuery({ queryKey: ['employer', 'recruitment-needs'], queryFn: getEmployerRecruitmentNeeds })
  const categoriesQuery = useQuery({ queryKey: ['job-categories', 'recruitment-demand'], queryFn: () => getJobCategories(), staleTime: 600000 })
  const categories = useMemo(() => (categoriesQuery.data || []).filter((item) => item.category_type === 'specialization').map((item) => ({ value: item.id, label: item.name })), [categoriesQuery.data])
  const refresh = () => client.invalidateQueries({ queryKey: ['employer', 'recruitment-needs'] })
  const saveMutation = useMutation({ mutationFn: ({ id, payload }) => id ? updateEmployerRecruitmentNeed(id, payload) : createEmployerRecruitmentNeed(payload), onSuccess: () => { message.success(m.employer_account_need_saved_short()); setEditing(undefined); refresh() }, onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_need_save_failed())) })
  const deleteMutation = useMutation({ mutationFn: deleteEmployerRecruitmentNeed, onSuccess: () => { message.success(m.employer_account_need_deleted()); refresh() }, onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_need_delete_failed())) })
  const toggleMutation = useMutation({ mutationFn: ({ id, active }) => updateEmployerRecruitmentNeed(id, { is_active: active }), onSuccess: refresh, onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_need_status_failed())) })
  const budgetSourceMutation = useMutation({
    mutationFn: (source) => Promise.all((needsQuery.data || []).map((need) => updateEmployerRecruitmentNeed(need.public_id, { budget_source: source }))),
    onSuccess: (_, source) => { setBudgetSource(source); setBudgetFilterOpen(false); message.success(m.employer_account_need_budget_source_saved()); refresh() },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_need_budget_source_failed())),
  })
  useEffect(() => {
    const source = needsQuery.data?.[0]?.budget_source
    if (source) setBudgetSource(source)
  }, [needsQuery.data])
  const needs = needsQuery.data || []
  const applyBudgetSource = () => budgetSourceMutation.mutate(pendingBudgetSource)
  const budgetFilter = <div className="w-[min(16rem,calc(100vw-48px))]"><p className="mb-3 font-semibold text-slate-800">{m.employer_account_need_budget_source()}</p><Radio.Group value={pendingBudgetSource} onChange={(event) => setPendingBudgetSource(event.target.value)} className="flex flex-col gap-3"><Radio value="company">{m.employer_account_need_budget_company()}</Radio><Radio value="personal">{m.employer_account_need_budget_personal()}</Radio></Radio.Group><div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3"><Button size="small" disabled={budgetSourceMutation.isPending} onClick={() => { setPendingBudgetSource(budgetSource); setBudgetFilterOpen(false) }}>{m.employer_account_docs_cancel()}</Button><Button type="primary" size="small" loading={budgetSourceMutation.isPending} onClick={applyBudgetSource}>{m.employer_account_docs_save()}</Button></div></div>
  return <div>
    <div className="grid items-start gap-4 sm:flex sm:justify-between"><p className="text-sm leading-6 text-slate-600">{m.employer_account_need_manager_intro()}</p><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)} className="w-full sm:w-auto">{m.employer_account_need_add()}</Button></div>
    <div className="mt-5 grid gap-2 sm:flex sm:items-center sm:gap-3"><div className="flex items-center gap-3"><WalletOutlined className="rounded-full bg-emerald-50 p-2 text-emerald-600" /><span className="text-sm font-medium text-slate-700">{m.employer_account_need_budget_source_label_colon()}</span></div><Popover content={budgetFilter} trigger="click" placement="bottomLeft" open={budgetFilterOpen} onOpenChange={(open) => { setBudgetFilterOpen(open); if (open) setPendingBudgetSource(budgetSource) }}><Button className="w-full !text-left sm:!min-w-52 sm:w-auto">{budgetSource === 'company' ? m.employer_account_need_budget_company() : m.employer_account_need_budget_personal()} <DownOutlined className="float-right mt-1 text-xs" /></Button></Popover></div>
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
      <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[1.15fr_.8fr_.38fr_.85fr_1.15fr_1.25fr_140px] lg:gap-3"><span>{m.employer_account_need_col_category()}</span><span>{m.employer_account_need_level_label()}</span><span>{m.employer_account_need_col_headcount()}</span><span>{m.employer_account_need_col_time()}</span><span>{m.employer_account_need_col_budget()}</span><span>{m.employer_account_need_col_topic()}</span><span>{m.employer_account_need_col_actions()}</span></div>
      {needs.map((item) => <div key={item.public_id} className="grid min-w-0 gap-3 border-t border-slate-100 px-4 py-4 text-sm first:border-t-0 sm:grid-cols-2 lg:grid-cols-[1.15fr_.8fr_.38fr_.85fr_1.15fr_1.25fr_140px] lg:items-center lg:gap-3"><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_col_category()}</span><p className="break-words font-medium text-slate-700">{item.position_category_name}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_level_label()}</span><p className="break-words">{item.position_level_label}</p></div><div><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_col_headcount()}</span><p>{item.headcount}</p></div><div><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_col_time()}</span><p>{item.is_continuous ? m.employer_account_need_continuous() : dayjs(item.target_date).format('DD/MM/YYYY')}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_col_budget()}</span><p className="break-words">{item.budget_min == null ? m.employer_account_docs_not_updated() : `${money(item.budget_min)} - ${money(item.budget_max)}`}</p></div><div className="min-w-0"><span className="text-xs text-slate-400 lg:hidden">{m.employer_account_need_col_topic()}</span><p className="break-words">{CONSULTATION_OPTIONS.find((option) => option.value === item.consultation_topics?.[0])?.label || '—'}</p></div><div className="flex items-center justify-end gap-1 sm:justify-start"><Switch size="small" checked={item.is_active} loading={toggleMutation.isPending} onChange={(active) => toggleMutation.mutate({ id: item.public_id, active })} /><Button type="text" aria-label={m.employer_account_need_edit_aria()} icon={<EditOutlined />} onClick={() => setEditing(item)} /><ConfirmAction title={m.employer_account_need_delete_title()} description={<>{m.employer_account_need_delete_desc_before()}<strong>{item.position_category_name}</strong>{m.employer_account_need_delete_desc_after()}<br />{m.employer_account_need_delete_irreversible()}</>} confirmText={m.employer_account_need_delete()} cancelText={m.employer_account_domain_close()} danger disabled={deleteMutation.isPending} onConfirm={() => deleteMutation.mutateAsync(item.public_id)}><Button type="text" danger disabled={deleteMutation.isPending} aria-label={m.employer_account_need_delete_aria()} icon={<DeleteOutlined />} /></ConfirmAction></div></div>)}
      {!needsQuery.isLoading && needs.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">{m.employer_account_need_empty()}</p>}
    </div>
    <Modal open={editing !== undefined} title={editing ? m.employer_account_need_edit_title() : m.employer_account_need_add_title()} footer={null} width={680} onCancel={() => setEditing(undefined)} destroyOnHidden className="max-sm:!top-3 max-sm:!m-0 max-sm:!w-[calc(100vw-24px)] max-sm:!max-w-none">
      <RecruitmentDemandForm initialValues={editing} categories={categories} saving={saveMutation.isPending} onSubmit={(payload) => saveMutation.mutate({ id: editing?.public_id, payload: { ...payload, budget_source: budgetSource } })} />
    </Modal>
  </div>
}
