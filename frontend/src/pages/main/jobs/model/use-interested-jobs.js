import { useEffect, useState } from 'react'
import { getCandidateJobPreferences } from '@/entities/candidate-preferences'
import { getJobs } from '@/entities/job'
import { useSession } from '@/entities/session'
import { SUGGESTION_LIMIT, buildInterestedJobTiers } from '../lib/interested-jobs-tiers'

// Gom đủ SUGGESTION_LIMIT việc gợi ý bằng cách gọi lần lượt các tầng nới lỏng
// (xem interested-jobs-tiers), khử trùng lặp theo public_id. Lỗi mạng thì trả
// danh sách rỗng để khối gợi ý tự ẩn thay vì hiện thông báo lỗi.
export default function useInterestedJobs({ selectedCategories, selectedLocations }) {
  const { isAuthenticated, user } = useSession()
  const isCandidate = isAuthenticated && user?.role === 'candidate'
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const categoryKey = selectedCategories.join(',')
  const locationKey = selectedLocations.join(',')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      let preference = null
      if (isCandidate) {
        try {
          preference = await getCandidateJobPreferences()
        } catch {
          // Không đọc được nhu cầu -> rơi về bộ lọc trên URL như khách.
        }
      }
      const tiers = buildInterestedJobTiers({
        preference,
        selectedCategories: categoryKey ? categoryKey.split(',') : [],
        selectedLocations: locationKey ? locationKey.split(',') : [],
      })
      const collected = []
      const seen = new Set()
      try {
        for (const params of tiers) {
          if (collected.length >= SUGGESTION_LIMIT) break
          const data = await getJobs(params)
          for (const job of data.results || data) {
            if (collected.length >= SUGGESTION_LIMIT) break
            if (!seen.has(job.public_id)) {
              seen.add(job.public_id)
              collected.push(job)
            }
          }
        }
      } catch {
        // Giữ những gì đã gom được; rỗng thì khối gợi ý tự ẩn.
      }
      if (!cancelled) {
        setJobs(collected)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isCandidate, categoryKey, locationKey])

  return { jobs, loading }
}
