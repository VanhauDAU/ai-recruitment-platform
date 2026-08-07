import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightOutlined, AudioMutedOutlined, CloseOutlined, RedoOutlined, SoundOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { jobPreferenceFieldErrors, saveJobPreferences, useJobPreferenceCatalog } from '@/features/configure-job-preferences'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useVisualViewportBottomInset } from '@/shared/hooks/use-visual-viewport-bottom-inset'
import { ProcvMascot } from '@/shared/ui/mascot'
import { buildTranscript } from '../model/chat-transcript'
import { START_REPLY } from '../model/interview-script'
import { useOnboardingVoice } from '../model/onboarding-voice-context'
import { useInterviewChat } from '../model/use-interview-chat'
import ChatComposer from './ChatComposer'
import ChatMessage from './ChatMessage'
import '../onboarding-interview.css'

/** Nhịp "robot đang gõ" trước mỗi lượt nói, đủ để thấy đây là hội thoại. */
const TYPING_MS = 420
/** Đếm ngược sang trang việc làm, chỉ chạy sau khi robot nói dứt câu chốt. */
const COUNTDOWN_SECONDS = 5
const ICON_BUTTON_CLASS = 'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40'

function botEmotion({ latestId, phase, speaking }) {
  if (phase === 'saving') return 'thinking'
  if (phase === 'ready') return 'success'
  if (phase === 'retry' || latestId?.startsWith('nag-')) return 'error'
  if (speaking) return 'happy'
  return 'neutral'
}

/** Giữ tin nhắn mới nhất ẩn trong lúc "đang gõ" để bong bóng bật ra thành nhịp. */
function useTypingPause(liveId, reducedMotion) {
  const [shown, setShown] = useState(null)

  useEffect(() => {
    if (!liveId || shown === liveId) return undefined
    if (reducedMotion) {
      setShown(liveId)
      return undefined
    }
    const timer = window.setTimeout(() => setShown(liveId), TYPING_MS)
    return () => window.clearTimeout(timer)
  }, [liveId, reducedMotion, shown])

  return shown === liveId
}

/**
 * Onboarding ứng viên gói trong một cuộc trò chuyện duy nhất: robot chào, hỏi
 * năm câu, chờ lọc việc rồi chốt — tất cả trên cùng một trang.
 *
 * Không còn "tiếp tục / quay lại": đáp án một lựa chọn bấm phát gửi luôn, đáp
 * án nhiều lựa chọn gửi bằng nút gửi của ô soạn, và muốn đổi ý thì bấm "Sửa"
 * ngay trên bong bóng đáp án cũ.
 */
