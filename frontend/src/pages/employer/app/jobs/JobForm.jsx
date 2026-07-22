import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Skeleton, message } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCampaignOptions, campaignKeys } from '@/entities/campaign'
import { useSession } from '@/entities/session'
import {
  getEmployerJob,
  getJobCategories,
  getJobPostingContext,
  createSkill,
  jobKeys,
  publishEmployerJob,
  saveEmployerJob,
} from '@/entities/job'
import { PostJobForm } from '@/features/post-job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

export default function JobForm() {
  const { publicId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const detailQuery = useQuery({ queryKey: jobKeys.employerDetail(publicId), queryFn: () => getEmployerJob(publicId), enabled: Boolean(publicId) })
  const categoriesQuery = useQuery({ queryKey: jobKeys.categories, queryFn: () => getJobCategories() })
  const campaignsQuery = useQuery({ queryKey: campaignKeys.options, queryFn: getCampaignOptions })
  const postingContextQuery = useQuery({ queryKey: jobKeys.postingContext, queryFn: getJobPostingContext })
  const draftMutation = useMutation({
    mutationFn: (payload) => saveEmployerJob(payload, publicId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(job.status === 'draft' ? 'Đã lưu nháp.' : 'Đã lưu thay đổi.')
      navigate(`/tuyendung/app/jobs/${job.public_id}/edit`, { replace: true })
    },
  })
  const publishMutation = useMutation({
    mutationFn: (payload) => publishEmployerJob(payload, publicId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(
        job.status === 'pending'
          ? 'Đã gửi tin để quản trị viên duyệt.'
          : 'Đã cập nhật tin tuyển dụng.',
      )
      navigate(`/tuyendung/app/jobs/${job.public_id}`)
    },
  })
  const createSkillMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: (skill) => {
      queryClient.setQueryData(jobKeys.skills, (current = []) => {
        if (current.some((item) => item.id === skill.id)) return current
        return [...current, skill].sort((left, right) => left.name.localeCompare(right.name, 'vi'))
      })
    },
  })
  const currentStatus = detailQuery.data?.status
  const isDraft = !publicId || currentStatus === 'draft'
  const requiresNewCredit = !publicId || currentStatus === 'draft'
  const submitLabel = !publicId || currentStatus === 'draft'
    ? 'Gửi duyệt tin'
    : currentStatus === 'rejected'
      ? 'Gửi duyệt lại'
      : currentStatus === 'active'
        ? 'Cập nhật và gửi duyệt lại'
        : 'Cập nhật tin chờ duyệt'
  const campaignFromUrl = searchParams.get('campaign')
  const initialValues = useMemo(() => {
    if (detailQuery.data) return detailQuery.data
    return {
      campaign: campaignFromUrl || undefined,
      application_contact: {
        recipient_name: user?.full_name || '',
        phone: user?.phone || '',
        emails: user?.email ? [{ email: user.email }] : [],
      },
    }
  }, [campaignFromUrl, detailQuery.data, user?.email, user?.full_name, user?.phone])
  const mutationError = draftMutation.error || publishMutation.error
  if (detailQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />
  if (detailQuery.isError) return <Alert type="error" showIcon title="Không thể tải tin tuyển dụng." />
  return (
    <section className="mx-auto max-w-[1480px] space-y-5">

      {(categoriesQuery.isError || campaignsQuery.isError || postingContextQuery.isError) && (
        <Alert type="warning" showIcon title="Một số danh mục chưa tải được" description="Bạn có thể tải lại trang để lấy đầy đủ vị trí chuyên môn và chiến dịch." />
      )}
      <PostJobForm
        initialValues={initialValues}
        campaigns={campaignsQuery.data || []}
        categories={categoriesQuery.data || []}
        postingContext={postingContextQuery.data}
        isDraft={isDraft}
        requiresNewCredit={requiresNewCredit}
        submitLabel={submitLabel}
        submitting={draftMutation.isPending || publishMutation.isPending}
        errorMessage={mutationError ? getApiErrorMessage(mutationError, 'Không thể lưu tin tuyển dụng.') : ''}
        onCreateSkill={(name) => createSkillMutation.mutateAsync(name)}
        onSaveDraft={(payload) => draftMutation.mutate(payload)}
        onPublish={(payload) => publishMutation.mutate(payload)}
      />
    </section>
  )
}
