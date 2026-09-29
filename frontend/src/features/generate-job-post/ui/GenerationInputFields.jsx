import { Form, Input, Select } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
} from '@/entities/job'
import { getGenerationListFieldError } from '../model/generation'

const { TextArea } = Input
const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))

function updateDraftValue(draft, onDraftChange, field, value) {
  onDraftChange({ ...draft, [field]: value })
}

export function GuidedBriefFields({ draft, onDraftChange }) {
  const listFields = [
    ['responsibilities', 'Trách nhiệm chính', 'Ví dụ: Xây dựng API cho nền tảng tuyển dụng'],
    ['requirements', 'Yêu cầu bắt buộc', 'Ví dụ: Có 3 năm kinh nghiệm với Python'],
    ['preferred_skills', 'Kỹ năng ưu tiên', 'Ví dụ: Biết triển khai trên Google Cloud'],
  ]

  return (
    <div className="grid min-w-0 gap-x-4 md:grid-cols-2">
      <Form.Item className="md:col-span-2" htmlFor="ai-job-position" label="Vị trí cần tuyển" required>
        <Input
          id="ai-job-position"
          maxLength={120}
          showCount
          value={draft.position || ''}
          placeholder="Ví dụ: Kỹ sư Backend Python"
          onChange={(event) => updateDraftValue(draft, onDraftChange, 'position', event.target.value)}
        />
      </Form.Item>
      <Form.Item htmlFor="ai-job-position-level" label="Cấp bậc gợi ý">
        <Select
          id="ai-job-position-level"
          allowClear
          options={toOptions(POSITION_LEVEL_LABELS)}
          value={draft.position_level}
          placeholder="Chọn nếu đã xác định"
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'position_level', value)}
        />
      </Form.Item>
      <Form.Item htmlFor="ai-job-employment-type" label="Loại công việc gợi ý">
        <Select
          id="ai-job-employment-type"
          allowClear
          options={toOptions(EMPLOYMENT_TYPE_LABELS)}
          value={draft.employment_type}
          placeholder="Chọn nếu đã xác định"
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'employment_type', value)}
        />
      </Form.Item>
      <Form.Item className="md:col-span-2" htmlFor="ai-job-work-types" label="Hình thức làm việc gợi ý">
        <Select
          id="ai-job-work-types"
          mode="multiple"
          maxTagCount="responsive"
          options={toOptions(WORK_TYPE_LABELS)}
          value={draft.work_types || []}
          placeholder="Có thể chọn nhiều hình thức"
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'work_types', value)}
        />
      </Form.Item>
      {listFields.map(([field, label, placeholder]) => {
        const error = getGenerationListFieldError(draft[field])
        return (
          <Form.Item
            key={field}
            htmlFor={`ai-job-${field}`}
            label={`${label} (mỗi ý một dòng)`}
            validateStatus={error ? 'error' : undefined}
            help={error || 'Tối đa 10 ý, mỗi ý 120 ký tự.'}
          >
            <TextArea
              id={`ai-job-${field}`}
              autoSize={{ minRows: 3, maxRows: 7 }}
              value={draft[field] || ''}
              placeholder={placeholder}
              onChange={(event) => updateDraftValue(draft, onDraftChange, field, event.target.value)}
            />
          </Form.Item>
        )
      })}
      <Form.Item className="md:col-span-2" htmlFor="ai-job-notes" label="Ghi chú thêm">
        <TextArea
          id="ai-job-notes"
          autoSize={{ minRows: 3, maxRows: 8 }}
          maxLength={2000}
          showCount
          value={draft.notes || ''}
          placeholder="Văn phong mong muốn, điểm đặc biệt của đội ngũ hoặc thông tin đã được công ty xác nhận"
          onChange={(event) => updateDraftValue(draft, onDraftChange, 'notes', event.target.value)}
        />
      </Form.Item>
    </div>
  )
}

export function PastedJdField({ draft, onDraftChange }) {
  return (
    <Form.Item
      htmlFor="ai-job-source-text"
      label="Nội dung JD hiện có"
      required
      extra="Thông tin liên hệ sẽ được backend loại bỏ trước khi gửi tới nhà cung cấp AI."
    >
      <TextArea
        id="ai-job-source-text"
        autoSize={{ minRows: 12, maxRows: 24 }}
        maxLength={20000}
        showCount
        value={draft.source_text || ''}
        placeholder="Dán nội dung mô tả công việc cần chuẩn hóa tại đây..."
        onChange={(event) => updateDraftValue(draft, onDraftChange, 'source_text', event.target.value)}
      />
    </Form.Item>
  )
}
