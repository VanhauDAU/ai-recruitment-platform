import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Skeleton, message } from 'antd'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCampaignOptions, campaignKeys } from '@/entities/campaign'
import {
  getEmployerJob,
  getJobCategories,
  getJobPostingContext,
  jobKeys,
  publishEmployerJob,
  saveEmployerJob,
} from '@/entities/job'
import { PostJobForm } from '@/features/post-job'

export default function JobForm() {
  const { publicId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({ queryKey: jobKeys.employerDetail(publicId), queryFn: () => getEmployerJob(publicId), enabled: Boolean(publicId) })
  const categoriesQuery = useQuery({ queryKey: jobKeys.categories, queryFn: getJobCategories })
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
  if (detailQuery.isLoading) return <Skeleton active paragraph={{ rows: 12 }} />
  if (detailQuery.isError) return <Alert type="error" showIcon title="Không thể tải tin tuyển dụng." />
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
  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">{publicId ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}</h1><p className="mt-1 text-sm text-slate-500">Tin hợp lệ sẽ được gửi cho quản trị viên duyệt trước khi hiển thị cho ứng viên.</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><PostJobForm initialValues={detailQuery.data || (searchParams.get('campaign') ? { campaign: searchParams.get('campaign') } : undefined)} campaigns={campaignsQuery.data || []} categories={categoriesQuery.data || []} postingContext={postingContextQuery.data} isDraft={isDraft} requiresNewCredit={requiresNewCredit} submitLabel={submitLabel} submitting={draftMutation.isPending || publishMutation.isPending} onSaveDraft={(payload) => draftMutation.mutate(payload)} onPublish={(payload) => publishMutation.mutate(payload)} /></div>
    </section>
  )
}
