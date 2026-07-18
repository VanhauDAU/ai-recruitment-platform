import { ArrowRightOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Skeleton, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { EmployerConsentFields, EmployerRegistrationFields } from '@/features/complete-employer-registration'
import { completeEmployerRegistration, getEmployerProfile } from '@/entities/employer-profile'
import { getProvinces } from '@/entities/location'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_CONSULTING_NEED_URL } from '@/shared/config/portals'

const PROFILE_FIELDS = new Set([
  'full_name', 'gender', 'contact_phone', 'work_location',
  'terms_accepted', 'marketing_opt_in',
])

function readConsentDraft() {
  try {
    return JSON.parse(sessionStorage.getItem('employer_registration_consent')) || {}
  } catch {
    return {}
  }
}

export default function EmployerOnboardingPanel() {
  const { user, refreshSession } = useSession()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const provincesQuery = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: getProvinces,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (!profileQuery.data) return
    const profile = profileQuery.data
    const consent = readConsentDraft()
    form.setFieldsValue({
      full_name: user?.full_name || '',
      contact_phone: profile.contact_phone || user?.phone || '',
      gender: profile.gender || undefined,
      work_location: profile.work_location?.id,
      terms_accepted: consent.terms_accepted === true,
      marketing_opt_in: consent.marketing_opt_in === true,
    })
  }, [form, profileQuery.data, user])

  const mutation = useMutation({
    mutationFn: completeEmployerRegistration,
    onSuccess: async (profile) => {
      sessionStorage.removeItem('employer_registration_consent')
      queryClient.setQueryData(['employer', 'profile'], profile)
      await refreshSession()
      message.success('Đã hoàn tất hồ sơ nhà tuyển dụng.')
    },
    onError: (requestError) => {
      const data = requestError.response?.data
      const fields = data && typeof data === 'object'
        ? Object.entries(data)
          .filter(([name]) => PROFILE_FIELDS.has(name))
          .map(([name, errors]) => ({ name, errors: Array.isArray(errors) ? errors.map(String) : [String(errors)] }))
        : []
      if (fields.length) form.setFields(fields)
      else setError(getApiErrorMessage(requestError, 'Không thể lưu hồ sơ. Vui lòng thử lại.'))
    },
  })

  if (profileQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-8"><Skeleton active paragraph={{ rows: 8 }} /></div>
  }
  if (profileQuery.isError) {
    return <Alert type="error" showIcon message="Không tải được hồ sơ nhà tuyển dụng" action={<Button onClick={() => profileQuery.refetch()}>Thử lại</Button>} />
  }
  if (profileQuery.data?.onboarding?.registration_completed) {
    return <Navigate to={user?.email_verified ? EMPLOYER_CONSULTING_NEED_URL : EMPLOYER_ACCOUNT_VERIFY_URL} replace />
  }

  function submit(values) {
    setError('')
    mutation.mutate({
      ...values,
      contact_phone: values.contact_phone.replace(/[ .-]/g, ''),
      marketing_opt_in: Boolean(values.marketing_opt_in),
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <Tag color="green" className="!m-0 !rounded-full !px-3">Đăng ký bằng Google</Tag>
      <h1 className="mt-3 text-2xl font-black text-slate-950">Hoàn thiện hồ sơ nhà tuyển dụng</h1>
      <p className="mb-6 mt-1 text-sm leading-6 text-slate-500">Bổ sung thông tin người liên hệ trước khi khai báo nhu cầu; hồ sơ công ty được chọn hoặc tạo tại bước xác thực riêng.</p>
      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} className="!mb-5 !rounded-lg" />}
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        requiredMark={(label, { required }) => (
          <>
            {label}
            {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
          </>
        )}
        scrollToFirstError
      >
        <EmployerRegistrationFields provinces={provincesQuery.data || []} locationsLoading={provincesQuery.isLoading} />
        <EmployerConsentFields />
        <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending} className="!mt-6 !h-12 !rounded-lg !font-bold">
          Lưu và tiếp tục <ArrowRightOutlined />
        </Button>
      </Form>
    </section>
  )
}
