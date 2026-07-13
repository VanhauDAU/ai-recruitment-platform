import { useEffect, useState } from 'react'
import { useConsent } from '@/entities/consent'
import { getJobDetail, getJobs, jobDetailPath, recordJobView } from '@/entities/job'

export default function useJobDetailPageData({ slug, companySlug, navigate }) {
  const { consent, status: consentStatus } = useConsent()
  const [job, setJob] = useState(null)
  const [relatedJobs, setRelatedJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setJob(null)
    getJobDetail(slug)
      .then((data) => { if (!cancelled) setJob(data) })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!job?.title) return undefined
    const previousTitle = document.title
    document.title = `Tuyển ${job.title}`
    return () => { document.title = previousTitle }
  }, [job?.title])

  useEffect(() => {
    if (!job) return
    const canonical = jobDetailPath(job)
    const current = companySlug ? `/brand/${companySlug}/tuyen-dung/${slug}` : `/viec-lam/${slug}`
    if (current !== canonical) navigate(canonical, { replace: true })
  }, [job, companySlug, slug, navigate])

  useEffect(() => {
    if (consentStatus !== 'ready' || !consent.analytics || !job?.slug) return undefined
    let cancelled = false
    recordJobView(job.slug)
      .then((result) => {
        if (!cancelled && typeof result?.view_count === 'number') {
          setJob((current) => (current ? { ...current, view_count: result.view_count } : current))
        }
      })
      // Tracking is progressive enhancement: never make the job detail fail.
      .catch(() => {})
    return () => { cancelled = true }
  }, [consent.analytics, consentStatus, job?.slug])

  useEffect(() => {
    if (!job?.category) {
      setRelatedJobs([])
      return undefined
    }
    let cancelled = false
    getJobs({ category: job.category, page_size: 4 })
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data) ? data : data.results || []
        setRelatedJobs(items.filter((item) => item.public_id !== job.public_id).slice(0, 3))
      })
      .catch(() => { if (!cancelled) setRelatedJobs([]) })
    return () => { cancelled = true }
  }, [job?.category, job?.public_id])

  return { job, relatedJobs, loading, notFound }
}
