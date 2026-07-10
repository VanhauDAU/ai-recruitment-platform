import { useState } from 'react'

const SAVED_KEY = 'saved_jobs'

function getSaved() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export default function useSavedJob(publicId) {
  const [saved, setSaved] = useState(() => getSaved().has(publicId))

  function toggle() {
    const set = getSaved()
    if (set.has(publicId)) set.delete(publicId)
    else set.add(publicId)
    localStorage.setItem(SAVED_KEY, JSON.stringify([...set]))
    setSaved(set.has(publicId))
  }

  return [saved, toggle]
}
