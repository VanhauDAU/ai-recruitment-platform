// Bốn mức kinh nghiệm của nội dung CV gợi ý (khớp `ExperienceBand` ở backend, cùng
// mốc với số năm kinh nghiệm của tin tuyển dụng). Ứng viên chọn khi tạo CV; admin
// viết nội dung gợi ý theo từng mức.
export const CV_EXPERIENCE_BANDS = [
  { value: 'entry', label: 'Dưới 1 năm', who: 'Sinh viên, mới ra trường' },
  { value: 'junior', label: '1–2 năm', who: 'Đã đi làm, còn ít kinh nghiệm' },
  { value: 'mid', label: '3–4 năm', who: 'Làm việc độc lập' },
  { value: 'senior', label: 'Từ 5 năm', who: 'Chuyên gia, trưởng nhóm' },
]
export const DEFAULT_CV_EXPERIENCE_BAND = 'junior'
export const isCvExperienceBand = (value) => CV_EXPERIENCE_BANDS.some((band) => band.value === value)
