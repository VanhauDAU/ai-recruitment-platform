# Gợi ý việc làm trên nhãn yếu (CV → tin)

100 CV tổng hợp (CV builder) × 100 tin thật; 80 CV được viết từ chính tin neo (khớp mạnh hoặc một phần). Nhãn yếu do script sinh CV đặt ra; CV do mô hình ngôn ngữ viết từ tin neo nên lợi thế cho phép so từ vựng. Tạo bằng `ml/scripts/evaluate_recommendations.py`.

| Phương án | Tin neo ở hạng 1 | Trong top 5 | Trong top 10 | MRR | Precision@5 cùng vị trí | NDCG@10 cùng vị trí | CV có gợi ý |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BM25 (CV → tin) | 0,350 | 0,537 | 0,613 | 0,443 | 0,270 | 0,538 | 100% |
| Luật `profile-rule-v2` | 0,675 | 0,950 | 0,975 | 0,795 | 0,362 | 0,726 | 100% |
| `semantic-v1` (e5-base gốc) | 0,650 | 0,950 | 0,975 | 0,776 | 0,430 | 0,832 | 100% |

## Nhu cầu đã khai: vị trí mong muốn

Mô phỏng trên cùng 100 CV, chỉ khai vị trí mong muốn. "Đổi nghề": mỗi CV khai một vị trí khác vị trí nó được viết. Tạo bằng `evaluate_recommendations.py --intent-study`.

| Điểm cộng vị trí mong muốn | Khai đúng nghề cũ: tin neo hạng 1 | MRR | NDCG@10 cùng vị trí | Đổi nghề: tin nghề mới trong top 10 (trần) | NDCG@10 nghề mới | Tin nghề cũ còn trong top 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Không khai | 0,650 | 0,776 | 0,832 | 3% (36%) | 0,043 | 25% |
| +0.10 | 0,688 | 0,823 | 0,915 | 9% (36%) | 0,137 | 24% |
| +0.20 | 0,688 | 0,826 | 0,961 | 20% (36%) | 0,326 | 24% |
| +0.30 | 0,688 | 0,829 | 0,984 | 29% (36%) | 0,535 | 24% |
| +0.40 | 0,688 | 0,829 | 0,998 | 34% (36%) | 0,719 | 23% |
| +0.50 | 0,688 | 0,829 | 1,000 | 36% (36%) | 0,829 | 22% |
