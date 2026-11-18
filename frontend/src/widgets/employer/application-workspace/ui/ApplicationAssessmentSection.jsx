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

/** Private note and rating; mount with `key={public_id}` to reset per application. */
export default function ApplicationAssessmentSection({ application }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState(application.employer_note || '')
  const [rating, setRating] = useState(application.employer_rating || null)
  const dirty = note !== (application.employer_note || '') || rating !== (application.employer_rating || null)

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
      message.success('Đã lưu đánh giá nội bộ.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu đánh giá.')),
  })

  return (
    <section className="aw-section space-y-3">
      <div>
        <h3 className="aw-section__title !mb-1">Đánh giá nội bộ</h3>
        <p className="text-[11px] leading-5 text-slate-400">Chỉ tài khoản nhà tuyển dụng của bạn nhìn thấy.</p>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold text-slate-500">Mức độ phù hợp</p>
        <Rate aria-label="Mức độ phù hợp của ứng viên" value={rating || 0} onChange={setRating} />
      </div>
      <Input.TextArea
        aria-label="Ghi chú nội bộ"
        value={note}
        rows={4}
        maxLength={5000}
        showCount
        placeholder="Ghi lại điểm mạnh, điều cần xác minh hoặc bước tiếp theo..."
        onChange={(event) => setNote(event.target.value)}
      />
      <Button block type="primary" loading={saveMutation.isPending} disabled={!dirty} onClick={() => saveMutation.mutate()}>
        Lưu đánh giá
      </Button>
    </section>
  )
}
