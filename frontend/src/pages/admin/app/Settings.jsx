import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Skeleton, Tag, Tabs, Typography, message } from 'antd'
import { getAdminSettings, updateAdminSettings } from '../../../api/adminSiteService'
import SettingField from '../../../components/admin/SettingField'

const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export default function AdminSettings() {
  const [groups, setGroups] = useState(null)
  const [values, setValues] = useState({})
  const [initial, setInitial] = useState({})
  const [pendingImageFiles, setPendingImageFiles] = useState({})
  const [activeGroup, setActiveGroup] = useState('general')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAdminSettings()
      .then(({ groups }) => {
        setGroups(groups)
        const map = Object.fromEntries(
          groups.flatMap((g) => g.settings.map((s) => [s.key, s.value]))
        )
        setValues(map)
        setInitial(map)
      })
      .catch(() => message.error('Không tải được cấu hình.'))
  }, [])

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
    const current = groups.find((g) => g.key === activeGroup)
    if (current && dirtyInGroup(current)) {
      Modal.confirm({
        title: 'Thay đổi chưa lưu',
        content: 'Nhóm hiện tại có thay đổi chưa lưu. Chuyển tab sẽ giữ nguyên thay đổi (chưa mất), tiếp tục?',
        okText: 'Chuyển tab',
        cancelText: 'Ở lại',
        onOk: () => setActiveGroup(key),
      })
    } else {
      setActiveGroup(key)
    }
  }

  if (!groups) return <Skeleton active paragraph={{ rows: 10 }} />

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
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <Typography.Title level={4} className="!mb-6">Cài đặt hệ thống</Typography.Title>
      <Tabs
        tabPlacement="left"
        activeKey={activeGroup}
        onChange={handleTabChange}
        items={items}
        className="[&_.ant-tabs-tab]:!py-2"
      />
    </div>
  )
}
