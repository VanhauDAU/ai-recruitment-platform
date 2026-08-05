import { ProcvMascot } from '@/shared/ui/mascot'

function mascotState(status) {
  if (['creating', 'queued', 'buffering', 'rebuffering'].includes(status)) {
    return { emotion: 'thinking', pose: 'microphone' }
  }
  if (status === 'playing') return { emotion: 'happy', pose: 'microphone', talking: true }
  if (status === 'paused') return { emotion: 'thinking', pose: 'microphone' }
  if (status === 'ended') return { emotion: 'success', pose: 'microphone' }
  if (status === 'error') return { emotion: 'error', pose: 'microphone' }
  return { emotion: 'happy', pose: 'microphone' }
}

export function SpeechMascot({ size, status }) {
  const state = mascotState(status)
  return (
    <ProcvMascot
      size={size}
      emotion={state.emotion}
      pose={state.pose}
      talking={state.talking}
      blink
      float={status === 'idle' || status === 'playing'}
      shadow="floating"
    />
  )
}

export function SpeechWaveform() {
  return (
    <span className="blog-speech__waveform" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}
