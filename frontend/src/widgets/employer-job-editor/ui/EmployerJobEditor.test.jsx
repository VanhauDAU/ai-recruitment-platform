import { fireEvent, render, screen } from '@testing-library/react'
import { useLocation, MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployerJobEditor from './EmployerJobEditor'

const mocks = vi.hoisted(() => ({
  createJobFormValues: vi.fn((values) => values),
}))

vi.mock('@/features/generate-job-post', () => ({
  AI_JOB_MODES: new Set(['ai_brief', 'jd_text']),
  AiJobGenerationPanel: ({ mode, onGenerationChange, onSuggestionReady, onUseManual }) => {
    const completed = {
      public_id: 'generation_1',
      status: 'completed',
      suggestion: { title: 'Kỹ sư Backend' },
      manual_fields: ['salary_min', 'deadline'],
      unresolved_suggestions: { categories: ['Backend'], skills: ['Django'], benefits: [] },
    }
    return (
      <div data-testid="ai-panel">
        <span>{mode}</span>
        <button
          type="button"
          onClick={() => {
            onGenerationChange('generation_1')
            onSuggestionReady(completed)
          }}
        >
          Hoàn tất AI
        </button>
        <button type="button" onClick={() => onUseManual(completed)}>Tiếp tục chỉnh sửa</button>
        <button type="button" onClick={() => onUseManual(null)}>Dùng thủ công</button>
      </div>
    )
  },
}))

vi.mock('@/features/post-job', () => ({
  createJobFormValues: mocks.createJobFormValues,
  PostJobForm: ({ aiSuggestionKey, onSaveDraft }) => (
    <div data-testid="post-job-form" data-ai-key={aiSuggestionKey || ''}>
      <button type="button" onClick={() => onSaveDraft({ title: 'Bản nháp' })}>Lưu từ form</button>
    </div>
  ),
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderEditor(initialEntry, props = {}) {
  const onSaveDraft = vi.fn()
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EmployerJobEditor
        initialValues={{ campaign: 'campaign_1' }}
        onPublish={vi.fn()}
        onSaveDraft={onSaveDraft}
        {...props}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
  return { onSaveDraft }
}

describe('EmployerJobEditor', () => {
  beforeEach(() => mocks.createJobFormValues.mockClear())

  it('opens the destination chooser and preserves campaign when selecting an AI mode', () => {
    renderEditor('/tuyendung/app/jobs/new?campaign=campaign_1')

    expect(screen.getByRole('heading', { name: 'Bạn muốn bắt đầu theo cách nào?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tạo với AI/ }))

    expect(screen.getByTestId('ai-panel')).toHaveTextContent('ai_brief')
    expect(screen.getByTestId('location')).toHaveTextContent('campaign=campaign_1')
    expect(screen.getByTestId('location')).toHaveTextContent('mode=ai_brief')
  })

  it('shows the form only after a completed AI result and keeps attribution outside form values', () => {
    const { onSaveDraft } = renderEditor('/tuyendung/app/jobs/new?mode=ai_brief&campaign=campaign_1')

    expect(screen.queryByTestId('post-job-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất AI' }))

    expect(screen.getByTestId('post-job-form')).toHaveAttribute('data-ai-key', 'generation_1')
    expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('Bản nháp AI đã được điền vào form')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('mode=ai_brief')
    expect(screen.getByTestId('location')).toHaveTextContent('generation=generation_1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu từ form' }))
    expect(onSaveDraft).toHaveBeenCalledWith({ title: 'Bản nháp' }, 'generation_1')
  })

  it('switches a completed generation to the manual form when the fallback callback is used', () => {
    renderEditor('/tuyendung/app/jobs/new?mode=ai_brief&campaign=campaign_1')

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }))

    expect(screen.getByTestId('post-job-form')).toHaveAttribute('data-ai-key', 'generation_1')
    expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('mode=manual')
    expect(screen.getByTestId('location')).toHaveTextContent('generation=generation_1')
    expect(screen.getByTestId('location')).toHaveTextContent('campaign=campaign_1')
  })

  it('switches a failed or active generation to a clean manual form', () => {
    renderEditor('/tuyendung/app/jobs/new?mode=ai_brief&generation=generation_old&campaign=campaign_1')

    fireEvent.click(screen.getByRole('button', { name: 'Dùng thủ công' }))

    expect(screen.getByTestId('post-job-form')).toHaveAttribute('data-ai-key', '')
    expect(screen.getByTestId('location')).toHaveTextContent('mode=manual')
    expect(screen.getByTestId('location')).not.toHaveTextContent('generation=')
    expect(screen.getByTestId('location')).toHaveTextContent('campaign=campaign_1')
  })

  it('forces existing edit routes to the manual form even when AI query parameters are present', () => {
    renderEditor('/tuyendung/app/jobs/job_1/edit?mode=ai_brief&generation=generation_1', { isEditing: true })

    expect(screen.getByTestId('post-job-form')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bạn muốn bắt đầu theo cách nào?' })).not.toBeInTheDocument()
  })
})
