# Baseline từ vựng: kiểm tra trên nhãn yếu

100 JD × 100 CV tổng hợp. Độ lợi: CV neo vào JD với mức `strong` = 3,
`partial` = 2, `adjacent` = 1, CV khác = 0. Chỉ là kiểm tra hợp lý: nhãn yếu do
script sinh CV đặt ra, CV lại do LLM viết từ chính JD nên điểm bị thổi phồng.
Tạo bằng `ml/scripts/baseline.py`.

| Phương pháp | Số JD | NDCG@5 (nhãn yếu) |
| --- | ---: | ---: |
| TF-IDF (âm tiết + bigram) | 11 | 0.535 |
| BM25 (âm tiết + bigram) | 11 | 0.531 |
