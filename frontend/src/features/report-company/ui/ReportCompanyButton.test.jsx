import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportCompanyButton from './ReportCompanyButton'

const { audience } = vi.hoisted(() => ({ audience: { current: 'candidate' } }))

vi.mock('@/entities/session', () => ({ useCandidateAudience: () => audience.current }))
vi.mock('./ReportCompanyModal', () => ({
  default: ({ company, sections, open, onClose }) => (open ? (
    <div role="dialog" aria-label={`Báo cáo ${company.name}`}>
      <output>{sections.map((section) => section.key).join(',')}</output>
      <button type="button" onClick={onClose}>Đóng</button>
    </div>
  ) : null),
}))

const COMPANY = { public_id: 'co_ab12', name: 'FPT Software' }

function renderButton() {
  const onRequireLogin = vi.fn()
  const view = render(
    <ReportCompanyButton
      company={COMPANY}
      sections={[{ key: 'about', title: 'Giới thiệu công ty' }]}
      onRequireLogin={onRequireLogin}
    />,
  )
  return { ...view, onRequireLogin }
}

describe('ReportCompanyButton', () => {
  beforeEach(() => {
    audience.current = 'candidate'
  })

  it('opens the report form for a candidate and closes it again', async () => {
    const user = userEvent.setup()
    const { onRequireLogin } = renderButton()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Báo cáo thông tin sai' }))

    expect(await screen.findByRole('dialog', { name: 'Báo cáo FPT Software' })).toHaveTextContent('about')
    expect(onRequireLogin).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks a guest to sign in and opens the form once the login succeeds', async () => {
    const user = userEvent.setup()
    audience.current = 'guest'
    const { onRequireLogin } = renderButton()

    await user.click(screen.getByRole('button', { name: 'Báo cáo thông tin sai' }))
    expect(onRequireLogin).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => onRequireLogin.mock.calls[0][0]())
    expect(await screen.findByRole('dialog', { name: 'Báo cáo FPT Software' })).toBeInTheDocument()
  })

  it('is not shown to signed-in employers and admins', () => {
    // useCandidateAudience trả null cho mọi vai trò không phải ứng viên.
    audience.current = null
    const { container } = renderButton()

    expect(container).toBeEmptyDOMElement()
  })
})
