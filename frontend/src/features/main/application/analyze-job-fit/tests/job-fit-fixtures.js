// Kết quả mẫu đúng định dạng `result_json` của backend, dùng cho test giao diện.
export const RESULT = {
  overall: { score: 72, level: 'high', label: 'Phù hợp', confidence: 'medium' },
  components: [
    { key: 'skills', score: 80, weight: 0.4, status: 'ok', summary: 'Đáp ứng 4/5 kỹ năng tin yêu cầu.' },
    { key: 'experience', score: 60, weight: 0.3, status: 'ok', summary: 'CV có khoảng 2 năm kinh nghiệm.' },
    { key: 'education', score: null, weight: 0.1, status: 'insufficient_data', summary: 'CV chưa ghi bậc học.' },
    { key: 'languages', score: null, weight: 0.1, status: 'not_required', summary: 'Tin không đặt yêu cầu cho tiêu chí này.' },
  ],
  skills: {
    matched: [
      { name: 'ReactJS', importance: 'required', match_type: 'exact', similarity: null, evidence: 'Xây dựng trang thanh toán bằng ReactJS.' },
      { name: 'Jest', importance: 'preferred', match_type: 'exact', similarity: null, evidence: '' },
    ],
    missing: [{ name: 'TypeScript', importance: 'required' }],
    extra: [],
  },
  requirements: [
    { text: 'Có 2 năm kinh nghiệm ReactJS.', status: 'met', similarity: 0.9, evidence: 'Hai năm phát triển giao diện bằng ReactJS.' },
    { text: 'Viết test tự động.', status: 'unmet', similarity: 0.5, evidence: '' },
  ],
  suggestions: [
    { code: 'missing_required_skills', priority: 'high', section: 'skills', message: 'Tin yêu cầu TypeScript. Nếu bạn đã có, hãy ghi vào mục kỹ năng.', params: { skills: ['TypeScript'] } },
  ],
  flags: { language_mismatch: false, experience_estimated: false, insufficient: ['education'] },
  disclaimer: 'Kết quả là ước lượng tự động dựa trên nội dung CV và tin tuyển dụng, không phải quyết định tuyển dụng.',
  meta: { model_version: 'e5-base-zs-v1', scoring_version: 'hybrid-v1' },
}
