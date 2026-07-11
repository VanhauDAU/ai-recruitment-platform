from django.conf import settings
from django.db import models


class PhoneOtp(models.Model):
    """OTP xác thực số điện thoại. Hiện gửi qua email (chưa có SMS gateway),
    schema sẵn sàng cho SMS. Chỉ lưu hash, không lưu mã gốc."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='phone_otps')
    phone = models.CharField(max_length=20)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at'], name='phone_otp_user_created_idx'),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.phone}'
