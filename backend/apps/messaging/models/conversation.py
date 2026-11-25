"""Hội thoại (tin tuyển dụng, ứng viên) và tin nhắn của nó.

Phía NTD không lưu cố định: luôn là người đang phụ trách tin (``job.posted_by``),
nên bàn giao tin là đủ để hội thoại đi theo, không cần đồng bộ thêm. Trạng thái
đọc và số chưa đọc lưu theo từng phía, không theo từng người.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from common.db.public_id import generate_public_id

from ..domain import Role


class Conversation(models.Model):
    class Origin(models.TextChoices):
        APPLICATION = 'application', 'Application'
        INVITATION = 'invitation', 'Connection invitation'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job = models.ForeignKey('jobs.Job', on_delete=models.CASCADE, related_name='conversations')
    company = models.ForeignKey(
        'employers.Company', on_delete=models.CASCADE, related_name='conversations'
    )
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='candidate_conversations'
    )
    origin = models.CharField(max_length=20, choices=Origin.choices)
    last_seq = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_message_preview = models.CharField(max_length=160, blank=True)
    last_message_kind = models.CharField(max_length=20, blank=True)
    last_sender_role = models.CharField(max_length=20, blank=True)
    candidate_last_read_seq = models.PositiveIntegerField(default=0)
    recruiter_last_read_seq = models.PositiveIntegerField(default=0)
    candidate_unread = models.PositiveIntegerField(default=0)
    recruiter_unread = models.PositiveIntegerField(default=0)
    # Email nhắc tin chưa đọc đã báo tới seq này (GĐ5); đọc xong thì lần sau báo lại.
    candidate_emailed_seq = models.PositiveIntegerField(default=0)
    recruiter_emailed_seq = models.PositiveIntegerField(default=0)
    recruiter_replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'candidate'], name='uniq_conversation_job_candidate'
            )
        ]
        indexes = [
            models.Index(
                fields=['candidate', '-last_message_at'], name='conv_candidate_recent_idx'
            ),
            models.Index(fields=['job', '-last_message_at'], name='conv_job_recent_idx'),
            models.Index(fields=['company', 'candidate'], name='conv_company_candidate_idx'),
        ]

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cnv')
        super().save(*args, **kwargs)

    def last_read_seq(self, role):
        return (
            self.candidate_last_read_seq if role == Role.CANDIDATE else self.recruiter_last_read_seq
        )

    def unread(self, role):
        return self.candidate_unread if role == Role.CANDIDATE else self.recruiter_unread


class Message(models.Model):
    class Kind(models.TextChoices):
        TEXT = 'text', 'Text'
        JOB = 'job', 'Job card'
        CV = 'cv', 'CV'
        FILE = 'file', 'File'
        IMAGE = 'image', 'Image'
        INTERVIEW = 'interview', 'Interview'
        SYSTEM = 'system', 'System'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages'
    )
    seq = models.PositiveIntegerField()
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_messages',
    )
    sender_role = models.CharField(max_length=20)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    body = models.TextField(blank=True)
    # Ảnh chụp thẻ (tin, CV, sự kiện hệ thống) lúc gửi: không đổi theo dữ liệu gốc.
    payload = models.JSONField(default=dict, blank=True)
    shared_job = models.ForeignKey(
        'jobs.Job', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    cv_version = models.ForeignKey(
        'cvs.CvVersion', on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    interview = models.ForeignKey(
        'messaging.InterviewAppointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='messages',
    )
    attachment_key = models.CharField(max_length=500, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_type = models.CharField(max_length=120, blank=True)
    attachment_size = models.PositiveIntegerField(default=0)
    client_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    erased_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['conversation', 'seq'], name='uniq_message_seq'),
            models.UniqueConstraint(
                fields=['sender', 'client_id'],
                condition=Q(client_id__isnull=False),
                name='uniq_message_client_id',
            ),
        ]
        ordering = ['seq']

    def __str__(self):
        return self.public_id

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('msg')
        super().save(*args, **kwargs)
