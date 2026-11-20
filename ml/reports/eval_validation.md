# Kết quả trên tập vàng, phần validation

100 cặp của 10 tin; số cặp theo nhãn 0–4: 33, 42, 14, 8, 3. Nhãn do Claude gán theo `ml/labeling/rubric.md`.
Khoảng tin cậy 95% là bootstrap lấy mẫu lại theo tin. Tạo bằng `ml/scripts/evaluate.py`.

NDCG@5 khi xếp CV ngẫu nhiên là 0,445: mỗi tin chỉ có 10 CV nên mức sàn cao.

| Phương án | Spearman | Khoảng tin cậy | NDCG@5 | Khoảng tin cậy | Số tin hơn BM25 |
| --- | ---: | --- | ---: | --- | ---: |
| TF-IDF | 0,278 | 0,043 đến 0,539 | 0,640 | 0,447 đến 0,821 | 0/10 |
| BM25 | 0,216 | -0,123 đến 0,548 | 0,679 | 0,486 đến 0,861 | – |
| Luật `profile-rule-v2` | 0,628 | 0,479 đến 0,733 | 0,874 | 0,798 đến 0,938 | 6/10 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 0,550 | 0,375 đến 0,720 | 0,758 | 0,577 đến 0,911 | 5/10 |
| hybrid | 0,610 | 0,423 đến 0,777 | 0,817 | 0,654 đến 0,932 | 6/10 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 0,457 | 0,229 đến 0,683 | 0,702 | 0,519 đến 0,869 | 3/10 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 0,530 | 0,325 đến 0,718 | 0,663 | 0,487 đến 0,823 | 1/10 |

## Thang điểm của `hybrid`

- Kappa bậc hai giữa mức hiển thị và nhãn: 0,525.
- 33 cặp nhãn 0 (khác ngành): trung vị 28 điểm, cao nhất 58, 5 cặp từ 50 điểm trở lên.

## Cặp khác ngôn ngữ (tin và CV một Việt một Anh)

| Phương án | Số cặp | Spearman |
| --- | ---: | ---: |
| TF-IDF | 24 | 0,709 |
| BM25 | 24 | 0,694 |
| Luật `profile-rule-v2` | 24 | 0,733 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 24 | 0,656 |
| hybrid | 24 | 0,706 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 24 | 0,559 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 24 | 0,655 |
