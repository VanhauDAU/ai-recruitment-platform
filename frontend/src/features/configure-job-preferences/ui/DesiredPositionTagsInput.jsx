import { CloseCircleFilled } from '@ant-design/icons'
import { AutoComplete, Input } from 'antd'
import { useMemo, useState } from 'react'
import {
  MAX_CUSTOM_DESIRED_POSITIONS,
  MAX_DESIRED_SPECIALIZATIONS,
  normalizeDesiredPositionOthers,
  normalizePositionLabel,
  positionLabelKey,
} from '../model/specialization-limit'

const DROPDOWN_CLASS_NAME = '!rounded-2xl !p-1 !shadow-lg [&_.ant-select-item-option]:!rounded-xl'

/**
 * Free-text counterpart of the taxonomy picker. Exact taxonomy matches are
 * routed back to the canonical specialization ids; only genuinely new titles
 * become custom chips.
 */
export default function DesiredPositionTagsInput({
  availableSlots = MAX_CUSTOM_DESIRED_POSITIONS,
  availableSuggestionSlots = MAX_DESIRED_SPECIALIZATIONS,
  disabled = false,
  onChange,
  onSuggestionSelect,
  selectedSuggestionIds = [],
  suggestions = [],
  value = [],
}) {
  const [inputValue, setInputValue] = useState('')
  const [limitError, setLimitError] = useState('')
  const positions = useMemo(() => normalizeDesiredPositionOthers(value), [value])
  const selectedIds = useMemo(() => new Set(selectedSuggestionIds), [selectedSuggestionIds])
  const suggestionByName = useMemo(
    () => new Map(suggestions.map((suggestion) => [positionLabelKey(suggestion.label ?? suggestion.value), suggestion])),
    [suggestions],
  )
  const customSlots = Math.max(0, availableSlots)
  const suggestionSlots = Math.max(0, availableSuggestionSlots)

  function commit(rawValue) {
    const wholeValue = normalizePositionLabel(rawValue)
    if (!wholeValue) {
      setInputValue('')
      return
    }

    const wholeSuggestion = suggestionByName.get(positionLabelKey(wholeValue))
    const entries = wholeSuggestion ? [wholeValue] : normalizeDesiredPositionOthers(rawValue)
    const next = [...positions]
    const nextKeys = new Set(next.map(positionLabelKey))
    let remainingCustomSlots = customSlots
    let remainingSuggestionSlots = suggestionSlots
    let reachedCustomLimit = false
    let reachedSuggestionLimit = false

    for (const entry of entries) {
      const suggestion = suggestionByName.get(positionLabelKey(entry))
      if (suggestion) {
        if (selectedIds.has(suggestion.id)) continue
        if (remainingSuggestionSlots < 1) {
          reachedSuggestionLimit = true
          continue
        }
        const accepted = onSuggestionSelect?.(suggestion.id)
        if (accepted !== false) remainingSuggestionSlots -= 1
        continue
      }

      const key = positionLabelKey(entry)
      if (nextKeys.has(key)) continue
      if (remainingCustomSlots < 1) {
        reachedCustomLimit = true
        continue
      }
      next.push(entry)
      nextKeys.add(key)
      remainingCustomSlots -= 1
    }

    if (next.length !== positions.length) onChange?.(next)
    const nextError = reachedCustomLimit
      ? `Bạn chỉ có thể nhập tối đa ${MAX_CUSTOM_DESIRED_POSITIONS} vị trí chuyên môn khác.`
      : (reachedSuggestionLimit ? `Bạn chỉ có thể chọn tối đa ${MAX_DESIRED_SPECIALIZATIONS} vị trí trong danh mục.` : '')
    setLimitError(nextError)
    setInputValue('')
  }

  function handleInputChange(nextValue) {
    if (/[,;\n]/.test(nextValue)) {
      commit(nextValue)
      return
    }
    setLimitError('')
    setInputValue(nextValue)
  }

  function removePosition(position) {
    const key = positionLabelKey(position)
    onChange?.(positions.filter((item) => positionLabelKey(item) !== key))
    setLimitError('')
  }

  const canSelectSuggestion = suggestions.length > 0 && suggestionSlots > 0
  const inputDisabled = disabled || (customSlots < 1 && !canSelectSuggestion)

  return (
    <div className="space-y-2">
      {positions.length > 0 && (
        <div role="list" aria-label="Vị trí chuyên môn tự nhập" className="flex flex-wrap gap-1.5">
          {positions.map((position) => (
            <span key={positionLabelKey(position)} role="listitem" className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-sm text-slate-700">
              {position}
              <button
                type="button"
                aria-label={`Xóa vị trí ${position}`}
                disabled={disabled}
                onClick={() => removePosition(position)}
                className="text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CloseCircleFilled />
              </button>
            </span>
          ))}
        </div>
      )}
      <AutoComplete
        disabled={inputDisabled}
        options={suggestions}
        value={inputValue}
        onChange={handleInputChange}
        onSelect={(selected) => commit(selected)}
        classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }}
        filterOption={(input, option) => positionLabelKey(option?.label ?? option?.value).includes(positionLabelKey(input))}
        className="w-full"
      >
        <Input
          aria-label="Nhập vị trí chuyên môn không có trong danh mục"
          maxLength={255}
          placeholder={inputDisabled && !disabled ? 'Đã chọn đủ vị trí chuyên môn' : 'Nhập vị trí rồi nhấn Tab hoặc Enter'}
          className="!h-10 !rounded-xl"
          onBlur={() => commit(inputValue)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && inputValue.trim()) {
              event.preventDefault()
              commit(inputValue)
            } else if (event.key === 'Tab' && inputValue.trim()) {
              commit(inputValue)
            }
          }}
        />
      </AutoComplete>
      <p aria-live="polite" className={`text-xs ${limitError ? 'text-red-500' : 'text-slate-500'}`}>
        {limitError || `Có thể nhập tối đa ${MAX_CUSTOM_DESIRED_POSITIONS} vị trí, phân tách bằng Tab, Enter, dấu phẩy hoặc dấu chấm phẩy.`}
      </p>
    </div>
  )
}
