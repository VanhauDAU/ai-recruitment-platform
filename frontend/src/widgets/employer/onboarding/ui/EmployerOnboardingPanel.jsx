import { ArrowRightOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Skeleton, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { message } from '@/shared/lib/toast'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { EmployerConsentFields, EmployerRegistrationFields } from '@/features/employer/account/complete-employer-registration'
import { completeEmployerRegistration, getEmployerProfile } from '@/entities/account/employer-profile'
import { getProvinces } from '@/entities/system/location'
import { useSession } from '@/entities/account/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_VERIFY_URL } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

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
      message.success(m.employer_account_onboarding_saved(), toastSoundOptions('celebrate'))
    },
    onError: (requestError) => {
      const data = requestError.response?.data
      const fields = data && typeof data === 'object'
        ? Object.entries(data)
          .filter(([name]) => PROFILE_FIELDS.has(name))
          .map(([name, errors]) => ({ name, errors: Array.isArray(errors) ? errors.map(String) : [String(errors)] }))
        : []
      if (fields.length) form.setFields(fields)
      else setError(getApiErrorMessage(requestError, m.employer_account_onboarding_save_failed()))
    },
  })

  if (profileQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-8"><Skeleton active paragraph={{ rows: 8 }} /></div>
  }
  if (profileQuery.isError) {
    return <Alert type="error" showIcon message={m.employer_account_onboarding_load_failed()} action={<Button onClick={() => profileQuery.refetch()}>{m.employer_account_domain_retry()}</Button>} />
  }
  if (profileQuery.data?.onboarding?.registration_completed) {
    return <Navigate to={user?.email_verified ? EMPLOYER_VERIFY_URL : EMPLOYER_ACCOUNT_VERIFY_URL} replace />
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
      <Tag color="green" className="!m-0 !rounded-full !px-3">{m.employer_account_onboarding_google_tag()}</Tag>
      <h1 className="mt-3 text-2xl font-black text-slate-950">{m.employer_account_onboarding_title()}</h1>
      <p className="mb-6 mt-1 text-sm leading-6 text-slate-500">{m.employer_account_onboarding_subtitle()}</p>
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
          {m.employer_account_onboarding_submit()} <ArrowRightOutlined />
        </Button>
      </Form>
    </section>
  )
}
