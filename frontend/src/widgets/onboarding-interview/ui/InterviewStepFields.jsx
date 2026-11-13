import { Checkbox, InputNumber, Select } from 'antd'
import {
  DesiredPositionTagsInput,
  EXPERIENCE_OPTIONS,
  JobSpecializationPicker,
  MAX_CUSTOM_DESIRED_POSITIONS,
  MAX_DESIRED_SPECIALIZATIONS,
  normalizeDesiredPositionOthers,
} from '@/features/configure-job-preferences'

const DROPDOWN_CLASS_NAME = 'onboarding-chat__dropdown'
const SALARY_PRESETS = [8, 10, 15, 20, 30].map((millions) => ({
  label: `${millions} triệu`,
  value: millions * 1_000_000,
}))

function ChoiceChip({ children, onClick, selected }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-medium transition ${selected
        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-900/20'
        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Control trả lời của từng lượt hỏi. Tên trường giữ y hệt form một trang cũ nên
 * payload gửi lên `PUT /api/candidate/job-preferences/` không đổi.
 *
 * Lựa chọn chỉ có một đáp án (kinh nghiệm, mức lương gợi ý) gọi `onQuickAnswer`
 * để bấm phát gửi luôn — đó là lý do cuộc trò chuyện không cần nút "Tiếp tục".
 */
export default function InterviewStepFields({ catalog, onQuickAnswer, onSend, setField, stepId, values }) {
  if (stepId === 'specialization') {
    const selectedIds = values.desired_specialization_ids || []
    const customPositions = normalizeDesiredPositionOthers(values.desired_position_others)

    function selectSuggestedPosition(id) {
      if (selectedIds.includes(id)) return true
      if (selectedIds.length >= MAX_DESIRED_SPECIALIZATIONS) return false
      setField('desired_specialization_ids', [...selectedIds, id])
      return true
    }

    return (
      <div className="space-y-3">
        <JobSpecializationPicker
          categories={catalog.categories}
          disabled={catalog.loading}
          maxSelections={MAX_DESIRED_SPECIALIZATIONS}
          value={selectedIds}
          onChange={(ids) => setField('desired_specialization_ids', ids)}
        />
        <DesiredPositionTagsInput
          availableSlots={Math.max(0, MAX_CUSTOM_DESIRED_POSITIONS - customPositions.length)}
          availableSuggestionSlots={Math.max(0, MAX_DESIRED_SPECIALIZATIONS - selectedIds.length)}
          disabled={catalog.loading}
          selectedSuggestionIds={selectedIds}
          suggestions={catalog.specializationSuggestions}
          value={customPositions}
          onChange={(positions) => setField('desired_position_others', positions)}
          onSuggestionSelect={selectSuggestedPosition}
        />
      </div>
    )
  }

  if (stepId === 'experience') {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EXPERIENCE_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.value}
            selected={values.experience_level === option.value}
            onClick={() => onQuickAnswer({ experience_level: option.value })}
          >
            {option.label}
          </ChoiceChip>
        ))}
      </div>
    )
  }

  if (stepId === 'salary') {
    return (
      <div className="space-y-3">
        <div className="relative">
          <InputNumber
            autoFocus
            controls={false}
            className="onboarding-chat__salary-input"
            min={1}
            precision={0}
            inputMode="numeric"
            placeholder="0"
            value={values.desired_salary_vnd}
            onChange={(value) => setField('desired_salary_vnd', value)}
            onPressEnter={onSend}
            formatter={(value) => (value == null || value === '' ? '' : new Intl.NumberFormat('vi-VN').format(value))}
            parser={(value) => {
              const num = Number(String(value || '').replace(/[^\d]/g, ''))
              return num > 0 ? num : null
            }}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
            VND / tháng
          </span>
        </div>
        {/* Cuộn ngang như dải quick reply: ở mobile các mức lương không xuống
            dòng làm ô soạn cao chiếm hết màn hình. */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {SALARY_PRESETS.map((preset) => (
            <ChoiceChip
              key={preset.value}
              selected={values.desired_salary_vnd === preset.value}
              onClick={() => onQuickAnswer({ desired_salary_vnd: preset.value })}
            >
              {preset.label}
            </ChoiceChip>
          ))}
        </div>
      </div>
    )
  }

  if (stepId === 'location') {
    return (
      <div className="space-y-3">
        <Select
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          loading={catalog.loading}
          options={catalog.provinceOptions}
          value={values.preferred_province_ids}
          onChange={(ids) => setField('preferred_province_ids', ids)}
          classNames={{ popup: { root: DROPDOWN_CLASS_NAME } }}
          placeholder="Chọn tỉnh/thành"
          maxTagCount="responsive"
          className="onboarding-chat__location-select"
        />
        <Checkbox
          checked={values.willing_to_relocate}
          onChange={(event) => setField('willing_to_relocate', event.target.checked)}
        >
          Sẵn sàng thay đổi địa điểm làm việc nếu có cơ hội phù hợp
        </Checkbox>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <Checkbox
        checked={values.ai_recommendation_consent}
        onChange={(event) => setField('ai_recommendation_consent', event.target.checked)}
      >
        Đồng ý để hệ thống gợi ý việc làm dựa trên nhu cầu công việc của tôi.
      </Checkbox>
      <Checkbox
        checked={values.recruiter_visibility_consent}
        onChange={(event) => setField('recruiter_visibility_consent', event.target.checked)}
      >
        Đồng ý cho phép nhà tuyển dụng tìm thấy và xem thông tin hồ sơ/CV của tôi.
      </Checkbox>
    </div>
  )
}
