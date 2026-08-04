import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { jobPreferenceFieldErrors, saveJobPreferences, useJobPreferenceCatalog } from '@/features/configure-job-preferences'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { candidateName, ERROR_SPEECH, INTERVIEW_STEPS, resolveSpeech } from '../model/interview-script'
import { useOnboardingVoice } from '../model/onboarding-voice-context'
import { useInterviewFlow } from '../model/use-interview-flow'
import InterviewMascot from './InterviewMascot'
import InterviewStepFields from './InterviewStepFields'
import '../onboarding-interview.css'

/** Robot phản ứng theo tình huống thay vì chỉ đứng yên đọc. */
function mascotState({ celebrating, saving, showError, speaking }) {
  if (saving) return { emotion: 'thinking', pose: 'checklist' }
  if (showError) return { emotion: 'error', pose: 'checklist' }
  if (celebrating) return { emotion: 'success', pose: 'checklist' }
  if (speaking) return { emotion: 'happy', pose: 'microphone' }
  return { emotion: 'neutral', pose: 'checklist' }
}

/**
 * Cuộc phỏng vấn onboarding: robot hỏi từng câu, ứng viên trả lời một ý mỗi
 * bước. Vẫn là đúng bộ trường của form một trang cũ, chỉ khác cách hỏi.
 */
export default function OnboardingInterview({ onSaved, onSkip, preference, user }) {
  const catalog = useJobPreferenceCatalog()
  const voice = useOnboardingVoice()

  const flow = useInterviewFlow({
    preference,
    onSubmit: async (values) => {
      try {
        onSaved(await saveJobPreferences(values, preference))
        return null
      } catch (error) {
        const [fieldError] = jobPreferenceFieldErrors(error)
        voice.replay('save-error', ERROR_SPEECH)
        message.error(fieldError
          ? `Chưa thể cập nhật trường “${fieldError.label}”. ${fieldError.errors[0]}`
          : getApiErrorMessage(error, 'Không thể cập nhật nhu cầu công việc. Vui lòng thử lại.'))
        return fieldError?.name ?? null
      }
    },
  })

  const { step } = flow
  const nagging = flow.showError && Boolean(step.retrySpeech)
  const speech = nagging ? step.retrySpeech : resolveSpeech(step.speech, { name: candidateName(user) })
  const mascot = mascotState({
    celebrating: flow.celebrating,
    saving: flow.saving,
    showError: flow.showError,
    speaking: voice.speaking,
  })

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      <InterviewMascot
        emotion={mascot.emotion}
        float
        pose={mascot.pose}
        speech={speech}
        speechId={nagging ? `retry-${step.id}` : `step-${step.id}`}
      />

      <div className="mt-5 rounded-2xl bg-white px-4 py-5 shadow-xl shadow-emerald-950/15 sm:px-8 sm:py-7">
        <div className="mb-4 flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold text-slate-500">
            Câu {flow.index + 1}/{flow.total}
          </span>
          <div className="flex flex-1 gap-1.5" aria-hidden="true">
            {INTERVIEW_STEPS.map((item, position) => (
              <span
                key={item.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${position <= flow.index ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-semibold text-emerald-700">{step.label}</span>
        </div>

        <div key={step.id} className="onboarding-step">
          <InterviewStepFields
            catalog={catalog}
            setField={flow.setField}
            stepId={step.id}
            values={flow.values}
          />
          <p className={`mt-2.5 text-xs ${flow.showError ? 'font-medium text-red-500' : 'text-slate-500'}`}>
            {flow.showError ? flow.error : step.hint}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            size="large"
            icon={<ArrowLeftOutlined />}
            disabled={flow.index === 0 || flow.saving}
            onClick={flow.back}
            className="!h-11 !rounded-full !px-6 !font-medium"
          >
            Quay lại
          </Button>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
            <Button
              size="large"
              type="text"
              onClick={onSkip}
              disabled={flow.saving}
              className="!h-11 !rounded-full !px-5 !font-medium !text-slate-500 hover:!text-slate-700"
            >
              Tôi sẽ hoàn thiện sau
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              loading={flow.saving}
              disabled={catalog.loading && step.needsCatalog}
              onClick={flow.next}
              className="!h-11 !rounded-full !border-emerald-700 !bg-emerald-600 !px-10 !font-semibold hover:!bg-emerald-700"
            >
              {flow.isLast ? 'Hoàn thành' : 'Tiếp tục'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
