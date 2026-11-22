import { lazy } from 'react'

export { default as CookieConsentBanner } from './ui/CookieConsentBanner'

// Opened only from "Tùy chỉnh"/the footer link, so it stays out of the initial bundle.
export const CookiePreferencesModal = lazy(() => import('./ui/CookiePreferencesModal'))
export { default as CookieSettingsButton } from './ui/CookieSettingsButton'
