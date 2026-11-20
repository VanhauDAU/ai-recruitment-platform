import { afterEach, describe, expect, it } from 'vitest'
import { allowNextUnload, hasUnsavedChanges, registerUnsavedChanges } from './unsaved-changes'

function unload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('unsaved changes registry', () => {
  const cleanups = []
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

  it('warns before unload only while a registered form is dirty', () => {
    let dirty = false
    cleanups.push(registerUnsavedChanges(() => dirty))

    expect(hasUnsavedChanges()).toBe(false)
    expect(unload()).toBe(false)

    dirty = true
    expect(hasUnsavedChanges()).toBe(true)
    expect(unload()).toBe(true)
  })

  it('stops warning once every form unregisters', () => {
    const unregister = registerUnsavedChanges(() => true)
    unregister()

    expect(hasUnsavedChanges()).toBe(false)
    expect(unload()).toBe(false)
  })

  it('skips the browser prompt after an in-app confirmation and can restore it', () => {
    cleanups.push(registerUnsavedChanges(() => true))
    const restore = allowNextUnload()

    expect(unload()).toBe(false)
    restore()
    expect(unload()).toBe(true)
  })
})
