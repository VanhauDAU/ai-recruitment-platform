import { describe, expect, it } from 'vitest'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company/company'
import {
  flattenMenuItems,
  HEADER_NAVIGATION,
  isMenuActive,
  navigationForCapabilities,
} from './header-navigation-config'

function allItems(menus) {
  return menus.flatMap(flattenMenuItems)
}

describe('knowledgebase navigation capability', () => {
  it('hides the Help Center entry while the backend capability is disabled', () => {
    const menus = navigationForCapabilities(HEADER_NAVIGATION)

    expect(allItems(menus).some((item) => item.label === 'Hướng dẫn viết CV')).toBe(false)
  })

  it('links the CV guide category when the backend capability is enabled', () => {
    const menus = navigationForCapabilities(HEADER_NAVIGATION, {
      knowledgebaseEnabled: true,
    })

    expect(allItems(menus)).toContainEqual(expect.objectContaining({
      label: 'Hướng dẫn viết CV',
      to: '/tro-giup/cv-va-mau-cv',
    }))
  })
})

describe('company directory navigation', () => {
  it('exposes the public company directory and keeps the jobs menu active there', () => {
    const jobsMenu = HEADER_NAVIGATION.find((menu) => menu.key === 'jobs')
    const companyItem = flattenMenuItems(jobsMenu)
      .find((item) => item.label === 'Danh sách công ty')

    expect(companyItem).toEqual(expect.objectContaining({
      to: COMPANY_DIRECTORY_PATH,
    }))
    expect(companyItem.action).toBeUndefined()
    expect(isMenuActive(jobsMenu, COMPANY_DIRECTORY_PATH)).toBe(true)
    expect(isMenuActive(jobsMenu, '/cong-ty/tim-kiem')).toBe(true)
  })
})

describe('data-driven navigation groups', () => {
  const SOURCES = {
    jobGroups: [{ id: 46, name: 'Công nghệ thông tin', parent: null }, { id: 49, name: 'Backend', parent: 47 }],
    industries: [{ id: 42, name: 'Fintech' }],
    cvStyles: [{ category_type: 'style', slug: 'don-gian', name: 'Đơn giản' }, { category_type: 'position', slug: 'ke-toan', name: 'Kế toán' }],
    cvPositions: [{ category_type: 'style', slug: 'don-gian', name: 'Đơn giản' }, { category_type: 'position', slug: 'ke-toan', name: 'Kế toán' }],
    blogCategories: [],
  }

  it('links only real occupation groups, industries and CV categories', () => {
    const items = allItems(navigationForCapabilities(HEADER_NAVIGATION, { sources: SOURCES }))
    const byLabel = Object.fromEntries(items.map((item) => [item.label, item.to]))

    expect(byLabel['Công nghệ thông tin']).toBe('/viec-lam?cat=46')
    expect(byLabel.Backend).toBeUndefined()
    expect(byLabel.Fintech).toBe('/viec-lam?nganh=42')
    expect(byLabel['Đơn giản']).toBe('/mau-cv/don-gian')
    expect(byLabel['Mẫu CV Kế toán']).toBe('/mau-cv/ke-toan')
  })

  it('marks groups as loading until data arrives and hides empty groups', () => {
    const loading = navigationForCapabilities(HEADER_NAVIGATION)
    const loaded = navigationForCapabilities(HEADER_NAVIGATION, { sources: SOURCES })
    const groups = (menus) => menus.flatMap((menu) => menu.columns.flat())

    expect(groups(loading).some((group) => group.source === 'blogCategories' && group.loading)).toBe(true)
    expect(groups(loaded).some((group) => group.loading || group.source === 'blogCategories')).toBe(false)
  })

  it('every static item points to a route', () => {
    const items = allItems(navigationForCapabilities(HEADER_NAVIGATION, { knowledgebaseEnabled: true, sources: SOURCES }))

    expect(items.every((item) => typeof item.to === 'string' && item.to.startsWith('/'))).toBe(true)
  })
})

describe('nearby jobs navigation capability', () => {
  it('lists Jobs near me unless the admin switch is off', () => {
    const near = (menus) => allItems(menus).find((item) => item.to === '/viec-lam-gan-ban')
    expect(near(navigationForCapabilities(HEADER_NAVIGATION))).toBeTruthy()
    expect(near(navigationForCapabilities(HEADER_NAVIGATION, { nearbyJobsEnabled: false }))).toBeUndefined()
  })
})
