import { SendOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import InterviewStepFields from './InterviewStepFields'

/**
 * Ô soạn câu trả lời. Dùng cả ở đáy hội thoại (lượt đang hỏi) lẫn ngay tại chỗ
 * khi ứng viên bấm "Sửa" một đáp án cũ — lúc đó có thêm nút "Huỷ".
 */
export default function ChatComposer({
  busy,
  catalog,
  onCancel,
  onQuickAnswer,
  onSend,
  sendLabel = 'Gửi',
  setField,
  step,
  values,
}) {
  return (
    <div className="space-y-3">
      <InterviewStepFields
        catalog={catalog}
        onQuickAnswer={onQuickAnswer}
        onSend={onSend}
        setField={setField}
        stepId={step.id}
        values={values}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">{step.hint}</p>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {onCancel && (
            <Button
              onClick={onCancel}
              className="!h-10 !rounded-full !px-4 !font-medium !text-slate-500"
              type="text"
            >
              Huỷ
            </Button>
          )}
          <Button
            type="primary"
            // Icon chỉ trang trí: ẩn khỏi cây a11y để tên nút là "Gửi" chứ
            // không phải "send Gửi".
            icon={<SendOutlined aria-hidden="true" />}
            loading={busy}
            disabled={catalog.loading && step.needsCatalog}
            onClick={() => onSend()}
            className="!h-10 !rounded-full !border-emerald-700 !bg-emerald-600 !px-6 !font-semibold hover:!bg-emerald-700"
          >
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
