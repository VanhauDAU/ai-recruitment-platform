import ShareButtons from '@/shared/ui/ShareButtons'

// Dùng 50vw thay vì 50%: vw tính theo viewport đã bao gồm scrollbar nên không đổi khi modal khoá
// cuộn và scrollbar biến mất. Với 50% (phần trăm của viewport, co lại theo scrollbar) thanh chia sẻ
// bị nhảy ngang 7.5px mỗi lần mở modal "Ứng tuyển ngay".
const RAIL_POSITION = { left: 'max(1rem, calc(50vw - 40rem))' }

export default function JobShareRail() {
  return (
    <div
      className="fixed top-56 z-20 hidden flex-col gap-2 xl:flex"
      style={RAIL_POSITION}
      aria-label="Chia sẻ việc làm"
    >
      <ShareButtons copiedMessage="Đã sao chép đường dẫn việc làm." />
    </div>
  )
}
