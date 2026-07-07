export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 text-sm flex flex-col sm:flex-row justify-between gap-4">
        <p>© {new Date().getFullYear()} AI Career Coach. Đồ án tốt nghiệp.</p>
        <p>Tạo CV chuyên nghiệp · Phân tích CV bằng AI · Luyện phỏng vấn thông minh</p>
      </div>
    </footer>
  )
}
