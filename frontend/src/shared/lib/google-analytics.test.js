import { afterEach, describe, expect, it } from 'vitest'
import {
  clearGoogleAnalyticsCookies,
  enableGoogleAnalytics,
  pauseGoogleAnalytics,
} from './google-analytics'

const ID = 'G-AB12CD34EF'

afterEach(() => {
  document.getElementById('procv-gtag')?.remove()
  delete window.dataLayer
  delete window.gtag
  delete window[`ga-disable-${ID}`]
})

describe('google-analytics', () => {
  it('loads gtag.js once and toggles the disable flag', () => {
    enableGoogleAnalytics(ID)
    enableGoogleAnalytics(ID)

    const scripts = document.querySelectorAll('#procv-gtag')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(window.dataLayer.map((args) => args[0])).toEqual(['js', 'config'])

    pauseGoogleAnalytics(ID)
    expect(window[`ga-disable-${ID}`]).toBe(true)
    enableGoogleAnalytics(ID)
    expect(window[`ga-disable-${ID}`]).toBe(false)
  })

  it('ignores ids that are not GA4 measurement ids', () => {
    enableGoogleAnalytics('UA-123-1')
    enableGoogleAnalytics('G-x"><script>')

    expect(document.getElementById('procv-gtag')).toBeNull()
  })

  it('deletes only _ga cookies', () => {
    document.cookie = '_ga=GA1.1.1.1; path=/'
    document.cookie = `_ga_AB12CD34EF=GS1.1; path=/`
    document.cookie = 'keep=1; path=/'

    clearGoogleAnalyticsCookies()

    expect(document.cookie).toBe('keep=1')
    document.cookie = 'keep=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })
})
