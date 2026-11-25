import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OAUTH_POPUP_CHANNEL } from '../model/oauth-popup'
import SocialLoginButtons from './SocialLoginButtons'

const siteSettings = vi.hoisted(() => ({ settings: {} }))
const mocks = vi.hoisted(() => ({ completeOAuth: vi.fn(), setCurrentUser: vi.fn(), error: vi.fn() }))
vi.mock('@/entities/system/site-settings', () => ({ useSiteSettings: () => siteSettings }))
vi.mock('@/entities/account/session', () => ({ useSession: () => ({ setCurrentUser: mocks.setCurrentUser }) }))
vi.mock('@/shared/lib/toast', () => ({ message: { success: vi.fn(), error: mocks.error } }))
vi.mock('../api/auth.api', async (importOriginal) => ({
  ...(await importOriginal()),
  completeOAuth: mocks.completeOAuth,
}))

function render(ui) {
  return rtlRender(
    <MemoryRouter initialEntries={['/viec-lam']}>
      <Routes>
        <Route path="/viec-lam" element={ui} />
        <Route path="/ho-so" element={<span>Hồ sơ</span>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SocialLoginButtons appearance', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    siteSettings.settings = {}
  })

  it('keeps the employer Google button light with readable hover text under a stale dark theme', () => {
    document.documentElement.classList.add('dark')

    render(<SocialLoginButtons portal="employer" appearance="employer" />)

    const button = screen.getByRole('button', { name: 'Đăng nhập bằng Google' })
    expect(button).toHaveClass(
      'bg-white',
      'text-slate-700',
      'hover:bg-blue-50/40',
      'hover:text-slate-900',
    )
    expect(button.className).not.toContain('dark:')
  })

  it('retains dark mode support for the default candidate appearance', () => {
    render(<SocialLoginButtons providers={['google']} />)

    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Google' })).toHaveClass(
      'dark:bg-zinc-800',
      'dark:text-gray-200',
      'dark:border-zinc-700',
    )
  })

  it('shows only the providers the admin keeps open for the portal', () => {
    siteSettings.settings = { oauth_providers_candidate: ['linkedin', 'twitter'] }

    render(<SocialLoginButtons />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /LinkedIn/ })).toBeInTheDocument()
  })

  it('renders nothing when the admin closes every provider of the portal', () => {
    siteSettings.settings = { oauth_providers_employer: [] }

    const { container } = render(<SocialLoginButtons portal="employer" />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('SocialLoginButtons OAuth popup', () => {
  const channels = []
  let open
  let assign

  function setDesktop(matches) {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })))
  }

  // Giả lập trang callback trong popup: nghe ack rồi phát kết quả.
  function popupChannel() {
    const channel = new BroadcastChannel(OAUTH_POPUP_CHANNEL)
    channel.acks = []
    channel.onmessage = ({ data }) => channel.acks.push(data)
    channels.push(channel)
    return channel
  }

  function openedNonce() {
    const url = new URL(open.mock.calls[0][0])
    expect(url.searchParams.get('mode')).toBe('popup')
    return url.searchParams.get('nonce')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setDesktop(true)
    open = vi.fn(() => ({ closed: false, focus: vi.fn() }))
    assign = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('location', { ...window.location, assign })
    mocks.completeOAuth.mockResolvedValue({ user: { role: 'candidate', job_preferences_configured: true } })
  })

  afterEach(() => {
    channels.splice(0).forEach((channel) => channel.close())
    vi.unstubAllGlobals()
  })

  it('opens a popup on desktop and finishes the login when its result arrives', async () => {
    render(<SocialLoginButtons providers={['google']} next="/ho-so" />)
    const callback = popupChannel()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }))

    expect(open).toHaveBeenCalledWith(expect.stringContaining('/auth/oauth/google/start/'), 'procv-oauth', expect.stringContaining('width=500'))
    expect(assign).not.toHaveBeenCalled()
    const nonce = openedNonce()
    callback.postMessage({ type: 'result', nonce, code: 'one-time', next: '/ho-so' })

    expect(await screen.findByText('Hồ sơ')).toBeInTheDocument()
    expect(mocks.completeOAuth).toHaveBeenCalledWith('one-time', 'main')
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'candidate' }))
    expect(callback.acks).toEqual([{ type: 'ack', nonce }])
  })

  it('ignores results for another nonce and stays on the page with onSuccess', async () => {
    const onSuccess = vi.fn()
    render(<SocialLoginButtons providers={['google']} onSuccess={onSuccess} />)
    const callback = popupChannel()
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }))
    const nonce = openedNonce()

    callback.postMessage({ type: 'result', nonce: 'someone-else', code: 'stolen' })
    callback.postMessage({ type: 'result', nonce, error: 'access_denied' })

    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1))
    expect(mocks.completeOAuth).not.toHaveBeenCalled()
    expect(callback.acks).toEqual([{ type: 'ack', nonce }])

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }))
    callback.postMessage({ type: 'result', nonce: new URL(open.mock.calls[1][0]).searchParams.get('nonce'), code: 'one-time' })

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ role: 'candidate' })))
    expect(screen.queryByText('Hồ sơ')).not.toBeInTheDocument()
  })

  it('falls back to a full-page redirect when the popup is blocked', () => {
    open.mockReturnValue(null)
    const onBeforeRedirect = vi.fn()
    render(<SocialLoginButtons providers={['google']} onBeforeRedirect={onBeforeRedirect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }))

    expect(onBeforeRedirect).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith(expect.not.stringContaining('mode=popup'))
  })

  it('keeps the full-page redirect on touch or narrow screens', () => {
    setDesktop(false)
    render(<SocialLoginButtons providers={['google']} />)

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng Google' }))

    expect(open).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('/auth/oauth/google/start/?portal=main'))
  })
})
