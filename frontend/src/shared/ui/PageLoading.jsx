import BrandLoader from '@/shared/ui/BrandLoader'

export default function PageLoading() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-white px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <BrandLoader size={128} />
        <p className="text-sm font-medium text-gray-500">Đang tải dữ liệu...</p>
      </div>
    </div>
  )
}
