# Cổng chất lượng kho CV huấn luyện

1073 CV sinh bằng `qwen2.5:7b` cho 70 tin ngoài tập vàng; 869 CV qua cổng (81%). Tạo bằng `ml/scripts/quality_gate.py`.

CV qua cổng theo mức khớp dự kiến: strong 431, adjacent 224, partial 214.

| Lý do bị loại | Số CV |
| --- | ---: |
| phần chữ thiếu kỹ năng đã chọn | 204 |
| chưa bổ sung ngoại ngữ và mục phụ | 1 |
