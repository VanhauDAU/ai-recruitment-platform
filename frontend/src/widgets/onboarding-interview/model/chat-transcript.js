import {
  answerSummary,
  buildReadyMessage,
  greetingMessage,
  INTERVIEW_STEPS,
  SAVING_MESSAGE,
  START_REPLY,
} from './interview-script'

/**
 * Lịch sử hội thoại được suy ra từ trạng thái, không lưu riêng: sửa một đáp án
 * là bong bóng tương ứng đổi theo, và không có tin nhắn nào biến mất giữa chừng.
 *
 * Mỗi tin nhắn có `id` cố định để React giữ đúng identity khi dựng lại lịch sử.
 */
export function buildTranscript({ catalog, failure, index, nagged = {}, phase, savedPreference, user, values }) {
  const items = [{ id: 'greeting', role: 'bot', text: greetingMessage(user) }]
  if (phase === 'greeting') return items

  items.push({ id: 'start', role: 'user', text: START_REPLY })

  const asking = phase === 'asking'
  const asked = asking ? index + 1 : INTERVIEW_STEPS.length

  INTERVIEW_STEPS.slice(0, asked).forEach((step, position) => {
    items.push({ id: `ask-${step.id}`, role: 'bot', text: step.question })
    if (nagged[step.id]) items.push({ id: `nag-${step.id}`, role: 'bot', text: nagged[step.id] })
    if (!asking || position < index) {
      items.push({
        id: `answer-${step.id}`,
        role: 'user',
        stepId: step.id,
        text: answerSummary(step, values, catalog),
      })
    }
  })

  if (asking) return items

  items.push({ id: 'saving', role: 'bot', kind: 'saving', text: SAVING_MESSAGE })
  if (phase === 'retry' && failure) {
    items.push({ id: `failure-${failure.stepId}`, role: 'bot', text: failure.text })
  }
  if (phase === 'ready') {
    items.push({ id: 'ready', role: 'bot', kind: 'ready', text: buildReadyMessage(savedPreference, user) })
  }
  return items
}
