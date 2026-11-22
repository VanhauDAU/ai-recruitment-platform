# Dữ liệu huấn luyện bi-encoder

2500 bộ ba (tin, dương, âm). 22 CV huấn luyện qua cổng chất lượng, neo vào 0 tin huấn luyện; 4 tin giữ riêng làm dev (22 CV, 12 cặp dương). Tạo bằng `ml/scripts/build_train_pairs.py`.

| Nguồn | Số bộ ba |
| --- | ---: |
| K3 | 0 |
| K3-title | 0 |
| K1 | 0 |
| K2 | 1500 |
| K4 | 1000 |

Chống rò rỉ: 30 tin vàng không làm tin neo, 100 CV của tập vàng không dùng; 80 tin VietJobs bị loại vì giống một tin vàng.
Tin dev: JD-01, JD-03, JD-04, JD-06.
