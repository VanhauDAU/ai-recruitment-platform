import {
  CameraOutlined,
  CheckCircleFilled,
  DownloadOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Form, Input, Select, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { COMPANY_VALUE_LABELS, employerProfileKeys, getEmployerProfile } from '@/entities/account/employer-profile'
import { useSession } from '@/entities/account/session'
import { AvatarEditorModal, updateProfile } from '@/features/common/account/edit-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { useUnsavedChanges } from '@/shared/hooks/use-unsaved-changes'
import { EMPLOYER_COMPANY_SETTINGS_URL, EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import './account-information.css'

const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/
const GENDER_OPTIONS = Object.entries(COMPANY_VALUE_LABELS.gender).map(([value, label]) => ({ value, label }))
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(getIntlLocale()) : '')
const initialsOf = (name) => (name || 'N').trim().split(/\s+/).slice(-1)[0].charAt(0).toUpperCase()

function Verified({ label }) {
  return <span className="eai-verified"><CheckCircleFilled aria-hidden /> {label}</span>
}

/** Who the account is: photo, name, role, contact and company at a glance. */
function ProfileHeader({ user, profile, onChangeAvatar, onExport }) {
  const company = profile?.company
  const phone = profile?.verified_phone || user?.phone
  return (
    <div className="eai-header">
      <div className="eai-cover" aria-hidden />
      <div className="eai-identity">
        <div className="eai-avatar">
          <Avatar size={88} src={user?.avatar_url || undefined} className="eai-avatar__image">
            {initialsOf(user?.full_name || user?.email)}
          </Avatar>
          <button type="button" className="eai-avatar__edit" aria-label={m.employer_account_info_change_avatar()} onClick={onChangeAvatar}>
            <CameraOutlined aria-hidden />
          </button>
        </div>
        <div className="eai-identity__text">
          <div className="eai-identity__name">
            <h2>{user?.full_name || m.employer_workspace_employer_fallback_name()}</h2>
            {profile?.company_role && <span className="eai-role">{COMPANY_VALUE_LABELS.company_role[profile.company_role]}</span>}
          </div>
          {profile?.position_title && <p className="eai-position">{profile.position_title}</p>}
          <ul className="eai-facts">
            {user?.email && (
              <li><MailOutlined aria-hidden /> <span>{user.email}</span>{user.email_verified && <Verified label={m.employer_account_info_verified()} />}</li>
            )}
            {phone && (
              <li><PhoneOutlined aria-hidden /> <span>{phone}</span>{profile?.phone_verified_at && <Verified label={m.employer_account_info_verified()} />}</li>
            )}
            {profile?.work_location?.name && <li><EnvironmentOutlined aria-hidden /> <span>{profile.work_location.name}</span></li>}
          </ul>
        </div>
        <Button icon={<DownloadOutlined />} onClick={onExport} className="eai-export">{m.employer_account_info_export()}</Button>
      </div>
      <div className="eai-company">
        {company ? (
          <Link to={EMPLOYER_COMPANY_SETTINGS_URL} className="eai-company__link">
            <Avatar shape="square" size={36} src={company.logo_url || undefined} className="eai-company__logo">
              {initialsOf(company.trade_name || company.company_name)}
            </Avatar>
            <span className="eai-company__name">{company.trade_name || company.company_name}</span>
          </Link>
        ) : (
          <Link to={EMPLOYER_COMPANY_SETTINGS_URL} className="eai-company__link eai-company__link--empty">{m.employer_account_info_no_company()}</Link>
        )}
        {profile?.created_at && <span className="eai-company__joined">{m.employer_account_info_joined({ date: formatDate(profile.created_at) })}</span>}
      </div>
    </div>
  )
}

export default function EmployerAccountInformation() {
  const { user, setCurrentUser } = useSession()
  const profileQuery = useQuery({ queryKey: employerProfileKeys.profile, queryFn: getEmployerProfile })
  const [saving, setSaving] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [form] = Form.useForm()
  useUnsavedChanges(dirty)

  useEffect(() => {
    form.setFieldsValue({ full_name: user?.full_name || '', phone: user?.phone || '' })
  }, [form, user?.full_name, user?.phone])

  async function handleSave(values) {
    setSaving(true)
    try {
      const updated = await updateProfile({
        full_name: values.full_name.trim(),
        phone: (values.phone || '').trim(),
      })
      setCurrentUser(updated)
      form.setFieldsValue({ full_name: updated.full_name, phone: updated.phone })
      setDirty(false)
      setPhoneEditing(false)
      message.success(m.employer_account_info_saved())
    } catch (error) {
      const fieldErrors = error?.response?.data
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const entries = Object.entries(fieldErrors).filter(([name]) => ['full_name', 'phone'].includes(name))
        if (entries.length) {
          form.setFields(entries.map(([name, errors]) => ({ name, errors: [].concat(errors) })))
          return
        }
      }
      message.error(getApiErrorMessage(error, m.employer_account_info_save_failed()))
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    form.resetFields()
    form.setFieldsValue({ full_name: user?.full_name || '', phone: user?.phone || '' })
    setPhoneEditing(false)
    setDirty(false)
  }

  function handleExport() {
    const data = {
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      gender: profileQuery.data?.gender || '',
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'thong-tin-tai-khoan.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="eai" aria-label={m.employer_account_info_title()}>
      {profileQuery.isLoading
        ? <div className="eai-loading"><Skeleton active avatar={{ size: 88 }} paragraph={{ rows: 3 }} /></div>
        : <ProfileHeader user={user} profile={profileQuery.data} onChangeAvatar={() => setAvatarOpen(true)} onExport={handleExport} />}
      <AvatarEditorModal open={avatarOpen} onClose={() => setAvatarOpen(false)} />

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleSave}
        onValuesChange={() => setDirty(true)}
        className="eai-form"
      >
        <h3 className="eai-form__title">{m.employer_account_info_personal()}</h3>
        <div className="eai-form__grid">
          <Form.Item name="full_name" label={m.employer_account_info_full_name()} rules={[{ required: true, whitespace: true, message: m.employer_account_info_full_name_required() }, { min: 2, message: m.employer_account_info_full_name_min() }, { max: 255, message: m.employer_account_info_full_name_max() }]}>
            <Input placeholder={m.employer_account_info_full_name_placeholder()} />
          </Form.Item>

          <Form.Item label={m.employer_account_info_gender()}>
            <Select disabled value={profileQuery.data?.gender || undefined} placeholder={m.employer_account_docs_not_updated()} options={GENDER_OPTIONS} />
          </Form.Item>

          <Form.Item label="Email">
            <Input value={user?.email || ''} disabled />
          </Form.Item>

          <Form.Item
            name="phone"
            label={(
              <span className="eai-phone-label">
                <span>{m.employer_account_info_phone()}</span>
                <button type="button" className="eai-link" onClick={() => setPhoneEditing((value) => !value)}>
                  {phoneEditing ? m.employer_account_info_lock() : m.employer_account_info_update()}
                </button>
                <Link to={EMPLOYER_PHONE_VERIFY_URL} className="eai-link"><LinkOutlined /> {m.employer_account_info_verify()}</Link>
              </span>
            )}
            rules={[{ pattern: PHONE_PATTERN, message: m.employer_account_info_phone_invalid() }]}
          >
            <Input disabled={!phoneEditing} inputMode="tel" placeholder={m.employer_account_info_phone_placeholder()} />
          </Form.Item>
        </div>

        <div className="eai-form__footer">
          {dirty && <span className="eai-form__hint">{m.employer_account_info_unsaved()}</span>}
          <Button onClick={handleCancel} disabled={!dirty || saving}>{m.employer_account_docs_cancel()}</Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!dirty}>{m.employer_account_info_save()}</Button>
        </div>
      </Form>
    </section>
  )
}
