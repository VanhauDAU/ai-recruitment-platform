from django.conf import settings
from django.db import models

from ..domain.flash_badge import response_rate


class RecruiterResponsiveness(models.Model):
    """Ảnh chụp mức phản hồi của một người đăng tin tại một công ty (Huy hiệu Sấm Chớp).

    Task định kỳ ghi lại; ``Job.has_flash_badge`` là phép chiếu của ``qualified``
    xuống từng tin công khai. Không ai sửa tay (ADR-0027).
    """

    company = models.ForeignKey('employers.Company', on_delete=models.CASCADE, related_name='+')
    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+'
    )
    # Hồ sơ trong cửa sổ xét đã quá hạn phản hồi, và số được quyết định kịp.
    matured_count = models.PositiveIntegerField(default=0)
    on_time_count = models.PositiveIntegerField(default=0)
    avg_response_hours = models.FloatField(null=True, blank=True)
    last_decision_at = models.DateTimeField(null=True, blank=True)
    # Hồ sơ đang chờ quá hạn trên các tin công khai của người này.
    overdue_count = models.PositiveIntegerField(default=0)
    qualified = models.BooleanField(default=False)
    qualified_since = models.DateTimeField(null=True, blank=True)
    computed_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'recruiter'], name='recruiter_responsiveness_unique'
            )
        ]

    def __str__(self):
        return f'{self.company_id}/{self.recruiter_id}: {self.qualified}'

    @property
    def response_rate(self):
        return response_rate(self.matured_count, self.on_time_count)
