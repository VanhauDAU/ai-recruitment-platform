import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Rate } from 'antd'
import { useState } from 'react'
import {
  applicationKeys,
  replaceApplicationInPage,
  updateApplicationAssessment,
} from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'
import { useUnsavedChanges } from '@/shared/hooks/use-unsaved-changes'

/** Private note and rating; mount with `key={public_id}` to reset per application. */
export default function ApplicationAssessmentSection({ application }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState(application.employer_note || '')
  const [rating, setRating] = useState(application.employer_rating || null)
  const dirty = note !== (application.employer_note || '') || rating !== (application.employer_rating || null)
  useUnsavedChanges(dirty)

  const saveMutation = useMutation({
    mutationFn: () => updateApplicationAssessment(application.public_id, {
      employer_note: note,
      employer_rating: rating || null,
    }),
    onSuccess: (updated) => {
      queryClient.setQueriesData(
        { queryKey: applicationKeys.recruiterLists() },
        (page) => replaceApplicationInPage(page, updated),
      )
      message.success(m.employer_workspace_app_assessment_saved())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_app_assessment_save_error())),
  })

  return (
    <section className="aw-section space-y-3">
      <div>
        <h3 className="aw-section__title !mb-1">{m.employer_workspace_app_assessment_title()}</h3>
        <p className="text-[11px] leading-5 text-slate-400">{m.employer_workspace_app_assessment_hint()}</p>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold text-slate-500">{m.employer_workspace_app_fit()}</p>
        <Rate aria-label={m.employer_workspace_app_fit_rating()} value={rating || 0} onChange={setRating} />
      </div>
      <Input.TextArea
        aria-label={m.employer_workspace_app_internal_note()}
        value={note}
        rows={4}
        maxLength={5000}
        showCount
        placeholder={m.employer_workspace_app_internal_note_placeholder()}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button block type="primary" loading={saveMutation.isPending} disabled={!dirty} onClick={() => saveMutation.mutate()}>
        {m.employer_workspace_app_save_assessment()}
      </Button>
    </section>
  )
}
