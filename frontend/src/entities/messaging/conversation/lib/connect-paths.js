import { employerAppPath } from '@/shared/config/portals'

export const CANDIDATE_CONNECT_PATH = '/procv-connect'
export const EMPLOYER_CONNECT_SEGMENT = '/procv-connect'

/** Inbox route of a portal, optionally opened on one conversation. */
export function connectPath(portal, conversationId = '') {
  const suffix = conversationId ? `/${encodeURIComponent(conversationId)}` : ''
  return portal === 'employer'
    ? employerAppPath(`${EMPLOYER_CONNECT_SEGMENT}${suffix}`)
    : `${CANDIDATE_CONNECT_PATH}${suffix}`
}

/** Role of the signed-in side in a portal's conversations (`my_role`, `sender_role`). */
export function portalRole(portal) {
  return portal === 'employer' ? 'recruiter' : 'candidate'
}
