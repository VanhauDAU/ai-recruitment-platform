import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetailContent from './JobDetailContent'

vi.mock('./JobQualityRating', () => ({ default: () => null }))

const job = {
  public_id: 'job_long_description',
  description: '<p>Mô tả công việc dài.</p>',
  requirements: '<p>Yêu cầu ứng viên dài.</p>',
  benefits: '<p>Quyền lợi ứng viên.</p>',
  requirement_tags: [],
  domain_knowledge: [],
  required_skills: [],
  preferred_skills: [],
  benefit_groups: [],
  language_requirements: [],
  workplace_groups: [],
  work_schedules: [],
  work_schedule_note: '',
  deadline: null,
}

describe('JobDetailContent', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function getScrollHeight() {
      return this.id === 'job-detail-collapsible-content' ? 1_000 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function getClientHeight() {
      return this.id === 'job-detail-collapsible-content' ? 520 : 0
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('fades long details, expands them fully, and offers a collapse action', async () => {
    const onReport = vi.fn()
    const onCreateJobAlert = vi.fn()
    render(
      <JobDetailContent
        job={job}
        relatedJobs={[]}
        saved={false}
        savePending={false}
        isAuthenticated={false}
        applicationStatus={{ hasApplied: false, isLimitReached: false }}
        canCreateJobAlert
        onApply={vi.fn()}
        onCreateJobAlert={onCreateJobAlert}
        onSave={vi.fn()}
        onReport={onReport}
        onRequireLogin={vi.fn()}
      />,
    )

    const expandButton = await screen.findByRole('button', { name: /Xem đầy đủ mô tả công việc/ })
    const content = document.getElementById('job-detail-collapsible-content')
    expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    expect(content).toHaveClass('overflow-hidden')

    fireEvent.click(expandButton)

    const collapseButton = screen.getByRole('button', { name: /Thu gọn mô tả công việc/ })
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    expect(content).not.toHaveClass('overflow-hidden')

    const reportButton = screen.getByRole('button', { name: 'hãy phản ánh với chúng tôi' })
    expect(reportButton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByText('Báo cáo tin tuyển dụng:', { exact: true }).parentElement).toHaveClass('bg-[#F2F4F5]')
    fireEvent.click(reportButton)
    expect(onReport).toHaveBeenCalledOnce()

    const alertButton = screen.getByRole('button', { name: 'Gửi tôi việc làm tương tự' })
    expect(alertButton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(alertButton).not.toHaveClass('w-full')
    fireEvent.click(alertButton)
    expect(onCreateJobAlert).toHaveBeenCalledOnce()
  })
})
