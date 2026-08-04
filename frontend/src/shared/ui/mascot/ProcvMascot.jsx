import { useState } from 'react'
import { MASCOT_ASSETS } from './mascot-assets'
import './mascot.css'

const EMOTIONS = new Set(['neutral', 'happy', 'thinking', 'success', 'error'])
const POSES = new Set(['neutral', 'wave', 'thumbsUp', 'microphone'])
const SHADOWS = new Set(['floating', 'ground', 'none'])

function Layer({ className = '', src, style }) {
  return <img alt="" aria-hidden="true" draggable="false" src={src} style={style} className={`procv-mascot__layer ${className}`} />
}

export default function ProcvMascot({
  blink = false,
  className = '',
  emotion = 'neutral',
  float = false,
  pose = 'neutral',
  shadow = 'none',
  size = 56,
  talking = false,
}) {
  const [blinkDelay] = useState(() => `${-(Math.random() * 4.5).toFixed(2)}s`)
  const resolvedEmotion = EMOTIONS.has(emotion) ? emotion : 'neutral'
  const resolvedPose = POSES.has(pose) ? pose : 'neutral'
  const resolvedShadow = SHADOWS.has(shadow) ? shadow : 'none'
  const arms = MASCOT_ASSETS.arms[resolvedPose]

  return (
    <span
      aria-hidden="true"
      className={`procv-mascot ${float ? 'procv-mascot--float' : ''} ${className}`}
      data-emotion={resolvedEmotion}
      data-pose={resolvedPose}
      style={{ height: size, width: size }}
    >
      {resolvedShadow !== 'none' && (
        <Layer
          className={float ? 'procv-mascot__shadow procv-mascot__shadow--float' : 'procv-mascot__shadow'}
          src={MASCOT_ASSETS.shadows[resolvedShadow]}
        />
      )}
      <Layer src={MASCOT_ASSETS.body} />
      <Layer src={arms.right} />
      <Layer className={resolvedPose === 'wave' ? 'procv-mascot__arm-wave' : ''} src={arms.left} />
      {arms.prop && <Layer className="procv-mascot__held-prop" src={arms.prop} />}
      {arms.front && <Layer className="procv-mascot__hand-front" src={arms.front} />}
      <Layer src={MASCOT_ASSETS.head} />
      <Layer
        className={blink ? 'procv-mascot__eyes-base' : ''}
        src={MASCOT_ASSETS.eyes[resolvedEmotion]}
        style={blink ? { animationDelay: blinkDelay } : undefined}
      />
      {blink && (
        <Layer
          className="procv-mascot__eyes-blink"
          src={MASCOT_ASSETS.eyes.blink}
          style={{ animationDelay: blinkDelay }}
        />
      )}
      <Layer src={MASCOT_ASSETS.mouths[resolvedEmotion]} />
      {talking && <Layer className="procv-mascot__mouth-talk" src={MASCOT_ASSETS.mouths.happy} />}
    </span>
  )
}
