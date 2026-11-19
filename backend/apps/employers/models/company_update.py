"""Company update requests: the request, its immutable revisions and audit trail."""

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.db.public_id import generate_public_id

from .company import Company


class CompanyUpdateRequest(models.Model):
    """Yêu cầu cập nhật thông tin công ty — công ty tạo mới có hiệu lực ngay,
    nhưng sửa về sau phải chờ admin duyệt. Đổi MST/tên công ty (`is_sensitive`)
    bắt buộc kèm lý do và giấy tờ chứng minh (`proof_type` + CompanyDocument)."""

    class ProofType(models.TextChoices):
        BUSINESS_REGISTRATION = (
            'business_registration',
            'Giấy đăng ký doanh nghiệp hoặc tương đương',
        )
        AUTHORIZATION_AND_ID = 'authorization_and_id', 'Giấy ủy quyền + giấy tờ định danh'

    class Status(models.TextChoices):
        # ``pending`` chỉ giữ để đọc dữ liệu/consumer cũ trong cửa sổ rollout.
        # Migration V2 chuyển toàn bộ record hiện hữu sang ``submitted``.
        PENDING = 'pending', 'Chờ duyệt'
        SUBMITTED = 'submitted', 'Đã gửi'
        IN_REVIEW = 'in_review', 'Đang thẩm định'
        CHANGES_REQUESTED = 'changes_requested', 'Cần chỉnh sửa'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Từ chối'
        WITHDRAWN = 'withdrawn', 'Đã rút'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='update_requests')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+'
    )
    # Snapshot {field: giá_trị_mới}; admin approve thì service apply vào Company.
    changes = models.JSONField(default=dict)
    is_sensitive = models.BooleanField(default=False)
    reason = models.TextField(blank=True)
    proof_type = models.CharField(max_length=30, choices=ProofType.choices, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    revision = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=0)
    current_revision = models.ForeignKey(
        'CompanyUpdateRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    base_company_updated_at = models.DateTimeField(null=True, blank=True)
    base_values = models.JSONField(default=dict, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    submitted_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'requested_by'],
                condition=models.Q(
                    status__in=['pending', 'submitted', 'in_review', 'changes_requested']
                ),
                name='uniq_co_requester_pending_upd',
            ),
        ]

    def __str__(self):
        return f'{self.company_id}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cur')
        super().save(*args, **kwargs)


# A requester has at most one request in these states per company.
ACTIVE_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.IN_REVIEW,
        CompanyUpdateRequest.Status.CHANGES_REQUESTED,
    }
)


# Active states that wait on an administrator (``changes_requested`` waits on
# the requester), which is what review queues count.
ADMIN_PENDING_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.IN_REVIEW,
    }
)


# Active states in which the requester may still change the request.
REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES = frozenset(
    {
        CompanyUpdateRequest.Status.PENDING,
        CompanyUpdateRequest.Status.SUBMITTED,
        CompanyUpdateRequest.Status.CHANGES_REQUESTED,
    }
)


def company_update_allowed_actions(update_request, *, user_id, is_owner):
    """What ``user_id`` may do with ``update_request`` before review starts."""
    if update_request.status not in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES:
        return []
    actions = []
    if update_request.requested_by_id == user_id:
        actions.extend(['edit', 'withdraw'])
        if update_request.status == CompanyUpdateRequest.Status.CHANGES_REQUESTED:
            actions.append('resubmit')
    if is_owner:
        actions.append('cancel')
    return actions


class CompanyUpdateRevision(models.Model):
    """Immutable requester snapshot for one company-update workflow revision."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    update_request = models.ForeignKey(
        CompanyUpdateRequest,
        on_delete=models.CASCADE,
        related_name='revisions',
    )
    number = models.PositiveIntegerField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+',
    )
    changes = models.JSONField(default=dict)
    reason = models.TextField(blank=True)
    proof_type = models.CharField(
        max_length=30,
        choices=CompanyUpdateRequest.ProofType.choices,
        blank=True,
    )
    base_company_updated_at = models.DateTimeField()
    base_values = models.JSONField(default=dict)
    documents = models.ManyToManyField(
        'CompanyDocument',
        blank=True,
        related_name='company_update_revisions',
    )
    media_uploads = models.ManyToManyField(
        'CompanyMediaUpload',
        blank=True,
        related_name='company_update_revisions',
    )
    submitted_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['update_request', 'number'],
                name='uniq_company_update_revision_number',
            ),
        ]
        ordering = ['number', 'id']

    def __str__(self):
        return f'{self.public_id}:r{self.number}'

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('CompanyUpdateRevision là snapshot bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('cuv')
        super().save(*args, **kwargs)


class CompanyUpdateEvent(models.Model):
    """Append-only audit trail for request lifecycle and attachment decisions."""

    class EventType(models.TextChoices):
        SUBMITTED = 'submitted', 'Đã gửi'
        RESUBMITTED = 'resubmitted', 'Đã gửi lại'
        REVISION_CREATED = 'revision_created', 'Đã tạo phiên bản'
        REVIEW_STARTED = 'review_started', 'Bắt đầu thẩm định'
        DOCUMENT_REVIEWED = 'document_reviewed', 'Đã xử lý giấy tờ'
        CHANGES_REQUESTED = 'changes_requested', 'Yêu cầu chỉnh sửa'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Đã từ chối'
        WITHDRAWN = 'withdrawn', 'Đã rút'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    update_request = models.ForeignKey(
        CompanyUpdateRequest,
        on_delete=models.CASCADE,
        related_name='events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    revision_number = models.PositiveIntegerField()
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(
                fields=['update_request', 'created_at'],
                name='emp_co_update_event_idx',
            ),
        ]

    def __str__(self):
        return f'{self.public_id}:{self.event_type}'

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('CompanyUpdateEvent là nhật ký bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('cue')
        super().save(*args, **kwargs)
