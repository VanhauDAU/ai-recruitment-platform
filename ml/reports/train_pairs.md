# Dữ liệu huấn luyện bi-encoder

6146 bộ ba (tin, dương, âm). 698 CV huấn luyện qua cổng chất lượng, neo vào 56 tin huấn luyện; 14 tin hiệu chỉnh giữ riêng (149 CV, 78 cặp dương). Tạo bằng `ml/scripts/build_train_pairs.py`.

| Nguồn | Số bộ ba |
| --- | ---: |
| K3 | 1308 |
| K3-title | 259 |
| K1 | 79 |
| K2 | 3000 |
| K4 | 1500 |

Chống rò rỉ: 30 tin vàng không làm tin neo, 100 CV của tập vàng không dùng; 144 tin VietJobs bị loại vì giống một tin vàng.
Tin hiệu chỉnh: JD-09, JD-31, JD-32, JD-37, JD-48, JD-50, JD-61, JD-64, JD-72, JD-82, JD-84, JD-86, JD-92, JD-98.

Cặp có điểm bậc (`graded.jsonl`): 972 cặp, theo điểm: 1: 261, 0.6: 127, 0.3: 98, 0: 486. Không lấy 6 tin đã đổi ô kinh nghiệm.
