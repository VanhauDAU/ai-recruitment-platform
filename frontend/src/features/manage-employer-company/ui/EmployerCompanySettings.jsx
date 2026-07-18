import { BankOutlined, CheckCircleFilled, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Form, Input, Modal, Radio, Result, Select, Skeleton, Tabs, Tag, Upload } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createEmployerCompany,
  getEmployerIndustries,
  getEmployerProfile,
  joinEmployerCompany,
  searchEmployerCompanies,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'

const COMPANY_SIZE_OPTIONS = [
  ['1-9', '1 – 9 nhân viên'],
  ['10-24', '10 – 24 nhân viên'],
  ['25-99', '25 – 99 nhân viên'],
  ['100-499', '100 – 499 nhân viên'],
  ['500-1000', '500 – 1.000 nhân viên'],
  ['1000+', '1.000+ nhân viên'],
].map(([value, label]) => ({ value, label }))

function SearchCompanyTab({ disabled, onLinked }) {
  const { message } = App.useApp()
  const [query, setQuery] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [proofType, setProofType] = useState('business_registration')
  const [businessFile, setBusinessFile] = useState(null)
  const [authorizationFile, setAuthorizationFile] = useState(null)
  const [identityFile, setIdentityFile] = useState(null)
  const searchMutation = useMutation({
    mutationFn: searchEmployerCompanies,
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tìm kiếm công ty.')),
  })
  const joinMutation = useMutation({
    mutationFn: joinEmployerCompany,
    onSuccess: async () => {
      message.success('Đã gửi yêu cầu liên kết công ty và giấy tờ xác minh.')
      setSelectedCompany(null)
      await onLinked()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể liên kết công ty.')),
  })

  function submitJoin() {
    if (proofType === 'business_registration' && !businessFile) {
      message.warning('Chọn giấy đăng ký doanh nghiệp.')
      return
    }
    if (proofType === 'authorization_and_id' && (!authorizationFile || !identityFile)) {
      message.warning('Chọn đủ giấy ủy quyền và giấy tờ định danh.')
      return
    }
    joinMutation.mutate({
      company: selectedCompany.public_id,
      proof_type: proofType,
      business_registration_file: businessFile,
      authorization_file: authorizationFile,
      identity_file: identityFile,
    })
  }

  const results = searchMutation.data || []
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input size="large" value={query} onChange={(event) => setQuery(event.target.value)} onPressEnter={() => query.trim() && searchMutation.mutate(query.trim())} prefix={<SearchOutlined />} placeholder="Tên công ty, tên thương mại hoặc mã số thuế" />
        <Button type="primary" size="large" icon={<SearchOutlined />} loading={searchMutation.isPending} disabled={query.trim().length < 2} onClick={() => searchMutation.mutate(query.trim())}>Tìm kiếm</Button>
      </div>
      <Alert type="info" showIcon className="!mt-4" title="Sử dụng tên hoặc mã số thuế trùng khớp dữ liệu doanh nghiệp để việc xác thực nhanh hơn." />
      <div className="mt-5 space-y-3">
        {results.map((company) => (
          <article key={company.public_id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600"><BankOutlined /></span>
            <div className="min-w-0 flex-1"><h3 className="font-extrabold text-slate-900">{company.company_name}</h3><p className="mt-1 text-xs text-slate-500">MST: {company.tax_code || 'Chưa cập nhật'} · {company.address || 'Chưa cập nhật địa chỉ'}</p><div className="mt-2 flex flex-wrap gap-1">{(company.industries_detail || []).map((item) => <Tag key={item.id}>{item.name}</Tag>)}</div></div>
            <Button disabled={disabled} onClick={() => setSelectedCompany(company)}>Chọn</Button>
          </article>
        ))}
        {searchMutation.isSuccess && results.length === 0 && <Result status="info" title="Không tìm thấy công ty phù hợp" subTitle="Hãy thử tên khác hoặc chuyển sang tab Tạo công ty mới." />}
      </div>

      <Modal open={Boolean(selectedCompany)} onCancel={() => setSelectedCompany(null)} footer={null} title={`Xác minh quyền liên kết với ${selectedCompany?.company_name || ''}`}>
        <Radio.Group value={proofType} onChange={(event) => setProofType(event.target.value)} className="grid gap-3">
          <Radio value="business_registration">Giấy đăng ký doanh nghiệp hoặc tương đương</Radio>
          <Radio value="authorization_and_id">Giấy ủy quyền và giấy tờ định danh</Radio>
        </Radio.Group>
        <div className="mt-5 space-y-3">
          {proofType === 'business_registration' ? (
            <Upload maxCount={1} beforeUpload={(file) => { setBusinessFile(file); return false }} onRemove={() => setBusinessFile(null)} accept=".jpg,.jpeg,.png,.pdf"><Button icon={<UploadOutlined />}>Chọn giấy ĐKDN</Button></Upload>
          ) : (
            <>
              <Upload maxCount={1} beforeUpload={(file) => { setAuthorizationFile(file); return false }} onRemove={() => setAuthorizationFile(null)} accept=".jpg,.jpeg,.png,.pdf"><Button icon={<UploadOutlined />}>Chọn giấy ủy quyền</Button></Upload>
              <Upload maxCount={1} beforeUpload={(file) => { setIdentityFile(file); return false }} onRemove={() => setIdentityFile(null)} accept=".jpg,.jpeg,.png,.pdf"><Button icon={<UploadOutlined />}>Chọn giấy tờ định danh</Button></Upload>
            </>
          )}
        </div>
        <Button type="primary" size="large" block loading={joinMutation.isPending} onClick={submitJoin} className="!mt-6">Gửi yêu cầu liên kết</Button>
      </Modal>
    </div>
  )
}

function CreateCompanyTab({ disabled, industries, onCreated }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const selectedIndustries = Form.useWatch('industries', form) || []
  const hasNoWebsite = Form.useWatch('has_no_website', form)
  const tradeNameMatches = Form.useWatch('trade_name_same_as_registered', form) ?? true
  const mutation = useMutation({
    mutationFn: createEmployerCompany,
    onSuccess: async () => {
      message.success('Đã tạo và liên kết hồ sơ công ty.')
      await onCreated()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể tạo hồ sơ công ty.')),
  })
  const industryOptions = industries.map((item) => ({ value: item.id, label: item.name }))

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={disabled}
      initialValues={{ business_type: 'enterprise', has_no_website: false, has_no_logo: true, trade_name_same_as_registered: true, markets: [], target_customers: [] }}
      onFinish={(values) => mutation.mutate({
        ...values,
        website_url: values.has_no_website ? '' : values.website_url,
        trade_name: values.trade_name_same_as_registered ? values.company_name : values.trade_name,
        employee_benefits: values.employee_benefits || '',
      })}
    >
      <Form.Item name="business_type" label="Loại hình" rules={[{ required: true }]}><Radio.Group options={[{ value: 'enterprise', label: 'Doanh nghiệp' }, { value: 'household', label: 'Hộ kinh doanh' }]} /></Form.Item>
      <div className="grid gap-x-4 md:grid-cols-2">
        <Form.Item name="tax_code" label="Mã số thuế" rules={[{ required: true, message: 'Nhập mã số thuế' }]}><Input size="large" placeholder="0101234567" /></Form.Item>
        <Form.Item name="company_name" label="Tên công ty" rules={[{ required: true, message: 'Nhập tên công ty' }, { min: 2 }]}><Input size="large" placeholder="Công ty TNHH ABC" /></Form.Item>
        <Form.Item name="trade_name_same_as_registered" valuePropName="checked" className="md:col-span-2"><Checkbox>Tên thương mại trùng tên đăng ký kinh doanh</Checkbox></Form.Item>
        {!tradeNameMatches && <Form.Item name="trade_name" label="Tên thương mại" rules={[{ required: true, message: 'Nhập tên thương mại' }]} className="md:col-span-2"><Input size="large" placeholder="ABC" /></Form.Item>}
        <Form.Item name="industries" label="Lĩnh vực hoạt động" rules={[{ required: true, message: 'Chọn ít nhất một lĩnh vực' }]} className="md:col-span-2"><Select mode="multiple" size="large" showSearch optionFilterProp="label" options={industryOptions} placeholder="Chọn lĩnh vực" /></Form.Item>
        <Form.Item name="primary_industry" label="Lĩnh vực chính" rules={[{ required: true, message: 'Chọn lĩnh vực chính' }]}><Select size="large" options={industryOptions.filter((item) => selectedIndustries.includes(item.value))} /></Form.Item>
        <Form.Item name="company_size" label="Quy mô" rules={[{ required: true, message: 'Chọn quy mô' }]}><Select size="large" options={COMPANY_SIZE_OPTIONS} /></Form.Item>
        <Form.Item name="email" label="Email công ty" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}><Input size="large" /></Form.Item>
        <Form.Item name="phone" label="Số điện thoại công ty" rules={[{ required: true, message: 'Nhập số điện thoại' }]}><Input size="large" /></Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ required: true, message: 'Nhập địa chỉ' }]} className="md:col-span-2"><Input size="large" /></Form.Item>
        <Form.Item name="has_no_website" valuePropName="checked" className="md:col-span-2"><Checkbox>Tôi không có website</Checkbox></Form.Item>
        {!hasNoWebsite && <Form.Item name="website_url" label="Website" rules={[{ required: true, message: 'Nhập website hoặc chọn không có website' }, { type: 'url', message: 'URL không hợp lệ' }]} className="md:col-span-2"><Input size="large" placeholder="https://congty.vn" /></Form.Item>}
        <Form.Item name="description" label="Mô tả công ty" rules={[{ required: true, min: 20, message: 'Mô tả tối thiểu 20 ký tự' }]} className="md:col-span-2"><Input.TextArea rows={5} showCount maxLength={10000} /></Form.Item>
        <Form.Item name="employee_benefits" label="Phúc lợi nhân viên" className="md:col-span-2"><Input.TextArea rows={3} maxLength={10000} /></Form.Item>
      </div>
      <Button type="primary" htmlType="submit" size="large" block icon={<PlusOutlined />} loading={mutation.isPending}>Lưu và liên kết công ty</Button>
    </Form>
  )
}

