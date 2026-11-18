# Hiệu chuẩn zero-shot `e5-base-zs-v1` (nhãn yếu)

40 cặp khớp mạnh (CV `strong` với tin neo), 300 cặp khác ngành
(mỗi CV với 3 tin nhóm ngành khác). Tạo bằng `ml/scripts/calibrate.py`.

| Phép đo | AUC | Khác ngành: trung vị | Khớp mạnh: trung vị | Khớp mạnh: P90 |
| --- | ---: | ---: | ---: | ---: |
| toàn văn | 0.899 | 0.817 | 0.860 | 0.889 |
| chức danh | 0.935 | 0.807 | 0.873 | 0.918 |
| MaxSim yêu cầu | 0.588 | 0.821 | 0.819 | 0.864 |

Từng câu yêu cầu: cosine lớn nhất với câu CV, cặp khác ngành P80 0.838 / P95 0.855;
ở cặp khớp mạnh 17% câu yêu cầu vượt P95.
Kỹ năng: CV có kỹ năng trung vị 0.843, tin khác ngành P95 0.846;
với τ_skill = 0.846, 47% kỹ năng CV có được nhận lại bằng câu.

Kết luận: ở chế độ zero-shot, so từng câu (MaxSim) gần như không phân biệt được cặp khớp
và cặp khác ngành, nên mức liên quan dùng vector toàn văn và chức danh; MaxSim chỉ dùng để
chỉ ra câu bằng chứng cho từng yêu cầu, với ngưỡng chặt.

Mốc đặt vào `CALIBRATIONS["e5-base-zs-v1"]`:

```python
Calibration(
    document=(0.817, 0.889),
    title=(0.807, 0.918),
    skill=0.846,
    requirement_met=0.855,
    requirement_partial=0.838,
)
```
