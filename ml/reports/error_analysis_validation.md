# Phân tích lỗi trên tập vàng, phần validation

100 cặp, mô hình `e5-base-zs-v1`. Tạo bằng `ml/scripts/error_analysis.py` từ điểm từng cặp
của `evaluate.py`.

## Tín hiệu nào đi cùng nhãn

| Tín hiệu | Số cặp có giá trị | Spearman với nhãn |
| --- | ---: | ---: |
| Điểm tổng | 100 | 0,706 |
| Luật `profile-rule-v2` | 100 | 0,628 |
| Cosine toàn văn | 100 | 0,550 |
| Cosine chức danh | 100 | 0,599 |
| Tiêu chí `skills` | 100 | 0,578 |
| Tiêu chí `experience` | 100 | 0,670 |
| Tiêu chí `education` | 100 | -0,038 |
| Tiêu chí `position_level` | 83 | 0,233 |
| Tiêu chí `languages` | 50 | 0,201 |

## Cosine của bi-encoder theo nhãn

| Nhãn | Số cặp | Toàn văn: thấp nhất | trung vị | cao nhất | Chức danh: trung vị |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 33 | 0,775 | 0,832 | 0,856 | 0,820 |
| 1 | 42 | 0,808 | 0,850 | 0,895 | 0,848 |
| 2 | 14 | 0,826 | 0,865 | 0,912 | 0,871 |
| 3 | 8 | 0,829 | 0,868 | 0,913 | 0,904 |
| 4 | 3 | 0,826 | 0,838 | 0,884 | 0,873 |

## Cặp lệch mức (13 cặp)

Mức hiển thị cách mức đúng của nhãn từ hai bậc, hoặc nhãn 3–4 dưới 65 điểm, hoặc nhãn 0–1 từ 50 điểm.

| Tin | CV | Nhãn | Điểm | Mức hiển thị | Kỹ năng | Kinh nghiệm | Cosine toàn văn | Cosine chức danh |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| JD-60 | CV-038 | 4 | 34 | Chưa phù hợp | 25 | 30 | 0,826 | 0,859 |
| JD-66 | CV-002 | 3 | 64 | Tương đối phù hợp | 100 | 83 | 0,864 | 0,918 |
| JD-75 | CV-047 | 3 | 64 | Tương đối phù hợp | 80 | 46 | 0,829 | 0,890 |
| JD-66 | CV-003 | 2 | 86 | Rất phù hợp | 100 | 59 | 0,871 | 0,918 |
| JD-02 | CV-001 | 2 | 89 | Rất phù hợp | 100 | 68 | 0,912 | 0,921 |
| JD-60 | CV-039 | 1 | 52 | Tương đối phù hợp | 50 | 40 | 0,852 | 0,884 |
| JD-75 | CV-052 | 1 | 53 | Tương đối phù hợp | 20 | 68 | 0,862 | 0,890 |
| JD-60 | CV-043 | 1 | 58 | Tương đối phù hợp | 50 | 41 | 0,857 | 0,879 |
| JD-30 | CV-055 | 1 | 59 | Tương đối phù hợp | 71 | 45 | 0,864 | 0,882 |
| JD-02 | CV-024 | 1 | 60 | Tương đối phù hợp | 33 | 68 | 0,891 | 0,921 |
| JD-02 | CV-079 | 1 | 60 | Tương đối phù hợp | 33 | 68 | 0,895 | 0,921 |
| JD-35 | CV-068 | 1 | 62 | Tương đối phù hợp | 67 | 52 | 0,863 | 0,850 |
| JD-35 | CV-025 | 1 | 62 | Tương đối phù hợp | 67 | 34 | 0,867 | 0,841 |
