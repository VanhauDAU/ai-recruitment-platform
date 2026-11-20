import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUnsavedChanges } from '@/shared/hooks/use-unsaved-changes'
import { getAdminSettings, updateAdminSettings } from '../api/manage-site-settings.api'
import { isEqual } from './setting-values'

const valueMap = (groups) => Object.fromEntries(
  groups.flatMap((group) => group.settings.map((setting) => [setting.key, setting.value])),
)

/**
 * Trạng thái form cấu hình cho cả trang: giá trị đang sửa, bản đã lưu, ảnh chờ
 * upload và lỗi theo key. Lưu một lần mọi thay đổi ở mọi nhóm.
 */
export function useSettingsForm() {
  const [groups, setGroups] = useState(null)
  const [values, setValues] = useState({})
  const [initial, setInitial] = useState({})
  const [files, setFiles] = useState({})
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const response = await getAdminSettings()
      const map = valueMap(response.groups)
      setGroups(response.groups)
      setValues(map)
      setInitial(map)
      setFiles({})
      setErrors({})
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const settingsByKey = useMemo(() => Object.fromEntries(
    (groups || []).flatMap((group) => group.settings.map((setting) => [setting.key, { ...setting, group: group.key }])),
  ), [groups])

  const dirtyKeys = useMemo(() => Object.keys(settingsByKey).filter(
    (key) => files[key] || !isEqual(values[key], initial[key]),
  ), [settingsByKey, values, initial, files])
  useUnsavedChanges(dirtyKeys.length > 0)

  const clearError = (key) => setErrors((prev) => {
    if (!(key in prev)) return prev
    const { [key]: _removed, ...rest } = prev
    return rest
  })
  const setValue = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    clearError(key)
  }, [])
  const setFile = useCallback((key, file) => {
    setFiles((prev) => {
      const { [key]: _removed, ...rest } = prev
      return file ? { ...rest, [key]: file } : rest
    })
    clearError(key)
  }, [])
  const revert = useCallback((key) => {
    setValue(key, initial[key])
    setFile(key, null)
  }, [initial, setValue, setFile])
  const revertAll = useCallback(() => {
    setValues(initial)
    setFiles({})
    setErrors({})
  }, [initial])

  /** Gửi mọi thay đổi; trả về `{updated, errors}` để trang báo kết quả. */
  const save = useCallback(async () => {
    const changed = Object.fromEntries(dirtyKeys.filter((key) => !files[key]).map((key) => [key, values[key]]))
    setSaving(true)
    try {
      const result = await updateAdminSettings(changed, files)
      const updated = result.updated || []
      const saved = Object.fromEntries(updated.map((key) => [key, result.values?.[key] ?? values[key]]))
      setValues((prev) => ({ ...prev, ...saved }))
      setInitial((prev) => ({ ...prev, ...saved }))
      setFiles((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !updated.includes(key))))
      setErrors(result.errors || {})
      setGroups((prev) => prev.map((group) => ({
        ...group,
        settings: group.settings.map((setting) => (updated.includes(setting.key) ? {
          ...setting,
          value: saved[setting.key],
          display_value: result.display_values?.[setting.key] ?? setting.display_value,
          updated_at: new Date().toISOString(),
        } : setting)),
      })))
      return { updated, errors: result.errors || {} }
    } catch (error) {
      const fieldErrors = error?.response?.data?.errors
      if (fieldErrors) {
        setErrors(fieldErrors)
        return { updated: [], errors: fieldErrors }
      }
      throw error
    } finally {
      setSaving(false)
    }
  }, [dirtyKeys, files, values])

  return {
    groups, settingsByKey, values, initial, files, errors, loadError, saving,
    dirtyKeys, load, setValue, setFile, revert, revertAll, save,
  }
}
