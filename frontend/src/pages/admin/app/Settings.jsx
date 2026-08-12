import { SettingOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Skeleton, Tag, Tabs, Typography } from 'antd'
import { useSearchParams } from 'react-router'
import { useSiteSettings } from '@/entities/site-settings'
import { AiRuntimeOverview } from '@/features/manage-ai-runtime'
import { getAdminSettings, SettingField, updateAdminSettings } from '@/features/manage-site-settings'
import { SpeechRuntimeOverview } from '@/features/manage-speech-runtime'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPageHeader, AdminPanel } from '@/shared/ui/admin'
import useConfirmAction from '@/shared/ui/use-confirm-action'

const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function SettingsPageHeader() {
  return (
    <AdminPageHeader
      eyebrow="Hệ thống"
      title="Cài đặt hệ thống"
      description="Quản lý cấu hình vận hành, thương hiệu, bảo mật và các bề mặt sản phẩm từ một nơi."
      icon={<SettingOutlined />}
      actions={<AdminDataActions allowExport={false} />}
    />
  )
}

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const { retry: refreshSiteSettings } = useSiteSettings()
  const [groups, setGroups] = useState(null)
  const [values, setValues] = useState({})
  const [initial, setInitial] = useState({})
  const [pendingImageFiles, setPendingImageFiles] = useState({})
  const [activeGroup, setActiveGroup] = useState(() => searchParams.get('group') || 'general')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await getAdminSettings()
      setGroups(response.groups)
      const map = Object.fromEntries(
        response.groups.flatMap((group) => (
          group.settings.map((setting) => [setting.key, setting.value])
        )),
      )
      setValues(map)
      setInitial(map)
    } catch {
      setLoadError(true)
      message.error('Không tải được cấu hình.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const requested = searchParams.get('group') || 'general'
    if (groups?.some((group) => group.key === requested)) {
      setActiveGroup(requested)
    }
  }, [groups, searchParams])

  const dirtyKeys = useMemo(
    () => Array.from(new Set([
      ...Object.keys(values).filter((k) => !isEqual(values[k], initial[k])),
      ...Object.keys(pendingImageFiles),
    ])),
    [values, initial, pendingImageFiles]
  )

  const dirtyInGroup = (group) =>
    group.settings.some((s) => dirtyKeys.includes(s.key))

  const handleSave = async (group) => {
    const changed = Object.fromEntries(
      group.settings
        .filter((s) => s.value_type !== 'env' && dirtyKeys.includes(s.key))
        .map((s) => [s.key, values[s.key]])
    )
    setSaving(true)
    try {
      const groupImageFiles = Object.fromEntries(
        group.settings
          .filter((s) => s.value_type === 'image' && pendingImageFiles[s.key])
          .map((s) => [s.key, pendingImageFiles[s.key]])
      )
      const { updated, errors, values: savedValues, display_values: displayValues } = await updateAdminSettings(changed, groupImageFiles)
      if (Object.keys(errors || {}).length) {
        message.error(Object.entries(errors).map(([k, e]) => `${k}: ${e}`).join(' · '))
      }
      if (updated?.length) {
        const nextValues = Object.fromEntries(updated.map((k) => [k, savedValues?.[k] ?? values[k]]))
        setValues((prev) => ({ ...prev, ...nextValues }))
        setInitial((prev) => ({ ...prev, ...nextValues }))
        setPendingImageFiles((prev) => {
          const next = { ...prev }
          updated.forEach((key) => delete next[key])
          return next
        })
        if (displayValues) {
          setGroups((prev) => prev.map((item) => ({
            ...item,
            settings: item.settings.map((setting) => (
              displayValues[setting.key] !== undefined
                ? { ...setting, value: savedValues?.[setting.key] ?? setting.value, display_value: displayValues[setting.key] }
                : setting
            )),
          })))
        }
        if (
          updated.includes('brand_primary_color')
          || updated.some((key) => key.startsWith('speech_'))
        ) await refreshSiteSettings()
        message.success('Đã lưu cấu hình.')
      }
    } catch {
      message.error('Lưu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = (group) => {
    setValues((prev) => ({
      ...prev,
      ...Object.fromEntries(group.settings.map((s) => [s.key, initial[s.key]])),
    }))
    setPendingImageFiles((prev) => {
      const next = { ...prev }
      group.settings.forEach((s) => delete next[s.key])
      return next
    })
  }

  const handleTabChange = (key) => {
    const commitGroup = () => {
      setActiveGroup(key)
      const next = new URLSearchParams(searchParams)
      if (key === 'general') next.delete('group')
      else next.set('group', key)
      setSearchParams(next)
    }
    const current = groups.find((g) => g.key === activeGroup)
    if (current && dirtyInGroup(current)) {
      requestConfirmation({
        title: 'Chuyển nhóm cài đặt',
        description: 'Nhóm hiện tại có thay đổi chưa lưu. Bạn có muốn chuyển tab? Các thay đổi vẫn được giữ lại.',
        confirmText: 'Chuyển tab',
        cancelText: 'Ở lại',
        onConfirm: commitGroup,
      })
    } else {
      commitGroup()
    }
  }

  if (!groups) {
    return (
      <div className="space-y-5">
        <SettingsPageHeader />
        <AdminPanel>
          {loadError ? (
            <Alert
              action={<Button onClick={loadSettings}>Thử lại</Button>}
              description="Kết nối hoặc quyền truy cập có thể đã thay đổi. Hãy tải lại dữ liệu trước khi chỉnh sửa."
              showIcon
              title="Không thể tải cài đặt hệ thống"
              type="error"
            />
          ) : (
            <Skeleton active={loading} paragraph={{ rows: 10 }} />
          )}
        </AdminPanel>
      </div>
    )
  }

  const items = groups.map((group) => ({
    key: group.key,
    label: (
      <span>
        {group.label}
        {dirtyInGroup(group) && <span className="ml-1 text-orange-500">•</span>}
      </span>
    ),
    children: (
      <div className="max-w-3xl">
        {group.key === 'ai' && (
          <>
            <AiRuntimeOverview />
            <SpeechRuntimeOverview />
          </>
        )}
        <div className="divide-y divide-gray-100">
          {group.settings.map((setting) => (
            <div key={setting.key} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start">
              <div className="sm:w-64 shrink-0">
                <div className="font-medium text-gray-800">
                  {setting.label}
                  {setting.is_public && <Tag className="!ml-2" color="blue">Public</Tag>}
                </div>
                {setting.description && (
                  <div className="mt-0.5 text-xs text-gray-500">{setting.description}</div>
                )}
                <div className="mt-0.5 font-mono text-[11px] text-gray-400">{setting.key}</div>
              </div>
              <div className="flex-1">
                <SettingField
                  setting={setting}
                  value={values[setting.key]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [setting.key]: v }))}
                  pendingFile={pendingImageFiles[setting.key]}
                  onFileSelected={(file) => setPendingImageFiles((prev) => {
                    const next = { ...prev }
                    if (file) next[setting.key] = file
                    else delete next[setting.key]
                    return next
                  })}
                />
              </div>
            </div>
          ))}
          {!group.settings.length && (
            <Typography.Text type="secondary">Nhóm này chưa có cấu hình.</Typography.Text>
          )}
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white py-3">
          <Button type="primary" loading={saving} disabled={!dirtyInGroup(group)} onClick={() => handleSave(group)}>
            Lưu thay đổi
          </Button>
          <Button disabled={!dirtyInGroup(group)} onClick={() => handleRevert(group)}>
            Hoàn tác
          </Button>
        </div>
      </div>
    ),
  }))

  return (
    <>
      <div className="space-y-5">
        <SettingsPageHeader />
        <AdminPanel>
          <Tabs
            tabPlacement="top"
            activeKey={activeGroup}
            onChange={handleTabChange}
            items={items}
            className="[&_.ant-tabs-tab]:!py-2"
          />
        </AdminPanel>
      </div>
      {confirmationModal}
    </>
  )
}
