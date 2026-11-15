from django.db import models


class ApplicationReminder(models.Model):
    """One nudge sent to the recruiter about an application still unanswered.

    The candidate sees each one in the application's timeline ("ProCV đã nhắc
    nhà tuyển dụng phản hồi CV của bạn").
    """

    class Source(models.TextChoices):
        SYSTEM = 'system', 'Hệ thống tự nhắc'
        CANDIDATE = 'candidate', 'Ứng viên yêu cầu nhắc'

    application = models.ForeignKey(
        'applications.Application', on_delete=models.CASCADE, related_name='reminders'
    )
    source = models.CharField(max_length=16, choices=Source.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['application', 'source'], name='app_reminder_source_idx'),
        ]
