import {
  ReloadOutlined,
  RobotOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Tag } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { ProcvMascot } from '@/shared/ui/mascot'
import {
  cancelJobAiGeneration,
  createJobAiGeneration,
  getJobAiGeneration,
} from '../api/job-ai-generation.api'
import {
  buildGenerationPayload,
  getGenerationListFieldError,
  getGenerationPhaseCopy,
  isGenerationActive,
} from '../model/generation'
import { GuidedBriefFields, PastedJdField } from './GenerationInputFields'
import { m } from '@/shared/config/i18n'

const generationKey = (publicId) => ['job-ai-generation', publicId]
const WARNING_COPY = {
  benefits_without_source_removed: m.employer_job_ai_warning_benefits_removed,
  invalid_employment_type_removed: m.employer_job_ai_warning_employment_type_removed,
  invalid_experience_years_removed: m.employer_job_ai_warning_experience_removed,
  invalid_position_level_removed: m.employer_job_ai_warning_position_level_removed,
  invalid_education_level_removed: m.employer_job_ai_warning_education_removed,
  unresolved_taxonomy_suggestions: m.employer_job_ai_warning_unresolved_taxonomy,
}
const GENERATION_ERROR_COPY = {
  queue_timeout: m.employer_job_ai_error_queue_timeout,
  stale_lease_expired: m.employer_job_ai_error_stale_lease,
  generation_timeout: m.employer_job_ai_error_generation_timeout,
  provider_timeout: m.employer_job_ai_error_provider_timeout,
  rate_limited: m.employer_job_ai_error_rate_limited,
  content_blocked: m.employer_job_ai_error_content_blocked,
  invalid_ai_schema: m.employer_job_ai_error_invalid_schema,
}

function warningCopy(warning) {
  return (WARNING_COPY[warning] || m.employer_job_ai_warning_fallback)()
}

function generationErrorCopy(errorCode) {
  return (GENERATION_ERROR_COPY[errorCode] || m.employer_job_ai_error_fallback)()
}

function GenerationProgress({ generation, hasError = false }) {
  const failed = hasError || generation?.status === 'failed'
  const cancelled = generation?.status === 'cancelled'
  const active = !failed && isGenerationActive(generation)
  const phaseLabel = getGenerationPhaseCopy(generation?.phase, generation?.status)
  const title = failed
    ? m.employer_job_ai_title_failed()
    : cancelled
      ? m.employer_job_ai_title_cancelled()
      : m.employer_job_ai_title_create()
  const palette = failed
    ? 'border-rose-200 bg-rose-50/70'
    : cancelled
      ? 'border-amber-200 bg-amber-50/70'
      : 'border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)]'

  return (
    <div className={`flex min-w-0 flex-col items-center gap-4 rounded-xl border p-5 text-center sm:flex-row sm:text-left ${palette}`}>
      <ProcvMascot
        blink
        emotion={failed ? 'error' : 'thinking'}
        float={active}
        pose="checklist"
        shadow="ground"
        size={88}
        talking={active}
      />
      <div className="min-w-0 flex-1" aria-live="polite" role="status">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {active && <RobotOutlined aria-hidden="true" className="text-[var(--brand-primary)]" />}
          <h1 className="break-words text-xl font-bold text-slate-900">{title}</h1>
        </div>
        <p className="mt-1 break-words text-sm text-slate-600">
          {active
            ? m.employer_job_ai_active_hint({ phase: phaseLabel })
            : failed
              ? m.employer_job_ai_failed_hint()
              : m.employer_job_ai_cancelled_hint()}
        </p>
      </div>
    </div>
  )
}

