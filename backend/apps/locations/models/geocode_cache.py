from django.db import models


class GeocodeCache(models.Model):
    """Kết quả geocoding theo khóa địa chỉ chuẩn hóa — tránh gọi lại provider mỗi lần
    tin được lưu (job_locations bị xóa-tạo-lại) hoặc ứng viên chọn lại cùng gợi ý."""

    class Status(models.TextChoices):
        FOUND = 'found', 'Found'
        NOT_FOUND = 'not_found', 'Not found'

    query_key = models.CharField(max_length=500, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    label = models.CharField(max_length=500, blank=True)
    provider = models.CharField(max_length=20)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.query_key} → {self.status}'
