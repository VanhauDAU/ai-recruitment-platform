# Nhãn cặp yêu cầu – câu CV

358 cặp thật lấy từ đường ống (câu yêu cầu của tin, câu CV do bi-encoder chọn), hai lượt gán độc lập do mô hình
ngôn ngữ (Claude) thực hiện theo `ml/labeling/requirement_rubric.md`, không thấy mã tin, mã CV hay điểm của mô hình.
Hai lượt trùng nhau 332/358 cặp, kappa có trọng số bậc hai 0,944; cặp lệch lấy mức thấp hơn.
Tạo bằng `ml/scripts/build_requirement_eval.py merge`.

| Phần | Số cặp | Đạt | Có liên quan | Không đạt |
| --- | ---: | ---: | ---: | ---: |
| calibration | 215 | 44 | 54 | 117 |
| validation | 143 | 32 | 23 | 88 |
