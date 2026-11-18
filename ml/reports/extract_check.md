# So sánh thư viện đọc PDF

51 PDF của kho CV tổng hợp; đáp án là từ vựng của JSON gốc cùng mã.
Tạo bằng `ml/scripts/extract_check.py`.

| Nhóm | Số tệp | Cách đọc | Từ bị tách (TB) | Từ bị tách (max) | Độ phủ (TB) |
| --- | ---: | --- | ---: | ---: | ---: |
| Tất cả | 51 | pypdf | 6.14% | 30.08% | 73.86% |
| Tất cả | 51 | pypdf + NFC | 6.14% | 30.08% | 73.86% |
| Tất cả | 51 | pypdfium2 + NFC | 0.00% | 0.00% | 86.71% |
| Tiếng Việt | 34 | pypdf | 9.07% | 30.08% | 67.98% |
| Tiếng Việt | 34 | pypdf + NFC | 9.07% | 30.08% | 67.98% |
| Tiếng Việt | 34 | pypdfium2 + NFC | 0.00% | 0.00% | 86.61% |
| Tiếng Anh | 17 | pypdf | 0.30% | 1.28% | 85.61% |
| Tiếng Anh | 17 | pypdf + NFC | 0.30% | 1.28% | 85.61% |
| Tiếng Anh | 17 | pypdfium2 + NFC | 0.00% | 0.00% | 86.89% |
| pdf/system | 15 | pypdf | 13.90% | 28.74% | 68.70% |
| pdf/system | 15 | pypdf + NFC | 13.90% | 28.74% | 68.70% |
| pdf/system | 15 | pypdfium2 + NFC | 0.00% | 0.00% | 99.66% |
| pdf/topcv | 36 | pypdf | 2.91% | 30.08% | 76.00% |
| pdf/topcv | 36 | pypdf + NFC | 2.91% | 30.08% | 76.00% |
| pdf/topcv | 36 | pypdfium2 + NFC | 0.00% | 0.00% | 81.31% |

Năm tệp có độ phủ thấp nhất với `pypdfium2 + NFC`:

- `topcv/CV-070.pdf` (vi): độ phủ 61.45%, tách 0.00%
- `topcv/CV-044.pdf` (vi): độ phủ 62.71%, tách 0.00%
- `topcv/CV-034.pdf` (vi): độ phủ 68.18%, tách 0.00%
- `topcv/CV-065.pdf` (en): độ phủ 70.24%, tách 0.00%
- `topcv/CV-090.pdf` (en): độ phủ 71.56%, tách 0.00%
