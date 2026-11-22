# Dữ liệu huấn luyện cross-encoder (yêu cầu ↔ câu CV)

3 câu yêu cầu loại `skill` (3 từ tin thật ngoài tập vàng, phần còn lại từ VietJobs), 15 cặp; train 0, dev 15 (chia theo tin). Tạo bằng `ml/scripts/build_requirement_pairs.py`.

| Nguồn | Nhãn | Số cặp |
| --- | ---: | ---: |
| `met` (câu đáp ứng, cùng ngôn ngữ) | 1 | 3 |
| `met_other` (câu đáp ứng, ngôn ngữ còn lại) | 1 | 3 |
| `near_miss` (liên quan, chưa đủ) | 0,5 | 3 |
| `cross` (câu đáp ứng của yêu cầu khác cùng nhóm) | 0 | 0 |
| `pipeline` (câu CV huấn luyện khác nhóm ngành, TF-IDF gần nhất) | 0 | 6 |

Nhãn: 1: 6, 0,5: 3, 0: 6.

Kiểm tra "chỉ nhìn câu CV" (TF-IDF + hồi quy logistic, không thấy câu yêu cầu): AUC nan trên dev, Gần 0,5 nghĩa là văn phong của câu không lộ nhãn.
