import { SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSiteSettings } from '@/entities/system/site-settings'
import { AiRuntimeOverview } from '@/features/admin/system/manage-ai-runtime'
import {
  formatSettingValue,
  isRiskyChange,
  matchesQuery,
  SettingHistoryDrawer,
  SettingPreviews,
  SettingRow,
  SettingsGroupNav,
  SystemParametersPanel,
  useSettingsForm,
} from '@/features/admin/system/manage-site-settings'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { AdminPageHeader, AdminPanel } from '@/shared/ui/admin'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'

// Nhóm cũ (trước khi gom nhóm theo ADR-0026) để link/bookmark cũ vẫn mở đúng chỗ.
const LEGACY_GROUPS = { general: 'brand', candidate: 'cv', security: 'operations', upload: 'operations', payment: 'operations' }

const sectionsOf = (settings) => settings.reduce((sections, setting) => {
  const section = sections.find((item) => item.title === setting.section)
  if (section) section.settings.push(setting)
  else sections.push({ title: setting.section, settings: [setting] })
  return sections
}, [])

function SettingsPageHeader() {
  return (
    <AdminPageHeader
      eyebrow={m.admin_settings_eyebrow()}
      title={m.admin_settings_title()}
      description={m.admin_settings_description()}
      icon={<SettingOutlined />}
    />
  )
}

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const { retry: refreshSiteSettings } = useSiteSettings()
  const form = useSettingsForm()
  const [query, setQuery] = useState('')
  const [historyFor, setHistoryFor] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const { groups, settingsByKey, values, initial, errors, dirtyKeys } = form

  const requested = LEGACY_GROUPS[searchParams.get('group')] || searchParams.get('group')
  const activeKey = groups?.some((group) => group.key === requested) ? requested : groups?.[0]?.key
  const searching = query.trim().length > 0

  const visibleGroups = useMemo(() => (groups || [])
    .map((group) => ({ ...group, settings: group.settings.filter((setting) => matchesQuery(setting, query)) }))
    .filter((group) => (searching ? group.settings.length > 0 : group.key === activeKey)), [groups, query, searching, activeKey])
  const matchCounts = useMemo(() => (searching
    ? Object.fromEntries(visibleGroups.map((group) => [group.key, group.settings.length]))
    : null), [visibleGroups, searching])
  const dirtyGroups = useMemo(() => new Set(dirtyKeys.map((key) => settingsByKey[key]?.group)), [dirtyKeys, settingsByKey])
  const errorGroups = useMemo(() => new Set(Object.keys(errors).map((key) => settingsByKey[key]?.group)), [errors, settingsByKey])

  useEffect(() => {
    if (!highlight) return undefined
    document.getElementById(`setting-${highlight}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setHighlight(null), 1600)
    return () => clearTimeout(timer)
  }, [highlight, activeKey])

  const selectGroup = (key) => {
    setQuery('')
    const next = new URLSearchParams(searchParams)
    next.set('group', key)
    setSearchParams(next)
  }
  const focusSetting = (key) => {
    const group = settingsByKey[key]?.group
    if (group && group !== activeKey) selectGroup(group)
    else setQuery('')
    setHighlight(key)
  }

  const submit = async () => {
    try {
      const result = await form.save()
      const failed = Object.keys(result.errors)
      if (result.updated.some((key) => settingsByKey[key]?.is_public)) await refreshSiteSettings()
      if (failed.length) {
        message.error(m.admin_settings_save_partial({ count: failed.length }))
        focusSetting(failed[0])
      } else if (result.updated.length) {
        message.success(m.admin_settings_saved())
      }
    } catch {
      message.error(m.admin_settings_save_failed())
    }
  }

  const handleSave = () => {
    const risky = dirtyKeys
      .map((key) => settingsByKey[key])
      .filter((setting) => isRiskyChange(setting, initial[setting.key], values[setting.key]))
    if (!risky.length) {
      submit()
      return
    }
    requestConfirmation({
      title: m.admin_settings_risky_title(),
      confirmText: m.admin_settings_save(),
      cancelText: m.admin_settings_cancel(),
      danger: true,
      description: (
        <>
          <p>{m.admin_settings_risky_description()}</p>
          <ul className="settings-risky">
            {risky.map((setting) => (
              <li key={setting.key}>
                <strong>{setting.label}</strong>: {formatSettingValue(setting, initial[setting.key])} → {formatSettingValue(setting, values[setting.key])}
              </li>
            ))}
          </ul>
        </>
      ),
      onConfirm: submit,
    })
  }

  if (!groups) {
    return (
      <div className="space-y-5">
        <SettingsPageHeader />
        <AdminPanel>
          {form.loadError ? (
            <Alert
              action={<Button onClick={form.load}>{m.admin_settings_retry()}</Button>}
              description={m.admin_settings_load_error_description()}
              showIcon
              title={m.admin_settings_load_error_title()}
              type="error"
            />
          ) : (
            <Skeleton active paragraph={{ rows: 10 }} />
          )}
        </AdminPanel>
      </div>
    )
  }

  const renderRow = (setting) => {
    const parent = settingsByKey[setting.options?.depends_on]
    const blockedBy = parent?.value_type === 'boolean' && !values[parent.key] ? parent.label : null
    return (
      <SettingRow
        key={setting.key}
        setting={setting}
        value={values[setting.key]}
        file={form.files[setting.key]}
        dirty={dirtyKeys.includes(setting.key)}
        error={errors[setting.key]}
        blockedBy={blockedBy}
        highlighted={highlight === setting.key}
        onChange={(value) => form.setValue(setting.key, value)}
        onFileSelected={(file) => form.setFile(setting.key, file)}
        onRevert={() => form.revert(setting.key)}
        onHistory={() => setHistoryFor(setting)}
      />
    )
  }
  const activeGroup = groups.find((group) => group.key === activeKey)
  const resultCount = visibleGroups.reduce((sum, group) => sum + group.settings.length, 0)

  return (
    <>
      <div className="space-y-5">
        <SettingsPageHeader />
        <div className="settings-layout">
          <SettingsGroupNav
            groups={groups}
            activeKey={searching ? null : activeKey}
            dirtyGroups={dirtyGroups}
            errorGroups={errorGroups}
            counts={matchCounts}
            onSelect={selectGroup}
          />
          <div className="settings-main">
            <div className="settings-toolbar">
              <h2 className="settings-toolbar__title">
                {searching ? m.admin_settings_search_results({ count: resultCount, query: query.trim() }) : activeGroup?.label}
              </h2>
              <Input
                allowClear
                className="settings-toolbar__search"
                prefix={<SearchOutlined aria-hidden="true" />}
                placeholder={m.admin_settings_search_placeholder()}
                aria-label={m.admin_settings_search_label()}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {searching && !resultCount && <Empty description={m.admin_settings_search_empty({ query: query.trim() })} />}
            {!searching && <SettingPreviews group={activeKey} values={values} settingsByKey={settingsByKey} />}
            {!searching && activeKey === 'ai' && <AiRuntimeOverview />}
            {visibleGroups.map((group) => sectionsOf(group.settings).map((section) => (
              <section key={`${group.key}-${section.title}`} className="settings-section">
                {searching && <p className="settings-section__group">{group.label}</p>}
                <h3 className="settings-section__title">{section.title}</h3>
                {section.settings.map(renderRow)}
              </section>
            )))}
            {!searching && activeKey === 'operations' && <SystemParametersPanel />}
            <div className="settings-savebar">
              <span className={`settings-savebar__status${dirtyKeys.length ? '' : ' settings-savebar__status--idle'}`} aria-live="polite">
                {dirtyKeys.length ? m.admin_settings_dirty_count({ count: dirtyKeys.length }) : m.admin_settings_no_changes()}
              </span>
              <div className="settings-savebar__actions">
                <Button disabled={!dirtyKeys.length || form.saving} onClick={form.revertAll}>{m.admin_settings_revert_all()}</Button>
                <Button type="primary" loading={form.saving} disabled={!dirtyKeys.length} onClick={handleSave}>
                  {m.admin_settings_save()}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SettingHistoryDrawer
        setting={historyFor}
        onClose={() => setHistoryFor(null)}
        onUseValue={(value) => {
          form.setValue(historyFor.key, value)
          focusSetting(historyFor.key)
          setHistoryFor(null)
        }}
      />
      {confirmationModal}
    </>
  )
}
