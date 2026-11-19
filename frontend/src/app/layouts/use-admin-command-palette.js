import { useEffect, useState } from 'react'

/**
 * Quick-jump palette state plus its ⌘K / Ctrl+K shortcut. `mounted` stays
 * false until first use so the layout can keep the palette's code lazy.
 */
export function useAdminCommandPalette({ enabled = true } = {}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const openPalette = () => {
    setMounted(true)
    setOpen(true)
  }

  useEffect(() => {
    if (!enabled) return undefined
    const handleShortcut = (event) => {
      // An editor that claimed the shortcut keeps it.
      if (event.defaultPrevented) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMounted(true)
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [enabled])

  return { open, mounted, openPalette, closePalette: () => setOpen(false) }
}
