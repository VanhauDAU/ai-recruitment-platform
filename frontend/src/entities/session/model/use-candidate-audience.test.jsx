import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SessionContext from './session-context'
import { useCandidateAudience } from './use-candidate-audience'

function audienceFor(session) {
  const wrapper = ({ children }) => (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  )
  return renderHook(() => useCandidateAudience(), { wrapper }).result.current
}

describe('useCandidateAudience', () => {
  it('separates guests, candidates and everyone who must not see candidate actions', () => {
    expect(audienceFor({ loading: false, isAuthenticated: false, user: null })).toBe('guest')
    expect(audienceFor({ loading: false, isAuthenticated: true, user: { role: 'candidate' } })).toBe('candidate')
    expect(audienceFor({ loading: false, isAuthenticated: true, user: { role: 'employer' } })).toBeNull()
    expect(audienceFor({ loading: false, isAuthenticated: true, user: { role: 'admin' } })).toBeNull()
  })

  it('stays hidden while the session is still being restored', () => {
    expect(audienceFor({ loading: true, isAuthenticated: false, user: null })).toBeNull()
  })
})
