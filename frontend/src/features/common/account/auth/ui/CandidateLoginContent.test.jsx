import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import CandidateLoginContent from './CandidateLoginContent'

vi.mock('./AuthLogo', () => ({ default: () => <span>ProCV</span> }))
vi.mock('./SocialLoginButtons', () => ({ default: () => null }))
vi.mock('./LoginForm', () => ({
  default: ({ withMascot }) => (
    <span data-testid="login-form-mascot">{withMascot ? 'visible' : 'hidden'}</span>
  ),
}))

function renderContent(props = {}) {
  return render(
    <MemoryRouter>
      <CandidateLoginContent {...props} />
    </MemoryRouter>,
  )
}

describe('CandidateLoginContent', () => {
  it('shows the mascot on the dedicated login page', () => {
    renderContent()
    expect(screen.getByTestId('login-form-mascot')).toHaveTextContent('visible')
  })

  it('does not render the mascot in the inline login popup', () => {
    renderContent({ onSuccess: vi.fn() })
    expect(screen.getByTestId('login-form-mascot')).toHaveTextContent('hidden')
  })
})
