import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { createCampaign, getCampaignOptions, campaignKeys } from '@/entities/campaign/campaign'
import { useSession } from '@/entities/account/session'
import {
  getEmployerJob,
  getJobCategories,
  getJobPostingContext,
  createSkill,
  jobKeys,
  publishEmployerJob,
  saveEmployerJob,
} from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { EmployerJobEditor } from '@/widgets/employer/job-editor'
import JobVisibilityHoldAlert from './JobVisibilityHoldAlert'
import { m } from '@/shared/config/i18n'

// The backend refuses publication with machine-readable reasons; show their
// labels instead of the generic "cannot publish" detail.
function jobMutationErrorMessage(error, fallback) {
  const data = error?.response?.data
  if (data?.code === 'JOB_PUBLICATION_BLOCKED' && Array.isArray(data.blocked_reasons)) {
    const reasons = data.blocked_reasons.map((item) => item.label).filter(Boolean).join(' ')
    return reasons ? m.employer_job_edit_publish_blocked_reasons({ reasons }) : m.employer_job_edit_publish_blocked()
  }
  return getApiErrorMessage(error, fallback)
}

export default function JobForm() {
  const { publicId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const returnToSetup = searchParams.get('return') === 'setup'
  const detailQuery = useQuery({ queryKey: jobKeys.employerDetail(publicId), queryFn: () => getEmployerJob(publicId), enabled: Boolean(publicId) })
  const categoriesQuery = useQuery({ queryKey: jobKeys.categories, queryFn: () => getJobCategories() })
  const campaignsQuery = useQuery({ queryKey: campaignKeys.options, queryFn: getCampaignOptions })
  const postingContextQuery = useQuery({ queryKey: jobKeys.postingContext, queryFn: getJobPostingContext })
  const quickCampaignMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (campaign) => {
      queryClient.setQueryData(campaignKeys.options, (current = []) => [campaign, ...current])
      queryClient.invalidateQueries({ queryKey: campaignKeys.all })
      message.success(m.employer_job_edit_campaign_created())
    },
  })
  const draftMutation = useMutation({
    mutationFn: (payload) => saveEmployerJob(payload, publicId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(job.status === 'draft' ? m.employer_job_edit_draft_saved() : m.employer_job_edit_changes_saved())
      // Opened from the campaign setup wizard: go back to its job step.
      if (returnToSetup && job.campaign) {
        navigate(employerAppPath(`/campaigns/${job.campaign}/setup?step=jobs`))
        return
      }
      navigate(employerAppPath(`/jobs/${job.public_id}/edit`), { replace: true })
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, m.employer_job_edit_draft_save_failed()),
      { duration: 5000, id: 'post-job-draft-error' },
    ),
  })
  const publishMutation = useMutation({
    mutationFn: ({ payload, acceptedStatementVersion }) => (
      publishEmployerJob(payload, publicId, acceptedStatementVersion)
    ),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      message.success(
        !publicId || detailQuery.data?.status === 'draft'
          ? m.employer_job_edit_published()
          : m.employer_job_edit_updated(),
      )
      navigate(employerAppPath(`/jobs/${job.public_id}`))
    },
    onError: (error) => message.error(
      jobMutationErrorMessage(error, m.employer_job_edit_publish_failed()),
      { duration: 5000, id: 'post-job-submit-error' },
    ),
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
  const submitLabel = isDraft ? m.employer_job_form_post() : m.employer_job_form_save_and_update()
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
  const withAiAttribution = (payload, aiGenerationPublicId) => (
    !publicId && aiGenerationPublicId
      ? { ...payload, ai_generation_public_id: aiGenerationPublicId }
      : payload
  )
  if (detailQuery.isLoading || postingContextQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 12 }} />
  }
  if (detailQuery.isError) return <Alert type="error" showIcon title={m.employer_job_edit_load_failed()} />
  // The backend refuses edits while a job is held, except for requested changes.
  const hold = detailQuery.data?.visibility_hold
  if (hold && !hold.editable) {
    return (
      <section className="mx-auto max-w-[1480px] space-y-4">
        <JobVisibilityHoldAlert hold={detailQuery.data.visibility_hold} />
        <Link className="inline-block text-sm font-semibold" to={employerAppPath(`/jobs/${publicId}`)}>
          {m.employer_job_edit_back_to_detail()}
        </Link>
      </section>
    )
  }
  return (
    <section className="mx-auto max-w-[1480px] space-y-5">
      <JobVisibilityHoldAlert hold={hold} />

      {(categoriesQuery.isError || campaignsQuery.isError || postingContextQuery.isError) && (
        <Alert type="warning" showIcon title={m.employer_job_edit_catalogs_failed()} description={m.employer_job_edit_catalogs_failed_hint()} />
      )}
      <EmployerJobEditor
        initialValues={initialValues}
        isEditing={Boolean(publicId)}
        campaigns={campaignsQuery.data || []}
        categories={categoriesQuery.data || []}
        postingContext={postingContextQuery.data}
        defaultDeadlineDays={!publicId
          ? postingContextQuery.data?.default_deadline_days ?? 30
          : null}
        maxDeadlineDays={postingContextQuery.data?.max_deadline_days ?? 90}
        isDraft={isDraft}
        requiresNewCredit={requiresNewCredit}
        submitLabel={submitLabel}
        submitting={draftMutation.isPending || publishMutation.isPending}
        savedAt={draftMutation.isSuccess ? draftMutation.submittedAt : 0}
        errorMessage={mutationError ? jobMutationErrorMessage(mutationError, m.employer_job_edit_save_failed()) : ''}
        creatingCampaign={quickCampaignMutation.isPending}
        onCreateCampaign={(name) => quickCampaignMutation.mutateAsync({ name, activate: true })}
        onCreateSkill={(name) => createSkillMutation.mutateAsync(name)}
        onSaveDraft={(payload, aiGenerationPublicId) => draftMutation.mutate(withAiAttribution(payload, aiGenerationPublicId))}
        onPublish={(payload, aiGenerationPublicId, acceptedStatementVersion) => publishMutation.mutate({
          payload: withAiAttribution(payload, aiGenerationPublicId),
          acceptedStatementVersion,
        })}
      />
    </section>
  )
}
