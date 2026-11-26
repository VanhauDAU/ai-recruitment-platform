# Kết quả trên tập vàng, phần validation

100 cặp của 10 tin; số cặp theo nhãn 0–4: 33, 42, 14, 8, 3. Nhãn do Claude gán theo `ml/labeling/rubric.md`.
Khoảng tin cậy 95% là bootstrap lấy mẫu lại theo tin. Tạo bằng `ml/scripts/evaluate.py`.

NDCG@5 khi xếp CV ngẫu nhiên là 0,448: mỗi tin chỉ có 10 CV nên mức sàn cao.

| Phương án | Spearman | Khoảng tin cậy | NDCG@5 | Khoảng tin cậy | Số tin hơn BM25 |
| --- | ---: | --- | ---: | --- | ---: |
| TF-IDF | 0,278 | 0,043 đến 0,539 | 0,640 | 0,447 đến 0,821 | 0/10 |
| BM25 | 0,216 | -0,123 đến 0,548 | 0,679 | 0,486 đến 0,861 | – |
| Luật `profile-rule-v2` | 0,628 | 0,479 đến 0,733 | 0,874 | 0,798 đến 0,938 | 6/10 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 0,550 | 0,375 đến 0,720 | 0,758 | 0,577 đến 0,911 | 5/10 |
| hybrid | 0,699 | 0,544 đến 0,821 | 0,857 | 0,756 đến 0,940 | 7/10 |
| hybrid, bật khớp kỹ năng gần nghĩa | 0,626 | 0,412 đến 0,801 | 0,821 | 0,661 đến 0,939 | 6/10 |
| hybrid, bỏ hệ số liên quan | 0,692 | 0,536 đến 0,814 | 0,857 | 0,765 đến 0,937 | 7/10 |
| hybrid, tắt cả hai (công thức `hybrid-v1`) | 0,603 | 0,382 đến 0,772 | 0,815 | 0,645 đến 0,931 | 6/10 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 0,457 | 0,224 đến 0,689 | 0,702 | 0,521 đến 0,867 | 3/10 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 0,530 | 0,323 đến 0,733 | 0,663 | 0,487 đến 0,825 | 1/10 |

## Thang điểm của `hybrid`

Kappa bậc hai giữa mức hiển thị và nhãn; điểm của 33 cặp nhãn 0 (khác ngành).

| Phương án | Kappa mức hiển thị | Nhãn 0: trung vị | Nhãn 0: cao nhất | Nhãn 0: từ 50 điểm |
| --- | ---: | ---: | ---: | ---: |
| hybrid | 0,663 | 11 | 46 | 0 |
| hybrid, bật khớp kỹ năng gần nghĩa | 0,535 | 17 | 57 | 5 |
| hybrid, bỏ hệ số liên quan | 0,672 | 27 | 48 | 0 |
| hybrid, tắt cả hai (công thức `hybrid-v1`) | 0,511 | 28 | 65 | 6 |

Điểm trung bình theo nhãn (KHÔNG tăng dần):

| Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| ---: | ---: | ---: | ---: | ---: |
| 16 | 34 | 55 | 71 | 65 |

Số cặp theo mức hiển thị và nhãn (mức đúng của nhãn: 0–1 chưa phù hợp, 2 tương đối, 3 phù hợp, 4 rất phù hợp):

| Mức hiển thị | Nhãn 0 | Nhãn 1 | Nhãn 2 | Nhãn 3 | Nhãn 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chưa phù hợp | 33 | 34 | 7 | 0 | 1 |
| Tương đối phù hợp | 0 | 8 | 3 | 4 | 0 |
| Phù hợp | 0 | 0 | 2 | 2 | 1 |
| Rất phù hợp | 0 | 0 | 2 | 2 | 1 |

## So với `hybrid` (bootstrap ghép cặp)

Hiệu số phương án trừ `hybrid`, đo trên cùng bộ tin ở mỗi vòng bootstrap. In đậm khi khoảng
tin cậy 95% không chứa 0; còn lại là chưa kết luận được.

| Phương án | Δ Spearman | Khoảng tin cậy | Δ NDCG@5 | Khoảng tin cậy |
| --- | ---: | --- | ---: | --- |
| TF-IDF | **-0,421** | -0,605 đến -0,192 | **-0,217** | -0,344 đến -0,096 |
| BM25 | **-0,483** | -0,746 đến -0,174 | **-0,178** | -0,322 đến -0,050 |
| Luật `profile-rule-v2` | -0,071 | -0,198 đến 0,045 | +0,016 | -0,097 đến 0,147 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | **-0,149** | -0,281 đến -0,008 | **-0,099** | -0,211 đến -0,002 |
| hybrid, bật khớp kỹ năng gần nghĩa | **-0,073** | -0,170 đến -0,003 | -0,036 | -0,100 đến 0,000 |
| hybrid, bỏ hệ số liên quan | -0,007 | -0,069 đến 0,053 | -0,000 | -0,011 đến 0,011 |
| hybrid, tắt cả hai (công thức `hybrid-v1`) | **-0,096** | -0,225 đến -0,007 | -0,042 | -0,112 đến 0,000 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | **-0,242** | -0,408 đến -0,060 | **-0,155** | -0,279 đến -0,039 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | -0,169 | -0,330 đến 0,005 | **-0,194** | -0,341 đến -0,061 |

## Cặp khác ngôn ngữ (tin và CV một Việt một Anh)

| Phương án | Số cặp | Spearman |
| --- | ---: | ---: |
| TF-IDF | 24 | 0,709 |
| BM25 | 24 | 0,694 |
| Luật `profile-rule-v2` | 24 | 0,733 |
| Bi-encoder `e5-base-zs-v1` (cosine toàn văn) | 24 | 0,656 |
| hybrid | 24 | 0,775 |
| hybrid, bật khớp kỹ năng gần nghĩa | 24 | 0,785 |
| hybrid, bỏ hệ số liên quan | 24 | 0,726 |
| hybrid, tắt cả hai (công thức `hybrid-v1`) | 24 | 0,704 |
| Bi-encoder `e5-small-zs-v1` (cosine toàn văn) | 24 | 0,559 |
| Bi-encoder `minilm-l12-zs-v1` (cosine toàn văn) | 24 | 0,655 |
