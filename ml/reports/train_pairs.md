# Dữ liệu huấn luyện bi-encoder

6653 bộ ba (tin, dương, âm). 649 CV huấn luyện qua cổng chất lượng, neo vào 56 tin huấn luyện; 14 tin hiệu chỉnh giữ riêng (139 CV, 71 cặp dương). Tạo bằng `ml/scripts/build_train_pairs.py`.

| Nguồn | Số bộ ba |
| --- | ---: |
| K3 | 1123 |
| K3-title | 234 |
| K1 | 79 |
| K2 | 3000 |
| K4 | 1500 |
| K6-ordinal | 167 |
| K5-mined | 550 |

Chống rò rỉ: 30 tin vàng không làm tin neo, 100 CV của tập vàng không dùng; 144 tin VietJobs bị loại vì giống một tin vàng.
Tin hiệu chỉnh: JD-09, JD-31, JD-32, JD-37, JD-48, JD-50, JD-61, JD-64, JD-72, JD-82, JD-84, JD-86, JD-92, JD-98.

Cặp có điểm bậc (`graded.jsonl`): 898 cặp, theo điểm: 1: 244, 0.6: 115, 0.3: 90, 0: 449. Không lấy 6 tin đã đổi ô kinh nghiệm.
