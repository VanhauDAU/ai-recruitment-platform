let featuredRequestSequence = 0

export const FEATURED_REQUEST_STATE_KEY = 'companyFeaturedRequestKey'

export function createFeaturedRequestKey() {
  featuredRequestSequence += 1
  return `company-route-${featuredRequestSequence}`
}
