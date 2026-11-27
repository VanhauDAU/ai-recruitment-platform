# Gợi ý việc làm trên nhãn yếu (CV → tin)

100 CV tổng hợp (CV builder) × 100 tin thật; 80 CV được viết từ chính tin neo (khớp mạnh hoặc một phần). Nhãn yếu do script sinh CV đặt ra; CV do mô hình ngôn ngữ viết từ tin neo nên lợi thế cho phép so từ vựng. Tạo bằng `ml/scripts/evaluate_recommendations.py`.

| Phương án | Tin neo ở hạng 1 | Trong top 5 | Trong top 10 | MRR | Precision@5 cùng vị trí | NDCG@10 cùng vị trí | CV có gợi ý |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BM25 (CV → tin) | 0,350 | 0,537 | 0,600 | 0,443 | 0,270 | 0,539 | 100% |
| Luật `profile-rule-v2` | 0,675 | 0,950 | 0,975 | 0,795 | 0,358 | 0,722 | 100% |
| `semantic-v1` (`e5-base-wise-v1`) | 0,762 | 0,988 | 0,988 | 0,867 | 0,490 | 0,913 | 100% |

## Nhu cầu đã khai: vị trí mong muốn

Mô phỏng trên cùng 100 CV, chỉ khai vị trí mong muốn. "Đổi nghề": mỗi CV khai một vị trí khác vị trí nó được viết. Tạo bằng `evaluate_recommendations.py --intent-study`.

| Điểm cộng vị trí mong muốn | Khai đúng nghề cũ: tin neo hạng 1 | MRR | NDCG@10 cùng vị trí | Đổi nghề: tin nghề mới trong top 10 (trần) | NDCG@10 nghề mới | Tin nghề cũ còn trong top 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Không khai | 0,762 | 0,867 | 0,913 | 3% (35%) | 0,041 | 27% |
| +0.10 | 0,787 | 0,880 | 0,956 | 6% (35%) | 0,092 | 27% |
| +0.20 | 0,787 | 0,881 | 0,981 | 16% (35%) | 0,259 | 27% |
| +0.30 | 0,787 | 0,881 | 0,995 | 28% (35%) | 0,473 | 26% |
| +0.40 | 0,787 | 0,881 | 0,999 | 33% (35%) | 0,622 | 26% |
| +0.50 | 0,787 | 0,881 | 1,000 | 34% (35%) | 0,704 | 26% |
