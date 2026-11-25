import { Form, Input, Select } from 'antd'
import {
  EMPLOYMENT_TYPE_LABELS,
  POSITION_LEVEL_LABELS,
  WORK_TYPE_LABELS,
} from '@/entities/job/job'
import { getGenerationListFieldError } from '../model/generation'
import { m } from '@/shared/config/i18n'

const { TextArea } = Input
const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }))

function updateDraftValue(draft, onDraftChange, field, value) {
  onDraftChange({ ...draft, [field]: value })
}

export function GuidedBriefFields({ draft, onDraftChange }) {
  const listFields = [
    ['responsibilities', m.employer_job_ai_input_responsibilities(), m.employer_job_ai_input_responsibilities_placeholder()],
    ['requirements', m.employer_job_ai_input_requirements(), m.employer_job_ai_input_requirements_placeholder()],
    ['preferred_skills', m.employer_job_ai_input_preferred_skills(), m.employer_job_ai_input_preferred_skills_placeholder()],
    ['benefits', m.employer_job_ai_input_benefits(), m.employer_job_ai_input_benefits_placeholder()],
  ]

  return (
    <div className="grid min-w-0 gap-x-4 md:grid-cols-2">
      <Form.Item className="md:col-span-2" htmlFor="ai-job-position" label={m.employer_job_ai_input_position()} required>
        <Input
          id="ai-job-position"
          maxLength={120}
          showCount
          value={draft.position || ''}
          placeholder={m.employer_job_ai_input_position_placeholder()}
          onChange={(event) => updateDraftValue(draft, onDraftChange, 'position', event.target.value)}
        />
      </Form.Item>
      <Form.Item htmlFor="ai-job-position-level" label={m.employer_job_ai_input_position_level()}>
        <Select
          id="ai-job-position-level"
          allowClear
          options={toOptions(POSITION_LEVEL_LABELS)}
          value={draft.position_level}
          placeholder={m.employer_job_ai_input_choose_if_known()}
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'position_level', value)}
        />
      </Form.Item>
      <Form.Item htmlFor="ai-job-employment-type" label={m.employer_job_ai_input_employment_type()}>
        <Select
          id="ai-job-employment-type"
          allowClear
          options={toOptions(EMPLOYMENT_TYPE_LABELS)}
          value={draft.employment_type}
          placeholder={m.employer_job_ai_input_choose_if_known()}
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'employment_type', value)}
        />
      </Form.Item>
      <Form.Item className="md:col-span-2" htmlFor="ai-job-work-types" label={m.employer_job_ai_input_work_types()}>
        <Select
          id="ai-job-work-types"
          mode="multiple"
          maxTagCount="responsive"
          options={toOptions(WORK_TYPE_LABELS)}
          value={draft.work_types || []}
          placeholder={m.employer_job_ai_input_work_types_placeholder()}
          onChange={(value) => updateDraftValue(draft, onDraftChange, 'work_types', value)}
        />
      </Form.Item>
      {listFields.map(([field, label, placeholder]) => {
        const error = getGenerationListFieldError(draft[field])
        return (
          <Form.Item
            key={field}
            htmlFor={`ai-job-${field}`}
            label={m.employer_job_ai_input_list_label({ label })}
            validateStatus={error ? 'error' : undefined}
            help={error || m.employer_job_ai_input_list_help()}
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
      <Form.Item className="md:col-span-2" htmlFor="ai-job-notes" label={m.employer_job_ai_input_notes()}>
        <TextArea
          id="ai-job-notes"
          autoSize={{ minRows: 3, maxRows: 8 }}
          maxLength={2000}
          showCount
          value={draft.notes || ''}
          placeholder={m.employer_job_ai_input_notes_placeholder()}
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
      label={m.employer_job_ai_input_source_text()}
      required
      extra={m.employer_job_ai_input_source_text_extra()}
    >
      <TextArea
        id="ai-job-source-text"
        autoSize={{ minRows: 12, maxRows: 24 }}
        maxLength={20000}
        showCount
        value={draft.source_text || ''}
        placeholder={m.employer_job_ai_input_source_text_placeholder()}
        onChange={(event) => updateDraftValue(draft, onDraftChange, 'source_text', event.target.value)}
      />
    </Form.Item>
  )
}
