# Ngưỡng điểm tối thiểu (30 điểm) khi đổi mô hình

100 CV tổng hợp × 100 tin thật, nhãn yếu của kho CV. "Số cặp" là số cặp neo nằm trong nhóm ứng viên mà hệ thống
đem ra chấm (tin hoặc CV gần nhất theo vector). "Không liên quan": khác vị trí chuyên môn và không neo vào tin.
Tạo bằng `ml/scripts/check_score_floor.py`.

## Gợi ý việc làm (`MIN_SEMANTIC_SCORE`)

| Mô hình | Khớp mạnh: số cặp | điểm P5 / trung vị | dưới ngưỡng | Khớp một phần: số cặp | điểm P5 / trung vị | dưới ngưỡng | Không liên quan: trung vị / P90 / P99 | từ ngưỡng trở lên | Kết quả giữ lại mỗi lượt (trung vị) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `e5-base-zs-v1` | 38 | 31 / 69 | 0 | 39 | 24 / 57 | 4 | 11 / 31 / 48 | 623 / 5559 | 6 |
| `e5-base-wise-v1` | 40 | 49 / 82 | 0 | 40 | 38 / 72 | 1 | 9 / 29 / 51 | 495 / 5201 | 7 |

## Tìm CV (`MIN_SEARCH_SCORE`)

| Mô hình | Khớp mạnh: số cặp | điểm P5 / trung vị | dưới ngưỡng | Khớp một phần: số cặp | điểm P5 / trung vị | dưới ngưỡng | Không liên quan: trung vị / P90 / P99 | từ ngưỡng trở lên | Kết quả giữ lại mỗi lượt (trung vị) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `e5-base-zs-v1` | 40 | 47 / 78 | 0 | 40 | 30 / 60 | 1 | 6 / 26 / 51 | 741 / 9676 | 7 |
| `e5-base-wise-v1` | 40 | 56 / 85 | 0 | 40 | 47 / 68 | 0 | 3 / 23 / 49 | 605 / 9676 | 8 |
