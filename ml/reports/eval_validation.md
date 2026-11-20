# Kết quả trên tập vàng, phần validation

50 cặp của 5 tin; số cặp theo nhãn 0–4: 12, 22, 7, 7, 2. Nhãn do Claude gán theo `ml/labeling/rubric.md`.
Khoảng tin cậy 95% là bootstrap lấy mẫu lại theo tin. Tạo bằng `ml/scripts/evaluate.py`.

NDCG@5 khi xếp CV ngẫu nhiên là 0,444: mỗi tin chỉ có 10 CV nên mức sàn cao.

| Phương án | Spearman | Khoảng tin cậy | NDCG@5 | Khoảng tin cậy | Số tin hơn BM25 |
| --- | ---: | --- | ---: | --- | ---: |
| TF-IDF | 0,281 | 0,104 đến 0,538 | 0,422 | 0,231 đến 0,625 | 0/5 |
| BM25 | 0,386 | 0,204 đến 0,733 | 0,491 | 0,227 đến 0,750 | – |
| Luật `profile-rule-v2` | 0,692 | 0,518 đến 0,792 | 0,881 | 0,822 đến 0,945 | 4/5 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 0,545 | 0,314 đến 0,714 | 0,607 | 0,319 đến 0,864 | 3/5 |
| hybrid | 0,625 | 0,351 đến 0,847 | 0,690 | 0,424 đến 0,869 | 3/5 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 0,431 | 0,110 đến 0,699 | 0,524 | 0,269 đến 0,758 | 2/5 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 0,583 | 0,318 đến 0,785 | 0,554 | 0,297 đến 0,811 | 1/5 |

## Thang điểm của `hybrid`

- Kappa bậc hai giữa mức hiển thị và nhãn: 0,398.
- 12 cặp nhãn 0 (khác ngành): trung vị 31 điểm, cao nhất 58, 2 cặp từ 50 điểm trở lên.

## Cặp khác ngôn ngữ (tin và CV một Việt một Anh)

| Phương án | Số cặp | Spearman |
| --- | ---: | ---: |
| TF-IDF | 15 | 0,734 |
| BM25 | 15 | 0,674 |
| Luật `profile-rule-v2` | 15 | 0,808 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 15 | 0,646 |
| hybrid | 15 | 0,728 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 15 | 0,507 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 15 | 0,624 |
