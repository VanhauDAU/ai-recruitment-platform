# Dữ liệu huấn luyện cross-encoder (yêu cầu ↔ câu CV)

1070 câu yêu cầu loại `skill` (258 từ tin thật ngoài tập vàng, phần còn lại từ VietJobs), 6553 cặp; train 5473, dev 1080 (chia theo tin). Tạo bằng `ml/scripts/build_requirement_pairs.py`.

| Nguồn | Nhãn | Số cặp |
| --- | ---: | ---: |
| `met` (câu đáp ứng, cùng ngôn ngữ) | 1 | 1070 |
| `met_other` (câu đáp ứng, ngôn ngữ còn lại) | 1 | 1070 |
| `near_miss` (liên quan, chưa đủ) | 0,5 | 1070 |
| `cross` (câu đáp ứng của yêu cầu khác cùng nhóm) | 0 | 1054 |
| `cross_other` (như trên, câu ở ngôn ngữ còn lại) | 0 | 1054 |
| `pipeline` (câu CV huấn luyện khác nhóm ngành, TF-IDF gần nhất) | 0 | 516 |
| `cv_met` (câu CV của chính tin, nêu từ nửa số kỹ năng của yêu cầu) | 1 | 292 |
| `cv_partial` (câu CV của chính tin, nêu dưới nửa số kỹ năng) | 0,5 | 34 |
| `cv_unmet` (câu CV của chính tin, chỉ nêu kỹ năng khác) | 0 | 393 |

Nhãn: 1: 2432, 0,5: 1104, 0: 3017.

Kiểm tra "chỉ nhìn câu CV" (TF-IDF + hồi quy logistic, không thấy câu yêu cầu): AUC 0,620 trên dev. Gần 0,5 nghĩa là văn phong của câu không lộ nhãn.
