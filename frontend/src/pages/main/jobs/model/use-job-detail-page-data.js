import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getJobDetail, getJobs, jobDetailPath, jobKeys } from '@/entities/job'
import { useJobView } from '@/features/track-job-engagement'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'

const RELATED_PAGE_SIZE = 4

function plainText(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function useJobDetailPageData({ slug, companySlug, navigate }) {
  const queryClient = useQueryClient()

  const jobQuery = useQuery({
    queryKey: jobKeys.detail(slug),
    queryFn: () => getJobDetail(slug),
  })
  const job = jobQuery.data ?? null

  const relatedQuery = useQuery({
    queryKey: jobKeys.list({ category: job?.category, page_size: RELATED_PAGE_SIZE }),
    queryFn: () => getJobs({ category: job.category, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(job?.category),
    select: (data) => {
      const items = Array.isArray(data) ? data : data.results || []
      return items.filter((item) => item.public_id !== job?.public_id).slice(0, 3)
    },
  })

  useDocumentMetadata(
    job
      ? {
          title: `Tuyển ${job.title}`,
          description: `Tuyển ${job.title} tại ${job.company_name}. ${plainText(job.short_description || job.description)}`,
          canonicalPath: jobDetailPath(job),
          imageUrl: job.company_logo_url,
          pageType: 'website',
        }
      : null,
  )

  useEffect(() => {
    if (!job) return
    const canonical = jobDetailPath(job)
    const current = companySlug ? `/brand/${companySlug}/tuyen-dung/${slug}` : `/viec-lam/${slug}`
    if (current !== canonical) navigate(canonical, { replace: true })
  }, [job, companySlug, slug, navigate])

  useJobView(job?.slug, {
    onTracked: (result) => {
      if (typeof result?.view_count !== 'number') return
      queryClient.setQueryData(jobKeys.detail(slug), (current) =>
        current ? { ...current, view_count: result.view_count } : current)
    },
  })

  return {
    job,
    relatedJobs: relatedQuery.data ?? [],
    loading: jobQuery.isLoading,
    notFound: jobQuery.isError,
  }
}
