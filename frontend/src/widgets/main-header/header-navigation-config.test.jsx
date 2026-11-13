import { describe, expect, it } from 'vitest'
import { COMPANY_DIRECTORY_PATH } from '@/entities/company'
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
