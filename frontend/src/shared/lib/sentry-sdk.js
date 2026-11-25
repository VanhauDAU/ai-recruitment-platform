// Chỉ re-export phần dùng tới: dynamic import cả namespace '@sentry/browser' giữ
// lại Replay, Feedback… (chunk hơn 400 KB).
export { init } from '@sentry/browser'