export default function AiJobGenerationPanel({
  draft,
  generationPublicId,
  mode,
  onChooseAnother,
  onDraftChange,
  onGenerationChange,
  onSuggestionReady,
  onUseManual,
}) {
  const queryClient = useQueryClient()
  const [createdGeneration, setCreatedGeneration] = useState(null)
  const appliedGenerationRef = useRef(null)
  const generationQuery = useQuery({
    queryKey: generationKey(generationPublicId),
    queryFn: () => getJobAiGeneration(generationPublicId),
    enabled: Boolean(generationPublicId),
    retry: false,
    refetchInterval: (query) => (isGenerationActive(query.state.data) ? 1500 : false),
  })
  const generation = generationQuery.data
    || (createdGeneration?.public_id === generationPublicId ? createdGeneration : null)
  const listErrors = useMemo(() => (
    mode === 'ai_brief'
      ? ['responsibilities', 'requirements', 'preferred_skills'].map((field) => getGenerationListFieldError(draft[field])).filter(Boolean)
      : []
  ), [draft, mode])
  const canGenerate = mode === 'jd_text'
    ? Boolean(draft.source_text?.trim())
    : Boolean(draft.position?.trim()) && listErrors.length === 0

  const createMutation = useMutation({
    mutationFn: () => createJobAiGeneration(buildGenerationPayload(mode, draft)),
    onSuccess: (result) => {
      setCreatedGeneration(result)
      onGenerationChange(result.public_id)
    },
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelJobAiGeneration(generationPublicId),
    onSuccess: (result) => {
      setCreatedGeneration(result)
      queryClient.setQueryData(generationKey(generationPublicId), result)
    },
  })
  useEffect(() => {
    if (
      generation?.status !== 'completed'
      || !generation.suggestion
      || appliedGenerationRef.current === generation.public_id
    ) return

    appliedGenerationRef.current = generation.public_id
    onSuggestionReady(generation)
  }, [generation, onSuggestionReady])

  function generate() {
    if (!canGenerate || createMutation.isPending) return
    appliedGenerationRef.current = null
    setCreatedGeneration(null)
    createMutation.mutate()
  }

  async function leaveGeneration(callback, completedGeneration = null) {
    if (generationPublicId && isGenerationActive(generation)) {
      try {
        await cancelMutation.mutateAsync()
      } catch {
        // Manual editing must remain available even when cancellation races with completion.
      }
    }
    callback(completedGeneration)
  }

  const error = createMutation.error || generationQuery.error || cancelMutation.error
  const terminalFailure = ['failed', 'cancelled'].includes(generation?.status) || Boolean(error)

  if (generation?.status === 'completed' && generation.suggestion) return null

  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label={m.employer_job_ai_panel_aria()}>
      {!generationPublicId && !createMutation.isPending && (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color="green">{m.employer_job_ai_tag()}</Tag>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {mode === 'ai_brief' ? m.employer_job_ai_mode_brief() : m.employer_job_ai_mode_jd()}
              </span>
            </div>
            <h1 className="mt-2 break-words text-xl font-bold text-slate-900">{m.employer_job_ai_title_create()}</h1>
            <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-slate-600">
              {m.employer_job_ai_disclaimer()}
            </p>
          </div>
          <Button
            className="!self-start"
            loading={cancelMutation.isPending}
            onClick={() => leaveGeneration(onChooseAnother)}
          >
            {m.employer_job_ai_change_mode()}
          </Button>
        </div>
      )}

      {!generationPublicId && !createMutation.isPending && (
        <Form layout="vertical" onFinish={generate}>
          {mode === 'ai_brief'
            ? <GuidedBriefFields draft={draft} onDraftChange={onDraftChange} />
            : <PastedJdField draft={draft} onDraftChange={onDraftChange} />}
          {createMutation.error && (
            <div className="mb-4 space-y-3">
              <GenerationProgress generation={{ status: 'failed', phase: 'failed' }} hasError />
              <Alert
                type="error"
                showIcon
                title={m.employer_job_ai_title_failed()}
                description={getApiErrorMessage(createMutation.error, m.employer_job_ai_check_and_retry())}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => leaveGeneration(onUseManual)}>{m.employer_job_ai_switch_manual()}</Button>
            <Button type="primary" htmlType="submit" disabled={!canGenerate}>
              {m.employer_job_ai_generate()}
            </Button>
          </div>
        </Form>
      )}

      {(generationPublicId || createMutation.isPending) && (
        <>
          <GenerationProgress
            generation={generation || { status: 'queued', phase: 'queued' }}
            hasError={Boolean(error)}
          />
          {error && (
            <Alert
              type="error"
              showIcon
              title={m.employer_job_ai_update_failed()}
              description={getApiErrorMessage(error, m.employer_job_ai_retry_or_manual())}
            />
          )}
          {generation?.status === 'failed' && (
            <Alert
              type="error"
              showIcon
              title={m.employer_job_ai_title_failed()}
              description={generationErrorCopy(generation.error_code)}
            />
          )}
          {generation?.warnings?.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={m.employer_job_ai_review_needed()}
              description={<ul className="list-disc pl-5">{generation.warnings.map((warning) => <li key={warning}>{warningCopy(warning)}</li>)}</ul>}
            />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {isGenerationActive(generation) && (
              <Button
                danger
                icon={<StopOutlined aria-hidden="true" />}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {m.employer_job_ai_cancel_generation()}
              </Button>
            )}
            {terminalFailure && (
              <Button
                icon={<ReloadOutlined aria-hidden="true" />}
                loading={createMutation.isPending}
                disabled={!canGenerate}
                onClick={generate}
              >
                {m.employer_job_ai_retry()}
              </Button>
            )}
            {generation?.status !== 'completed' && (
              <Button
                loading={cancelMutation.isPending}
                onClick={() => leaveGeneration(onUseManual)}
              >
                {m.employer_job_ai_switch_manual()}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
