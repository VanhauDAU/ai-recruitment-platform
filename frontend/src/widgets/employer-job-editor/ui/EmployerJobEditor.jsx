import { Form } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AI_JOB_MODES, AiJobGenerationPanel } from '@/features/generate-job-post'
import { createJobFormValues, PostJobForm } from '@/features/post-job'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import JobCreationModeChooser from './JobCreationModeChooser'

const EMPTY_DRAFTS = {
  ai_brief: {
    position: '',
    position_level: undefined,
    employment_type: undefined,
    work_types: [],
    responsibilities: '',
    requirements: '',
    preferred_skills: '',
    notes: '',
  },
  jd_text: { source_text: '' },
}

export default function EmployerJobEditor({
  initialValues,
  isEditing = false,
  onPublish,
  onSaveDraft,
  ...formProps
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [form] = Form.useForm()
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS)
  const [generatedResult, setGeneratedResult] = useState(null)
  const [formDirty, setFormDirty] = useState(false)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const requestedMode = searchParams.get('mode')
  const mode = isEditing
    ? 'manual'
    : requestedMode === 'manual' || AI_JOB_MODES.has(requestedMode)
      ? requestedMode
      : null
  const generationPublicId = isEditing ? null : searchParams.get('generation')
  const showsForm = mode === 'manual' || generatedResult?.status === 'completed'
  const attributedGenerationId = generatedResult?.status === 'completed'
    ? generatedResult.public_id
    : null

  const setUrlState = useCallback((updates) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const chooseMode = useCallback((nextMode) => {
    setGeneratedResult(null)
    setFormDirty(false)
    setUrlState({ mode: nextMode, generation: null })
  }, [setUrlState])

  const returnToChooser = useCallback(() => {
    const reset = () => {
      form.resetFields()
      form.setFieldsValue(createJobFormValues(initialValues))
      setGeneratedResult(null)
      setFormDirty(false)
      setUrlState({ mode: null, generation: null })
    }

    if (!formDirty && !generatedResult) {
      setUrlState({ mode: null, generation: null })
      return
    }

    requestConfirmation({
      title: 'Đổi cách tạo tin',
      description: 'Nội dung đang có trong form sẽ được đặt lại. Brief hoặc JD bạn đã nhập vẫn được giữ trong phiên này.',
      confirmText: 'Đổi cách tạo',
      cancelText: 'Tiếp tục chỉnh sửa',
      onConfirm: reset,
    })
  }, [form, formDirty, generatedResult, initialValues, requestConfirmation, setUrlState])

  const handleSuggestionReady = useCallback((generation) => {
    setGeneratedResult((current) => (
      current?.public_id === generation.public_id ? current : generation
    ))
  }, [])

  const useManual = useCallback((generation) => {
    const completedGeneration = generation?.status === 'completed' ? generation : null
    setGeneratedResult(completedGeneration)
    setUrlState({
      mode: 'manual',
      generation: completedGeneration?.public_id || null,
    })
  }, [setUrlState])

  const currentDraft = useMemo(() => drafts[mode] || EMPTY_DRAFTS.ai_brief, [drafts, mode])
  const updateCurrentDraft = useCallback((nextDraft) => {
    setDrafts((current) => ({ ...current, [mode]: nextDraft }))
  }, [mode])

  return (
    <div className="min-w-0 space-y-4">
      {!mode && <JobCreationModeChooser onChoose={chooseMode} />}

      {AI_JOB_MODES.has(mode) && generatedResult?.status !== 'completed' && (
        <AiJobGenerationPanel
          draft={currentDraft}
          generationPublicId={generationPublicId}
          mode={mode}
          onChooseAnother={returnToChooser}
          onDraftChange={updateCurrentDraft}
          onGenerationChange={(publicId) => setUrlState({ generation: publicId })}
          onSuggestionReady={handleSuggestionReady}
          onUseManual={useManual}
        />
      )}

      {showsForm && (
        <PostJobForm
          {...formProps}
          aiSuggestion={generatedResult?.suggestion}
          aiSuggestionKey={generatedResult?.public_id}
          form={form}
          initialValues={initialValues}
          onAiSuggestionApplied={() => setFormDirty(false)}
          onValuesChange={() => setFormDirty(true)}
          onSaveDraft={(payload) => onSaveDraft(payload, attributedGenerationId)}
          onPublish={(payload) => onPublish(payload, attributedGenerationId)}
        />
      )}

      {confirmationModal}
    </div>
  )
}
