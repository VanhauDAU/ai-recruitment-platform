import { useEffect, useRef, useState } from 'react'

export const FEED_SIZE = 3
const ROTATE_MS = 10000
const FEED_EXIT_MS = 420

// Feeds `jobs` in one at a time at the top, pushing existing entries down;
// the entry pushed past FEED_SIZE plays an exit animation before being dropped.
export function useLatestJobsFeed(jobs, enabled) {
  const [feed, setFeed] = useState([])
  const indexRef = useRef(0)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!enabled || !jobs.length) {
      setFeed((prev) => (prev.length ? [] : prev))
      return undefined
    }
    const seedCount = Math.min(FEED_SIZE, jobs.length)
    indexRef.current = seedCount
    setFeed(jobs.slice(0, seedCount).map((job, i) => ({ uid: `${job.public_id}-seed-${i}`, job })))

    if (jobs.length <= FEED_SIZE) return undefined

    const timer = setInterval(() => {
      const job = jobs[indexRef.current % jobs.length]
      const uid = `${job.public_id}-${indexRef.current}`
      indexRef.current += 1
      setFeed((prev) => [
        { uid, job },
        ...prev.map((item, i) => (i === prev.length - 1 ? { ...item, exiting: true } : item)),
      ])
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setFeed((prev) => prev.filter((item) => !item.exiting))
      }, FEED_EXIT_MS)
    }, ROTATE_MS)

    return () => {
      clearInterval(timer)
      clearTimeout(timeoutRef.current)
    }
  }, [jobs, enabled])

  return feed
}
