import { useEffect, useState } from 'react'

const STORAGE_KEY = 'color-scheme'

function getInitialScheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Class-based dark mode (see index.css `@custom-variant dark`). Respects system
// preference until the user explicitly toggles, then persists their choice.
export function useColorScheme() {
  const [scheme, setScheme] = useState(getInitialScheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark')
    localStorage.setItem(STORAGE_KEY, scheme)
  }, [scheme])

  function toggle() {
    setScheme((s) => (s === 'dark' ? 'light' : 'dark'))
  }

  return [scheme, toggle]
}
