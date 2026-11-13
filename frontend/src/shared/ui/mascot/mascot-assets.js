const ROOT = '/images/mascot'

export const MASCOT_ASSETS = {
  head: `${ROOT}/base/robot-head.webp`,
  body: `${ROOT}/base/robot-body-core.webp`,
  shadows: {
    floating: `${ROOT}/base/robot-shadow-floating.webp`,
    ground: `${ROOT}/base/robot-shadow-ground.webp`,
  },
  eyes: {
    neutral: `${ROOT}/face/eyes/robot-eyes-neutral.webp`,
    blink: `${ROOT}/face/eyes/robot-eyes-blink.webp`,
    happy: `${ROOT}/face/eyes/robot-eyes-happy.webp`,
    thinking: `${ROOT}/face/eyes/robot-eyes-thinking.webp`,
    success: `${ROOT}/face/eyes/robot-eyes-success.webp`,
    error: `${ROOT}/face/eyes/robot-eyes-error.webp`,
    lookDown: `${ROOT}/face/eyes/robot-eyes-look-down.webp`,
  },
  mouths: {
    neutral: `${ROOT}/face/mouths/robot-mouth-neutral.webp`,
    happy: `${ROOT}/face/mouths/robot-mouth-happy.webp`,
    thinking: `${ROOT}/face/mouths/robot-mouth-thinking.webp`,
    success: `${ROOT}/face/mouths/robot-mouth-success.webp`,
    error: `${ROOT}/face/mouths/robot-mouth-error.webp`,
  },
  arms: {
    frameGrip: {},
    neutral: {
      left: `${ROOT}/arms/neutral/robot-arm-left-neutral.webp`,
      right: `${ROOT}/arms/neutral/robot-arm-right-neutral.webp`,
    },
    wave: {
      left: `${ROOT}/arms/gestures/robot-arm-left-wave.webp`,
      right: `${ROOT}/arms/neutral/robot-arm-right-neutral.webp`,
    },
    thumbsUp: {
      left: `${ROOT}/arms/gestures/robot-arm-left-thumbs-up.webp`,
      right: `${ROOT}/arms/neutral/robot-arm-right-neutral.webp`,
    },
    // Ôm bảng bằng hai tay nên cần hai bàn tay trước.
    checklist: {
      left: `${ROOT}/arms/hold/robot-arm-left-hold.webp`,
      right: `${ROOT}/arms/hold/robot-arm-right-hold.webp`,
      prop: `${ROOT}/props/robot-prop-checklist.webp`,
      front: [
        `${ROOT}/arms/hold/robot-hand-left-hold-front.webp`,
        `${ROOT}/arms/hold/robot-hand-right-hold-front.webp`,
      ],
    },
    coverEyes: {
      face: [
        { side: 'right', src: `${ROOT}/arms/auth/robot-arm-right-cover-eyes-front.webp` },
        { side: 'left', src: `${ROOT}/arms/auth/robot-arm-left-cover-eyes-front.webp` },
      ],
    },
    peek: {
      left: `${ROOT}/arms/neutral/robot-arm-left-neutral.webp`,
      face: [
        { side: 'right', src: `${ROOT}/arms/auth/robot-arm-right-cover-eyes-front.webp` },
      ],
    },
  },
}

export const MASCOT_SCENES = Object.freeze({
  cvHelper: `${ROOT}/scenes/robot-cv-helper.webp`,
  emptyStateCv: `${ROOT}/scenes/robot-empty-state-cv.webp`,
  emptyStateJobs: `${ROOT}/scenes/robot-empty-state-jobs.webp`,
  interviewCoach: `${ROOT}/scenes/robot-interview-coach.webp`,
  profileCheck: `${ROOT}/scenes/robot-profile-check.webp`,
  searchJob: `${ROOT}/scenes/robot-search-job.webp`,
})

export const MASCOT_FRAME_GRIP = `${ROOT}/arms/auth/robot-hands-frame-grip.webp`