export default function OnboardingChat({ onFinish, onSaved, onSkip, preference, user }) {
  const catalog = useJobPreferenceCatalog()
  const voice = useOnboardingVoice()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // Ẩn/thu gọn bằng JS thay vì class `hidden sm:*`: nút dùng chung đã có
  // `inline-flex` nên hai utility display sẽ tranh nhau theo thứ tự stylesheet.
  const compact = !useMediaQuery('(min-width: 640px)')
  const bottomInset = useVisualViewportBottomInset()
  const [savedPreference, setSavedPreference] = useState(null)

  const submit = useCallback(async (values) => {
    try {
      const saved = await saveJobPreferences(values, preference)
      setSavedPreference(saved)
      onSaved(saved)
      return null
    } catch (error) {
      const [fieldError] = jobPreferenceFieldErrors(error)
      return {
        field: fieldError?.name,
        text: fieldError
          ? `Mình chưa cập nhật được “${fieldError.label}”. ${fieldError.errors[0]} Bạn sửa giúp mình rồi gửi lại nhé.`
          : getApiErrorMessage(error, 'Mình chưa lưu được nhu cầu công việc của bạn. Bạn gửi lại giúp mình nhé.'),
      }
    }
  }, [onSaved, preference])

  const chat = useInterviewChat({ onSubmit: submit, preference })
  const messages = useMemo(() => buildTranscript({
    catalog,
    failure: chat.failure,
    index: chat.index,
    nagged: chat.nagged,
    phase: chat.phase,
    savedPreference,
    user,
    values: chat.values,
  }), [catalog, chat.failure, chat.index, chat.nagged, chat.phase, chat.values, savedPreference, user])

  const latest = messages[messages.length - 1]
  const liveId = latest?.role === 'bot' ? latest.id : null
  const liveShown = useTypingPause(liveId, reducedMotion)
  const emotion = botEmotion({ latestId: liveId, phase: chat.phase, speaking: voice.speaking })

  const scrollRef = useRef(null)
  const stickyRef = useRef(true)

  // Bám đáy theo chiều cao đang lớn dần của bong bóng đang chạy chữ, nhưng
  // buông ra ngay khi ứng viên tự cuộn lên đọc lại đoạn trước.
  const keepLatestVisible = useCallback(() => {
    const node = scrollRef.current
    if (node && stickyRef.current) node.scrollTop = node.scrollHeight
  }, [])

  const handleScroll = useCallback(() => {
    const node = scrollRef.current
    if (node) stickyRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96
  }, [])

  useEffect(keepLatestVisible, [keepLatestVisible, liveShown, messages.length])

  const [readySpoken, setReadySpoken] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)
  const handleRevealed = useCallback((id) => {
    if (id === 'ready') setReadySpoken(true)
  }, [])

  useEffect(() => {
    if (!readySpoken) return undefined
    if (secondsLeft <= 0) {
      onFinish()
      return undefined
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [onFinish, readySpoken, secondsLeft])

  function begin() {
    // Cử chỉ duy nhất mở Web Audio cho cả luồng — sau lời chào robot nói được ngay.
    voice.unlock()
    chat.start()
  }

  const status = voice.speaking ? 'Đang nói…'
    : !liveShown ? 'Đang nhập…'
      : chat.phase === 'saving' ? 'Đang lọc việc làm cho bạn…'
        : chat.phase === 'ready' ? 'Đã xong' : 'Đang trực tuyến'

  return (
    // `min-h-0` để khung chat co vừa màn hình và tự cuộn bên trong, thay vì đẩy
    // ô soạn câu trả lời xuống dưới mép dưới của trang.
    <section
      className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-3 py-3 sm:px-6 sm:py-6"
      style={bottomInset ? { paddingBottom: bottomInset } : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-emerald-950/30">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:gap-3 sm:px-5">
          <ProcvMascot blink emotion={emotion} pose="microphone" size={compact ? 36 : 44} talking={voice.speaking} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">Trợ lý ProCV</p>
            <p className="truncate text-xs text-slate-500">{status}</p>
          </div>
          {chat.answering && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Câu {chat.index + 1}/{chat.total}
            </span>
          )}
          {voice.available && (
            <button
              type="button"
              aria-label={voice.enabled ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
              aria-pressed={voice.enabled}
              onClick={voice.toggle}
              className={ICON_BUTTON_CLASS}
            >
              {voice.enabled ? <SoundOutlined /> : <AudioMutedOutlined />}
            </button>
          )}
          {voice.available && voice.enabled && !compact && (
            <button
              type="button"
              aria-label="Nghe lại"
              disabled={voice.speaking || !liveId}
              onClick={() => voice.replay(liveId, latest?.text)}
              className={ICON_BUTTON_CLASS}
            >
              <RedoOutlined />
            </button>
          )}
          {chat.phase !== 'ready' && (
            <button
              type="button"
              aria-label="Hoàn thiện sau"
              onClick={onSkip}
              className={compact
                ? ICON_BUTTON_CLASS
                : 'shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700'}
            >
              {compact ? <CloseOutlined /> : 'Hoàn thiện sau'}
            </button>
          )}
        </header>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-3 py-4 sm:px-5"
        >
          {/* `mt-auto`: hội thoại mới bắt đầu thì tin nhắn nằm sát ô soạn như
              chat thật, dài ra mới đẩy lên và cuộn. */}
          <div className="onboarding-chat__list mt-auto flex flex-col gap-3">
            {messages.map((message) => {
              if (message.id === liveId && !liveShown) return null
              if (chat.editing && message.stepId === chat.editing) {
                return (
                  <div key={message.id} className="onboarding-chat__edit rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-3 text-xs font-semibold text-emerald-700">Sửa câu trả lời</p>
                    <ChatComposer
                      catalog={catalog}
                      onCancel={chat.cancelEdit}
                      onQuickAnswer={chat.send}
                      onSend={chat.send}
                      sendLabel="Xong"
                      setField={chat.setField}
                      step={chat.step}
                      values={chat.values}
                    />
                  </div>
                )
              }
              return (
                <ChatMessage
                  key={message.id}
                  emotion={message.id === liveId ? emotion : 'neutral'}
                  live={message.id === liveId}
                  message={message}
                  onContentProgress={keepLatestVisible}
                  onEdit={message.role === 'user' && message.stepId && chat.answering && !chat.editing ? chat.edit : undefined}
                  onRevealed={handleRevealed}
                />
              )
            })}
            {liveId && !liveShown && (
              <div className="flex items-end gap-2">
                <ProcvMascot blink emotion={emotion} size={38} />
                <span className="onboarding-chat__typing" aria-label="Trợ lý đang soạn tin nhắn">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
          {chat.phase === 'greeting' && (
            <div className="flex justify-end">
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
                onClick={begin}
                className="!h-10 !rounded-full !border-emerald-700 !bg-emerald-600 !px-7 !font-semibold hover:!bg-emerald-700"
              >
                {START_REPLY}
              </Button>
            </div>
          )}

          {chat.answering && !chat.editing && (
            <ChatComposer
              catalog={catalog}
              onQuickAnswer={chat.send}
              onSend={chat.send}
              sendLabel={chat.phase === 'retry' ? 'Gửi lại' : (chat.index === chat.total - 1 ? 'Hoàn tất' : 'Gửi')}
              setField={chat.setField}
              step={chat.step}
              values={chat.values}
            />
          )}

          {chat.answering && chat.editing && (
            <p className="text-center text-xs text-slate-500">Bạn đang sửa một câu trả lời ở trên.</p>
          )}

          {chat.phase === 'saving' && (
            <p className="text-center text-sm text-slate-500">Robot đang lọc việc làm phù hợp cho bạn…</p>
          )}

          {chat.phase === 'ready' && (
            <div className="flex flex-col items-center gap-2">
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                iconPlacement="end"
                onClick={onFinish}
                className="!h-11 !w-full !rounded-full !border-emerald-700 !bg-emerald-600 !px-7 !font-semibold hover:!bg-emerald-700 sm:!w-auto"
              >
                Xem việc làm dành riêng cho bạn
              </Button>
              <p className="text-xs text-slate-500">
                {readySpoken
                  ? <>Tự động chuyển sau <span className="font-semibold text-emerald-700">{secondsLeft}</span> giây</>
                  : 'Hệ thống sẽ tự động chuyển bạn đến trang việc làm ngay sau đây'}
              </p>
            </div>
          )}
        </footer>
      </div>
    </section>
  )
}
