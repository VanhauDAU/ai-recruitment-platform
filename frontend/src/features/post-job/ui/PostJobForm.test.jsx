import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import PostJobForm from './PostJobForm'

const toastMocks = vi.hoisted(() => ({
  message: { warning: vi.fn() },
}))

vi.mock('@/entities/job', () => ({
  getJobBenefits: vi.fn().mockResolvedValue([]),
  getJobLanguages: vi.fn().mockResolvedValue([]),
  getSkills: vi.fn().mockResolvedValue([]),
  jobKeys: {
    benefits: ['jobs', 'benefits'],
    languages: ['jobs', 'languages'],
    skills: ['jobs', 'skills'],
  },
}))
vi.mock('@/entities/location', () => ({
  getProvinces: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/shared/lib/toast', () => ({ message: toastMocks.message }))

vi.mock('./JobGeneralFields', async () => {
  const { Form, Input } = await import('antd')
  return {
    default: () => (
      <>
        <Form.Item
          name="title"
          label="Tiêu đề tin"
          rules={[{ required: true, message: 'Nhập tiêu đề tin.' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="salary_min" label="Mức lương tối thiểu"><Input /></Form.Item>
      </>
    ),
  }
})
vi.mock('./JobFormSection', () => ({ default: ({ children }) => <section>{children}</section> }))
vi.mock('./ApplicationInfoFields', () => ({ default: () => null }))
vi.mock('./AutomaticApplicationStatusFields', () => ({ default: () => null }))
vi.mock('./CandidateExpectationFields', () => ({ default: () => null }))
vi.mock('./JobDescriptionFields', () => ({ default: () => null }))
vi.mock('./JobFormPreview', () => ({ default: () => null }))
vi.mock('./JobFormProgress', () => ({ default: () => null }))
vi.mock('./PostingQuotaNotice', () => ({ default: () => null }))

const suggestion = { title: 'Kỹ sư Backend AI' }
const postingContext = {
  job_postable: true,
  responsibility_statement: {
    version: '2026-11',
    text: 'Tôi cam kết nội dung đúng sự thật và chịu trách nhiệm về tin đã đăng.',
  },
}

function renderForm(props) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onPublish = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <PostJobForm
        initialValues={{ title: 'Kỹ sư Backend' }}
        postingContext={postingContext}
        onPublish={onPublish}
        onSaveDraft={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onPublish }
}

function StrictModeHarness({ onApplied }) {
  const [initialValues, setInitialValues] = useState({
    title: 'Tiêu đề ban đầu',
    salary_min: 10_000_000,
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <StrictMode>
      <QueryClientProvider client={client}>
        <button
          type="button"
          onClick={() => setInitialValues({ title: 'Dữ liệu tải lại', salary_min: 20_000_000 })}
        >
          Mô phỏng props tải lại
        </button>
        <PostJobForm
          aiSuggestion={suggestion}
          aiSuggestionKey="generation_1"
          initialValues={initialValues}
          onAiSuggestionApplied={onApplied}
          onPublish={vi.fn()}
          onSaveDraft={vi.fn()}
        />
      </QueryClientProvider>
    </StrictMode>
  )
}

describe('PostJobForm AI initialization', () => {
  it('merges initial values with the AI patch once under StrictMode and preserves later edits', async () => {
    const onApplied = vi.fn()
    render(<StrictModeHarness onApplied={onApplied} />)

    await waitFor(() => expect(screen.getByLabelText('Tiêu đề tin')).toHaveValue('Kỹ sư Backend AI'))
    expect(screen.getByLabelText('Mức lương tối thiểu')).toHaveValue('10000000')
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onApplied).toHaveBeenCalledWith('generation_1')

    fireEvent.change(screen.getByLabelText('Tiêu đề tin'), { target: { value: 'Nội dung NTD đã sửa' } })
    fireEvent.change(screen.getByLabelText('Mức lương tối thiểu'), { target: { value: '15000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mô phỏng props tải lại' }))

    expect(screen.getByLabelText('Tiêu đề tin')).toHaveValue('Nội dung NTD đã sửa')
    expect(screen.getByLabelText('Mức lương tối thiểu')).toHaveValue('15000000')
    expect(onApplied).toHaveBeenCalledTimes(1)
  })

  it('shows an actionable toast when client validation blocks publishing', async () => {
    toastMocks.message.warning.mockReset()
    const { onPublish } = renderForm({ initialValues: {}, isDraft: true })

    fireEvent.click(screen.getByRole('button', { name: /Đăng tin/ }))

    await waitFor(() => expect(toastMocks.message.warning).toHaveBeenCalledWith(
      'Nhập tiêu đề tin.',
      { duration: 5000, id: 'post-job-validation-error' },
    ))
    expect(onPublish).not.toHaveBeenCalled()
  })
})

describe('PostJobForm publication commitment', () => {
  it('publishes a draft only after the recruiter accepts the commitment in force', async () => {
    toastMocks.message.warning.mockReset()
    const { onPublish } = renderForm({ isDraft: true })
    const commitment = screen.getByRole('checkbox', {
      name: postingContext.responsibility_statement.text,
    })
    await waitFor(() => expect(screen.getByLabelText('Tiêu đề tin')).toHaveValue('Kỹ sư Backend'))

    fireEvent.click(screen.getByRole('button', { name: /Đăng tin/ }))

    await waitFor(() => expect(toastMocks.message.warning).toHaveBeenCalledWith(
      'Xác nhận cam kết trước khi đăng tin.',
      { duration: 5000, id: 'post-job-validation-error' },
    ))
    expect(onPublish).not.toHaveBeenCalled()

    fireEvent.click(commitment)
    fireEvent.click(screen.getByRole('button', { name: /Đăng tin/ }))

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    const [payload, acceptedStatementVersion] = onPublish.mock.calls[0]
    expect(payload.title).toBe('Kỹ sư Backend')
    expect(payload).not.toHaveProperty('responsibility_accepted')
    expect(acceptedStatementVersion).toBe('2026-11')
  })

  it('does not ask again when saving changes to a job that is already public', async () => {
    const { onPublish } = renderForm({ isDraft: false })
    await waitFor(() => expect(screen.getByLabelText('Tiêu đề tin')).toHaveValue('Kỹ sư Backend'))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và cập nhật' }))

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    expect(onPublish.mock.calls[0][1]).toBeUndefined()
  })

  it('blocks publishing when the commitment text could not be loaded', () => {
    renderForm({ isDraft: true, postingContext: undefined })

    expect(screen.getByText(/Chưa tải được nội dung cam kết đăng tin/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đăng tin/ })).toBeDisabled()
  })
})
