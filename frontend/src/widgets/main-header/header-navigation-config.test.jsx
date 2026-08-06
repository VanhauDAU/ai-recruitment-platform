import { describe, expect, it } from 'vitest'
import {
  flattenMenuItems,
  HEADER_NAVIGATION,
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
