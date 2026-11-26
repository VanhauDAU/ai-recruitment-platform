"""Bước 1 của đối sánh: CV và tin tuyển dụng → hồ sơ chuẩn hóa `profile_json`.

`profile_json` là đầu vào chung của bước tính vector và chấm điểm (kế hoạch mục 6).

| Tệp | Việc |
| --- | --- |
| `text.py` | Chuẩn hóa văn bản, tách câu, nhận diện ngôn ngữ |
| `facts.py` | Đọc thông tin có cấu trúc từ một dòng chữ: khoảng ngày, bậc học, cấp bậc, ngoại ngữ |
| `profile.py` | Chia chunk và lắp `profile_json` (dùng chung cho mọi nguồn CV) |
| `cv_builder.py` | CV dựng bằng CV builder (`CvVersion.content_json`) |
| `cv_upload.py` | CV tải lên (văn bản đọc từ PDF/DOCX) |
| `job.py` | Tin tuyển dụng |

Nhận diện kỹ năng nằm ở `services/skills.py`.

Quy tắc chống bịa dữ liệu (kế hoạch mục 6b):

- mỗi kỹ năng có `source` và `evidence` là câu trích nguyên văn từ tài liệu;
- số tháng kinh nghiệm, bậc học, cấp bậc, ngoại ngữ chỉ lấy từ thông tin tài
  liệu ghi rõ; không xác định được thì để `None`/rỗng và ghi tên tiêu chí vào
  `quality.missing`, không đoán;
- chunk không chứa email hay số điện thoại;
- cùng đầu vào luôn cho cùng `profile_json` (trừ tháng hiện tại khi CV ghi "đến nay").
"""

from .cv_builder import cv_profile
from .cv_upload import text_cv_profile
from .job import job_profile, job_text_chunks
from .profile import EXTRACTOR_VERSION, ExtractionError

__all__ = [
    'EXTRACTOR_VERSION',
    'ExtractionError',
    'cv_profile',
    'job_profile',
    'job_text_chunks',
    'text_cv_profile',
]
