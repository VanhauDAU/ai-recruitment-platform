import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const storage = new Map()
const localStorageMock = {
  get length() {
    return storage.size
  },
  clear() {
    storage.clear()
  },
  getItem(key) {
    return storage.get(String(key)) ?? null
  },
  key(index) {
    return [...storage.keys()][index] ?? null
  },
  removeItem(key) {
    storage.delete(String(key))
  },
  setItem(key, value) {
    storage.set(String(key), String(value))
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})
Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock })

// jsdom không có matchMedia/ResizeObserver — antd (Grid, Dropdown, Form) cần chúng.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
}
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom intentionally does not implement pseudo-element styles. Ant Design's
// wave/motion helpers still ask for them after every click, which prints a
// warning and makes interaction-heavy suites spend most of their time inside
// jsdom's virtual console. Ignoring the unsupported second argument preserves
// jsdom's real computed-style behavior while removing that test-only overhead.
const getComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = (element) => {
  const styles = getComputedStyle(element)
  const getPropertyValue = styles.getPropertyValue.bind(styles)
  styles.getPropertyValue = (property) => {
    const value = getPropertyValue(property)
    if (
      /^(padding-(top|bottom)|border-(top|bottom)-width)$/.test(property)
      && !Number.isFinite(Number.parseFloat(value))
    ) {
      return '0px'
    }
    return value
  }
  return styles
}

// jsdom also logs on every canvas context request before returning null.
// Returning that same unsupported value directly keeps canvas fallbacks
// testable without flooding CI output.
HTMLCanvasElement.prototype.getContext = () => null

afterEach(() => {
  cleanup()
  localStorage.clear()
})
