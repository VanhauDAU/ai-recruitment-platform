export default function PageLoading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-white px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes pageLoadingOrbit {
          to { transform: rotate(360deg); }
        }
        @keyframes pageLoadingPulse {
          0%, 100% { transform: scale(0.92); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-4">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full bg-emerald-50 shadow-[0_0_42px_rgba(0,177,79,0.18)]" />
          <div
            className="absolute inset-2 rounded-full border-4 border-emerald-100 border-t-[var(--brand-primary)]"
            style={{ animation: 'pageLoadingOrbit 0.9s linear infinite' }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div
              className="h-4 w-4 rounded-full bg-[var(--brand-primary)]"
              style={{ animation: 'pageLoadingPulse 1.2s ease-in-out infinite' }}
            />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-500">Đang tải dữ liệu...</p>
      </div>
    </div>
  )
}