export default function EmployerCompanySettings() {
  const queryClient = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const industriesQuery = useQuery({ queryKey: ['employer', 'industries'], queryFn: getEmployerIndustries, staleTime: 10 * 60 * 1000 })
  async function refreshProfile() {
    await Promise.all([
      profileQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
    ])
  }

  if (profileQuery.isLoading || industriesQuery.isLoading) return <Skeleton active paragraph={{ rows: 14 }} />
  const profile = profileQuery.data || {}
  if (profile.onboarding?.company_linked) {
    return <Result status="success" icon={<CheckCircleFilled className="text-emerald-500" />} title="Đã liên kết thông tin công ty" subTitle={`${profile.company?.company_name || ''} · Trạng thái thành viên: ${profile.membership_status || 'đang cập nhật'}`} />
  }
  const phoneVerified = Boolean(profile.onboarding?.phone_verified)
  return (
    <div>
      {!phoneVerified && <Alert type="warning" showIcon className="!mb-5" title="Cần xác thực số điện thoại trước khi chọn công ty" description={<span>Bạn vẫn có thể xem hai luồng bên dưới, nhưng cần <Link to={EMPLOYER_PHONE_VERIFY_URL} className="font-bold">xác thực số điện thoại</Link> trước khi lưu.</span>} />}
      <Tabs
        defaultActiveKey="search"
        items={[
          { key: 'search', label: <span><SearchOutlined /> Tìm kiếm thông tin công ty</span>, children: <SearchCompanyTab disabled={!phoneVerified} onLinked={refreshProfile} /> },
          { key: 'create', label: <span><PlusOutlined /> Tạo công ty mới</span>, children: <CreateCompanyTab disabled={!phoneVerified} industries={industriesQuery.data || []} onCreated={refreshProfile} /> },
        ]}
      />
    </div>
  )
}
