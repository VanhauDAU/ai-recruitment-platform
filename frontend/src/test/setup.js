import '@testing-library/jest-dom/vitest'
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
// Đăng ký trước phần DOM: after-hook chạy ngược thứ tự đăng ký, nên cây React
// được unmount (cleanup) trước rồi mới xóa storage, như trước khi tách file.
afterEach(() => {
  localStorage.clear()
})

// Môi trường node không có DOM: bỏ qua stub trình duyệt và cleanup của
// Testing Library để file thuần logic không trả chi phí import react-dom.
if (typeof window !== 'undefined') await import('./setup-dom.js')
