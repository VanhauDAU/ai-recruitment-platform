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

const generationKey = (publicId) => ['job-ai-generation', publicId]
const WARNING_COPY = {
  benefits_without_source_removed: 'AI đã loại quyền lợi không có căn cứ từ JD hoặc hồ sơ công ty đã duyệt.',
  invalid_employment_type_removed: 'Loại công việc gợi ý không hợp lệ đã được loại bỏ.',
  invalid_experience_years_removed: 'Mức kinh nghiệm gợi ý không hợp lệ đã được loại bỏ.',
  invalid_position_level_removed: 'Cấp bậc gợi ý không hợp lệ đã được loại bỏ.',
  invalid_education_level_removed: 'Trình độ học vấn gợi ý không hợp lệ đã được loại bỏ.',
  unresolved_taxonomy_suggestions: 'Một số danh mục, kỹ năng hoặc quyền lợi cần được chọn lại trong form.',
}
const GENERATION_ERROR_COPY = {
  queue_timeout: 'Hàng chờ đang quá tải. Brief vẫn được giữ để bạn thử lại sau ít phút.',
  stale_lease_expired: 'Tiến trình tạo nội dung bị gián đoạn. Bạn có thể thử lại mà không cần nhập lại brief.',
  generation_timeout: 'AI mất quá nhiều thời gian để phản hồi. Vui lòng thử lại với brief ngắn gọn hơn.',
  provider_timeout: 'Dịch vụ AI phản hồi quá chậm. Vui lòng thử lại sau ít phút.',
  rate_limited: 'Dịch vụ AI đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
  content_blocked: 'Nội dung đã bị chặn bởi chính sách an toàn. Hãy bỏ dữ liệu nhạy cảm và diễn đạt lại brief.',
  invalid_ai_schema: 'Kết quả AI chưa đạt cấu trúc yêu cầu. Vui lòng thử lại.',
}

function warningCopy(warning) {
  return WARNING_COPY[warning] || 'Một gợi ý không hợp lệ đã được loại bỏ. Vui lòng kiểm tra lại form.'
}

function generationErrorCopy(errorCode) {
  return GENERATION_ERROR_COPY[errorCode]
    || 'Hệ thống chưa thể tạo bản nháp. Brief vẫn được giữ để bạn thử lại hoặc chuyển sang nhập thủ công.'
}

function GenerationProgress({ generation, hasError = false }) {
  const failed = hasError || generation?.status === 'failed'
  const cancelled = generation?.status === 'cancelled'
  const active = !failed && isGenerationActive(generation)
  const phaseLabel = getGenerationPhaseCopy(generation?.phase, generation?.status)
  const title = failed
    ? 'Chưa thể tạo bản nháp'
    : cancelled
      ? 'Đã hủy yêu cầu'
      : 'Tạo bản nháp tin tuyển dụng'
  const palette = failed
    ? 'border-rose-200 bg-rose-50/70'
    : cancelled
      ? 'border-amber-200 bg-amber-50/70'
      : 'border-emerald-100 bg-emerald-50/50'

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
          {active && <RobotOutlined aria-hidden="true" className="text-emerald-600" />}
          <h1 className="break-words text-xl font-bold text-slate-900">{title}</h1>
        </div>
        <p className="mt-1 break-words text-sm text-slate-600">
          {active
            ? `${phaseLabel}. Bạn có thể chờ tại đây; trạng thái được cập nhật trực tiếp từ hệ thống.`
            : failed
              ? 'Bạn có thể thử lại hoặc chuyển sang nhập thủ công.'
              : 'Brief của bạn vẫn được giữ để có thể thử lại hoặc chuyển sang nhập thủ công.'}
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
    <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Tạo tin tuyển dụng bằng AI">
      {!generationPublicId && !createMutation.isPending && (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color="green">AI hỗ trợ</Tag>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {mode === 'ai_brief' ? 'Từ brief có hướng dẫn' : 'Chuẩn hóa JD có sẵn'}
              </span>
            </div>
            <h1 className="mt-2 break-words text-xl font-bold text-slate-900">Tạo bản nháp tin tuyển dụng</h1>
            <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-slate-600">
              Nội dung AI là gợi ý và không bao giờ tự lưu hoặc tự đăng. Không nhập dữ liệu ứng viên hay thông tin cá nhân nhạy cảm.
            </p>
          </div>
          <Button
            className="!self-start"
            loading={cancelMutation.isPending}
            onClick={() => leaveGeneration(onChooseAnother)}
          >
            Đổi cách tạo
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
                title="Chưa thể tạo bản nháp"
                description={getApiErrorMessage(createMutation.error, 'Vui lòng kiểm tra dữ liệu và thử lại.')}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => leaveGeneration(onUseManual)}>Chuyển sang nhập thủ công</Button>
            <Button type="primary" htmlType="submit" disabled={!canGenerate}>
              Tạo bản nháp bằng AI
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
              title="Không thể cập nhật yêu cầu AI"
              description={getApiErrorMessage(error, 'Vui lòng thử lại hoặc chuyển sang nhập thủ công.')}
            />
          )}
          {generation?.status === 'failed' && (
            <Alert
              type="error"
              showIcon
              title="Chưa thể tạo bản nháp"
              description={generationErrorCopy(generation.error_code)}
            />
          )}
          {generation?.warnings?.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="Có nội dung cần bạn kiểm tra"
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
                Hủy tạo bản nháp
              </Button>
            )}
            {terminalFailure && (
              <Button
                icon={<ReloadOutlined aria-hidden="true" />}
                loading={createMutation.isPending}
                disabled={!canGenerate}
                onClick={generate}
              >
                Thử lại
              </Button>
            )}
            {generation?.status !== 'completed' && (
              <Button
                loading={cancelMutation.isPending}
                onClick={() => leaveGeneration(onUseManual)}
              >
                Chuyển sang nhập thủ công
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
