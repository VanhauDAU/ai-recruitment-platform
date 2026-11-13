"""Nhóm kinh nghiệm của nội dung CV mẫu (CVT-1b).

Mỗi nhóm tương ứng một khoảng của `Job.ExperienceYears` (số năm kinh nghiệm JD
yêu cầu) để nội dung mẫu, trường matching của CV và bộ lọc tin tuyển dụng dùng
chung một từ vựng (kế hoạch CVT-v3, mục 5.6): entry = none/under_1,
junior = 1/2, mid = 3/4, senior = 5/over_5.
"""

from django.db import models


class ExperienceBand(models.TextChoices):
    ENTRY = 'entry', 'Dưới 1 năm'
    JUNIOR = 'junior', '1–2 năm'
    MID = 'mid', '3–4 năm'
    SENIOR = 'senior', 'Từ 5 năm'


DEFAULT_EXPERIENCE_BAND = ExperienceBand.JUNIOR

# Thứ tự tăng dần, dùng để chọn nhóm gần nhất khi thiếu nội dung đúng nhóm.
EXPERIENCE_BAND_ORDER = tuple(ExperienceBand)
