# Gợi ý việc làm trên nhãn yếu (CV → tin)

100 CV tổng hợp (CV builder) × 100 tin thật; 80 CV được viết từ chính tin neo (khớp mạnh hoặc một phần). Nhãn yếu do script sinh CV đặt ra; CV do mô hình ngôn ngữ viết từ tin neo nên lợi thế cho phép so từ vựng. Tạo bằng `ml/scripts/evaluate_recommendations.py`.

| Phương án | Tin neo ở hạng 1 | Trong top 5 | Trong top 10 | MRR | Precision@5 cùng vị trí | NDCG@10 cùng vị trí | CV có gợi ý |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BM25 (CV → tin) | 0,350 | 0,537 | 0,613 | 0,443 | 0,270 | 0,538 | 100% |
| Luật `profile-rule-v2` | 0,675 | 0,950 | 0,975 | 0,795 | 0,362 | 0,726 | 100% |
| `semantic-v1` (e5-base gốc) | 0,650 | 0,950 | 0,975 | 0,780 | 0,430 | 0,830 | 100% |
