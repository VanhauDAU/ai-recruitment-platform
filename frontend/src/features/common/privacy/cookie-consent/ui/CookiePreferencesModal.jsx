import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons'
import { Button, Modal, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { EMPTY_CONSENT } from '@/entities/system/consent'
import { m } from '@/shared/config/i18n'

const GROUPS = [
  {
    key: 'necessary',
    title: m.account_cookie_necessary_title(),
    description: m.account_cookie_necessary_desc(),
    locked: true,
  },
  {
    key: 'preferences',
    title: m.account_cookie_preferences_title(),
    description: m.account_cookie_preferences_desc(),
  },
  {
    key: 'analytics',
    title: m.account_cookie_analytics_title(),
    description: m.account_cookie_analytics_desc(),
  },
  {
    key: 'marketing',
    title: m.account_cookie_marketing_title(),
    description: m.account_cookie_marketing_desc(),
  },
]

function CookieGroup({ group, checked, onChange }) {
  return (
    <article className="rounded-xl bg-slate-50 px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-slate-700">{group.title}</h3>
        {group.locked ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircleFilled /> {m.account_cookie_always_on()}</span>
        ) : (
          <Switch checked={checked} onChange={onChange} checkedChildren={m.account_cookie_on()} unCheckedChildren={m.account_cookie_off()} aria-label={checked ? m.account_cookie_switch_on_aria({ title: group.title }) : m.account_cookie_switch_off_aria({ title: group.title })} />
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{group.description}</p>
    </article>
  )
}

export default function CookiePreferencesModal({ open, consent, onClose, onSave, saving }) {
  const [draft, setDraft] = useState(EMPTY_CONSENT)

  useEffect(() => {
    if (open) setDraft({ ...EMPTY_CONSENT, ...consent })
  }, [consent, open])

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = (next) => onSave(next || draft)
  const acceptAll = () => save({ necessary: true, preferences: true, analytics: true, marketing: true })

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={620}
      destroyOnHidden
      className="cookie-preferences-modal"
      aria-labelledby="cookie-preferences-title"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-5 border-b border-slate-100 px-1 pb-4">
          <div>
            <h2 id="cookie-preferences-title" className="text-lg font-bold text-slate-800">{m.account_cookie_settings()}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">{m.account_cookie_settings_desc()}</p>
          </div>
          <Button type="text" shape="circle" icon={<CloseOutlined />} onClick={onClose} aria-label={m.account_cookie_close_settings()} />
        </header>

        <div className="space-y-2.5 overflow-y-auto py-4">
          {GROUPS.map((group) => (
            <CookieGroup
              key={group.key}
              group={group}
              checked={draft[group.key]}
              onChange={(checked) => update(group.key, checked)}
            />
          ))}
          <p className="px-1 text-xs leading-5 text-slate-500">{m.account_cookie_footer_before()}<a className="font-semibold text-[var(--brand-primary)] underline" href="/chinh-sach-cookie">{m.account_cookie_policy()}</a>.</p>
        </div>

        <footer className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Button size="large" onClick={() => save()} loading={saving} className="!border-[var(--brand-primary)] !font-semibold !text-[var(--brand-primary)]">
            {m.account_cookie_confirm()}
          </Button>
          <Button type="primary" size="large" onClick={acceptAll} loading={saving} className="!font-semibold">
            {m.account_cookie_accept_all()}
          </Button>
        </footer>
      </div>
    </Modal>
  )
}
