import { describe, expect, it } from 'vitest'
import { recruiterActionHref, recruiterNextAction } from './recruiter-next-action'

const account = (code, extra = {}) => ({ context: { next_action: { code, ...extra } } })

describe('recruiterNextAction', () => {
  it('maps admin work to a CTA that opens the right tab', () => {
    const action = recruiterNextAction(account('verification_overdue'))
    expect(action).toMatchObject({ tone: 'critical', owner: 'admin', cta: { tab: 'verification', params: {} } })
    expect(recruiterActionHref('usr_1', action.cta)).toBe('/admin/app/recruiters/usr_1?tab=verification')
  })

  it('deep-links a pending company update', () => {
    const action = recruiterNextAction(account('company_update_review', { company_update_public_id: 'cur_9' }))
    expect(recruiterActionHref('usr_1', action.cta))
      .toBe('/admin/app/recruiters/usr_1?tab=verification&company_update=cur_9')
  })

  it('has no CTA when the recruiter is the one who has to act', () => {
    expect(recruiterNextAction(account('awaiting_company'))).toMatchObject({ owner: 'recruiter', cta: undefined })
    expect(recruiterNextAction({ context: {} })).toBeNull()
  })
})
