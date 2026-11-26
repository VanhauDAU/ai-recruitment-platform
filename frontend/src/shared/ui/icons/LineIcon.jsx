// Lucide Icons (https://lucide.dev), ISC License, Copyright (c) Lucide Contributors.
// Chỉ vendor các icon header cổng ứng viên dùng: nét mảnh 24×24, kế thừa màu chữ.
const ICONS = {
  arrowLeft: ['m12 19-7-7 7-7', 'M19 12H5'],
  bell: [
    'M10.268 21a2 2 0 0 0 3.464 0',
    'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  ],
  layoutGrid: [
    'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    'M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    'M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z',
    'M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z',
  ],
  messageCircleMore: [
    'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
    'M8 12h.01',
    'M12 12h.01',
    'M16 12h.01',
  ],
  search: ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z'],
}

/** Icon nét (stroke) 1em theo cỡ chữ của phần tử cha, như icon antd. */
export default function LineIcon({ name, className = '', strokeWidth = 2 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      {ICONS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
