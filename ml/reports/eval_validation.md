# Kết quả trên tập vàng, phần validation

100 cặp của 10 tin; số cặp theo nhãn 0–4: 33, 42, 14, 8, 3. Nhãn do Claude gán theo `ml/labeling/rubric.md`.
Khoảng tin cậy 95% là bootstrap lấy mẫu lại theo tin. Tạo bằng `ml/scripts/evaluate.py`.

NDCG@5 khi xếp CV ngẫu nhiên là 0,444: mỗi tin chỉ có 10 CV nên mức sàn cao.

| Phương án | Spearman | Khoảng tin cậy | NDCG@5 | Khoảng tin cậy | Số tin hơn BM25 |
| --- | ---: | --- | ---: | --- | ---: |
| TF-IDF | 0,278 | 0,043 đến 0,539 | 0,640 | 0,447 đến 0,821 | 0/10 |
| BM25 | 0,216 | -0,123 đến 0,548 | 0,679 | 0,486 đến 0,861 | – |
| Luật `profile-rule-v2` | 0,628 | 0,479 đến 0,733 | 0,874 | 0,798 đến 0,938 | 6/10 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 0,550 | 0,375 đến 0,720 | 0,758 | 0,577 đến 0,911 | 5/10 |
| hybrid | 0,706 | 0,553 đến 0,828 | 0,870 | 0,769 đến 0,950 | 8/10 |
| hybrid, bỏ nhóm kỹ năng thay thế (công thức `hybrid-v2`) | 0,699 | 0,535 đến 0,820 | 0,857 | 0,756 đến 0,943 | 7/10 |
| hybrid, bật khớp kỹ năng gần nghĩa | 0,647 | 0,431 đến 0,823 | 0,839 | 0,676 đến 0,950 | 7/10 |
| hybrid, bỏ hệ số liên quan | 0,695 | 0,545 đến 0,811 | 0,857 | 0,765 đến 0,937 | 7/10 |
| hybrid, tắt cả ba (công thức `hybrid-v1`) | 0,603 | 0,412 đến 0,775 | 0,815 | 0,652 đến 0,933 | 6/10 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 0,457 | 0,224 đến 0,682 | 0,702 | 0,511 đến 0,871 | 3/10 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 0,530 | 0,322 đến 0,727 | 0,663 | 0,477 đến 0,823 | 1/10 |

## Thang điểm của `hybrid`

Kappa bậc hai giữa mức hiển thị và nhãn; điểm của 33 cặp nhãn 0 (khác ngành).

| Phương án | Kappa mức hiển thị | Nhãn 0: trung vị | Nhãn 0: cao nhất | Nhãn 0: từ 50 điểm |
| --- | ---: | ---: | ---: | ---: |
| hybrid | 0,697 | 13 | 47 | 0 |
| hybrid, bỏ nhóm kỹ năng thay thế (công thức `hybrid-v2`) | 0,663 | 11 | 46 | 0 |
| hybrid, bật khớp kỹ năng gần nghĩa | 0,557 | 17 | 57 | 5 |
| hybrid, bỏ hệ số liên quan | 0,704 | 27 | 50 | 1 |
| hybrid, tắt cả ba (công thức `hybrid-v1`) | 0,511 | 28 | 65 | 6 |

Điểm trung bình theo nhãn (KHÔNG tăng dần):

| Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| ---: | ---: | ---: | ---: | ---: |
| 16 | 34 | 57 | 73 | 64 |

Số cặp theo mức hiển thị và nhãn (mức đúng của nhãn: 0–1 chưa phù hợp, 2 tương đối, 3 phù hợp, 4 rất phù hợp):

| Mức hiển thị | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chưa phù hợp | 33 | 34 | 6 | 0 | 1 |
| Tương đối phù hợp | 0 | 8 | 3 | 2 | 0 |
| Phù hợp | 0 | 0 | 3 | 4 | 1 |
| Rất phù hợp | 0 | 0 | 2 | 2 | 1 |

## So với `hybrid` (bootstrap ghép cặp)

Hiệu số phương án trừ `hybrid`, đo trên cùng bộ tin ở mỗi vòng bootstrap. In đậm khi khoảng
tin cậy 95% không chứa 0; còn lại là chưa kết luận được.

| Phương án | Δ Spearman | Khoảng tin cậy | Δ NDCG@5 | Khoảng tin cậy |
| --- | ---: | --- | ---: | --- |
| TF-IDF | **-0,428** | -0,610 đến -0,200 | **-0,230** | -0,360 đến -0,106 |
| BM25 | **-0,490** | -0,752 đến -0,179 | **-0,191** | -0,328 đến -0,065 |
| Luật `profile-rule-v2` | -0,078 | -0,210 đến 0,042 | +0,004 | -0,104 đến 0,133 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | **-0,156** | -0,288 đến -0,018 | **-0,111** | -0,218 đến -0,019 |
| hybrid, bỏ nhóm kỹ năng thay thế (công thức `hybrid-v2`) | -0,007 | -0,024 đến 0,003 | -0,012 | -0,066 đến 0,029 |
| hybrid, bật khớp kỹ năng gần nghĩa | -0,059 | -0,147 đến 0,011 | -0,031 | -0,100 đến 0,011 |
| hybrid, bỏ hệ số liên quan | -0,011 | -0,086 đến 0,052 | -0,012 | -0,036 đến 0,007 |
| hybrid, tắt cả ba (công thức `hybrid-v1`) | **-0,103** | -0,240 đến -0,008 | -0,055 | -0,142 đến 0,011 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | **-0,249** | -0,412 đến -0,070 | **-0,168** | -0,283 đến -0,053 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | **-0,176** | -0,334 đến -0,005 | **-0,207** | -0,351 đến -0,085 |

## Cặp khác ngôn ngữ (tin và CV một Việt một Anh)

| Phương án | Số cặp | Spearman |
| --- | ---: | ---: |
| TF-IDF | 24 | 0,709 |
| BM25 | 24 | 0,694 |
| Luật `profile-rule-v2` | 24 | 0,733 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 24 | 0,656 |
| hybrid | 24 | 0,762 |
| hybrid, bỏ nhóm kỹ năng thay thế (công thức `hybrid-v2`) | 24 | 0,775 |
| hybrid, bật khớp kỹ năng gần nghĩa | 24 | 0,767 |
| hybrid, bỏ hệ số liên quan | 24 | 0,705 |
| hybrid, tắt cả ba (công thức `hybrid-v1`) | 24 | 0,704 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 24 | 0,559 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 24 | 0,655 |
