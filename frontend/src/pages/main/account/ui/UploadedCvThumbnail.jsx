// Ảnh đại diện cho CV tải lên: thư mục chứa tệp CV, vẽ bằng SVG để không tải tệp gốc.
export default function UploadedCvThumbnail({ fileType }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-200 bg-white">
      <svg viewBox="0 0 160 120" role="img" aria-label={`Tệp CV ${(fileType || '').toUpperCase()}`} className="w-1/2 max-w-40">
        <defs>
          <linearGradient id="cv-folder-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#34c77b" />
            <stop offset="1" stopColor="#13a85a" />
          </linearGradient>
          <linearGradient id="cv-folder-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8be3b0" />
            <stop offset="1" stopColor="#c9f3da" />
          </linearGradient>
        </defs>
        <path d="M14 22a8 8 0 0 1 8-8h34l10 10h60a8 8 0 0 1 8 8v70a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" fill="url(#cv-folder-back)" />
        <rect x="30" y="10" width="34" height="5" rx="2.5" fill="var(--brand-primary-soft)" opacity="0.8" />
        <path d="M26 44a8 8 0 0 1 7.6-5.5h108a6 6 0 0 1 5.7 7.8l-17 56A8 8 0 0 1 122.7 108H20a6 6 0 0 1-5.7-7.8z" fill="url(#cv-folder-front)" opacity="0.95" />
        <path d="M66 86a12 12 0 0 1 1.5-23.9A15 15 0 0 1 96 64a11 11 0 0 1-1 22z" fill="#ffffff" opacity="0.85" />
        <text x="81" y="80" textAnchor="middle" fontSize="13" fontWeight="700" fill="#34c77b" fontFamily="inherit">CV</text>
      </svg>
    </div>
  )
}
