from django.conf import settings
from django.db import models
from django.utils import timezone

from common.public_id import generate_public_id

from .company import Company


class EmployerVerificationCase(models.Model):
    """Account-scoped proof that one recruiter may represent one company."""

    class VerificationMethod(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', 'Giấy đăng ký doanh nghiệp'
        AUTHORIZATION_AND_ID = 'authorization_and_id', 'Giấy ủy quyền + giấy tờ định danh'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Chưa nộp'
        PENDING = 'pending', 'Chờ duyệt'
        IN_REVIEW = 'in_review', 'Đang xử lý'
        CHANGES_REQUESTED = 'changes_requested', 'Cần bổ sung'
        REJECTED = 'rejected', 'Bị từ chối'
        APPROVED = 'approved', 'Đã xác thực'
        REVOKED = 'revoked', 'Đã thu hồi'
        EXPIRED = 'expired', 'Hết hiệu lực'

    class DecisionSource(models.TextChoices):
        EXPLICIT_ADMIN = 'explicit_admin', 'Quyết định quản trị tường minh'
        LEGACY_AUTO = 'legacy_auto', 'Tự duyệt lịch sử'
        LEGACY_UNKNOWN = 'legacy_unknown', 'Không xác định nguồn lịch sử'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    recruiter = models.OneToOneField(
        'employers.RecruiterProfile',
        on_delete=models.CASCADE,
        related_name='verification_case',
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='recruiter_verification_cases',
    )
    verification_method = models.CharField(
        max_length=30,
        choices=VerificationMethod.choices,
        blank=True,
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    revision = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=0)
    final_rejection_count = models.PositiveSmallIntegerField(default=0)
    resubmission_locked_at = models.DateTimeField(null=True, blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    review_started_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.TextField(blank=True)
    decision_source = models.CharField(
        max_length=24,
        choices=DecisionSource.choices,
        blank=True,
    )
    decision_snapshot = models.JSONField(default=dict, blank=True)
    tax_override_reason = models.TextField(blank=True)
    tax_override_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at', '-updated_at']
        indexes = [
            models.Index(
                fields=['status', '-submitted_at'],
                name='emp_verify_status_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('evc')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.recruiter_id}:{self.status}'


class EmployerVerificationEvent(models.Model):
    """Append-only event timeline for an employer verification case."""

    class EventType(models.TextChoices):
        SUBMITTED = 'submitted', 'Đã nộp'
        REVIEW_STARTED = 'review_started', 'Bắt đầu xử lý'
        DOCUMENT_REVIEWED = 'document_reviewed', 'Đã xử lý giấy tờ'
        DOCUMENT_REPLACED = 'document_replaced', 'Đã thay giấy tờ'
        CHANGES_REQUESTED = 'changes_requested', 'Yêu cầu bổ sung'
        RESUBMITTED = 'resubmitted', 'Đã nộp lại'
        RESUBMISSION_UNLOCKED = 'resubmission_unlocked', 'Đã mở khóa nộp lại'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Đã từ chối'
        REVOKED = 'revoked', 'Đã thu hồi'
        EXPIRED = 'expired', 'Hết hiệu lực'
        REAPPROVED = 'reapproved', 'Đã duyệt lại'
        HOLD_APPLIED = 'hold_applied', 'Đã áp dụng compliance hold'
        HOLD_RELEASED = 'hold_released', 'Đã gỡ compliance hold'
        SENSITIVE_VIEWED = 'sensitive_viewed', 'Đã xem dữ liệu nhạy cảm'
        TAX_LOOKUP_REFRESHED = 'tax_lookup_refreshed', 'Đã tra cứu lại mã số thuế'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        related_name='events',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(
                fields=['verification_case', '-created_at'],
                name='emp_verify_event_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('eve')
        super().save(*args, **kwargs)


class EmployerVerificationNotification(models.Model):
    """Transactional outbox for recruiter-facing verification results."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ gửi'
        SENDING = 'sending', 'Đang gửi'
        SENT = 'sent', 'Đã gửi'
        FAILED = 'failed', 'Gửi thất bại'

    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        related_name='notification_jobs',
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
    )
    event_type = models.CharField(max_length=32)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    context = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(
                fields=['status', 'created_at'],
                name='emp_verify_notice_queue_idx',
            ),
        ]


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

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cur')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.company_id}:{self.status}'


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

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValueError('CompanyUpdateEvent là nhật ký bất biến.')
        if not self.public_id:
            self.public_id = generate_public_id('cue')
        super().save(*args, **kwargs)


class CompanyTaxLookupEvidence(models.Model):
    """Immutable VietQR lookup evidence for one submitted workflow revision."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Đang tra cứu'
        FOUND = 'found', 'Đã tìm thấy'
        NOT_FOUND = 'not_found', 'Không tìm thấy'
        UNAVAILABLE = 'unavailable', 'Nguồn không khả dụng'
        INVALID_RESPONSE = 'invalid_response', 'Phản hồi không hợp lệ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    provider = models.CharField(max_length=30, default='vietqr', editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='tax_lookup_evidences',
    )
    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tax_lookup_evidences',
    )
    update_request = models.ForeignKey(
        CompanyUpdateRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tax_lookup_evidences',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    workflow_revision = models.PositiveIntegerField()
    tax_code = models.CharField(max_length=100)
    submitted_company_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    returned_tax_code = models.CharField(max_length=100, blank=True)
    registered_name = models.CharField(max_length=255, blank=True)
    international_name = models.CharField(max_length=255, blank=True)
    short_name = models.CharField(max_length=255, blank=True)
    provider_code = models.CharField(max_length=40, blank=True)
    provider_description = models.CharField(max_length=500, blank=True)
    response_hash = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(verification_case__isnull=False, update_request__isnull=True)
                    | models.Q(verification_case__isnull=True, update_request__isnull=False)
                ),
                name='tax_lookup_evidence_exactly_one_workflow',
            ),
        ]
        indexes = [
            models.Index(
                fields=['company', 'tax_code', '-created_at'],
                name='company_tax_lookup_time_idx',
            ),
            models.Index(
                fields=['status', '-created_at'],
                name='tax_lookup_status_time_idx',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tle')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.tax_code}:{self.status}:r{self.workflow_revision}'


class CompanyDocument(models.Model):
    """Giấy tờ xác thực của công ty và văn bản DLCN của nhà tuyển dụng.

    `uploaded_by` SET_NULL: giấy tờ pháp lý thuộc về công ty, không mất khi
    tài khoản người upload bị xóa. Các giấy tờ công ty gắn `company`; riêng
    văn bản DLCN ứng viên gắn `recruiter` để nhà tuyển dụng có thể cập nhật
    trước khi hoàn thiện thông tin công ty. Gắn `update_request` khi là hồ sơ
    đính kèm yêu cầu cập nhật.
    """

    class DocType(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', 'Giấy đăng ký doanh nghiệp'
        TRADE_NAME_PROOF = 'trade_name_proof', 'Chứng minh tên thương mại'
        AUTHORIZATION_LETTER = 'authorization_letter', 'Giấy ủy quyền'
        IDENTITY_DOCUMENT = 'identity_document', 'Giấy tờ định danh (CCCD/hộ chiếu)'
        DATA_PROCESSING_AGREEMENT = 'data_processing_agreement', 'Thỏa thuận xử lý dữ liệu cá nhân'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ duyệt'
        CHANGES_REQUESTED = 'changes_requested', 'Cần bổ sung'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Từ chối'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, null=True, blank=True, related_name='documents'
    )
    recruiter = models.ForeignKey(
        'employers.RecruiterProfile',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='personal_documents',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    update_request = models.ForeignKey(
        CompanyUpdateRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='documents',
    )
    update_revision = models.ForeignKey(
        CompanyUpdateRevision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='attached_documents',
    )
    verification_case = models.ForeignKey(
        EmployerVerificationCase,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='documents',
    )
    supersedes = models.OneToOneField(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='superseded_by',
    )
    version = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(default=True)
    doc_type = models.CharField(max_length=30, choices=DocType.choices)
    file_url = models.TextField()
    file_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, db_index=True)
    upload_asset = models.OneToOneField(
        'uploads.UploadAsset',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='employer_document',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(doc_type='data_processing_agreement')
                | models.Q(company__isnull=False),
                name='company_document_requires_company_unless_dpa',
            ),
            models.UniqueConstraint(
                fields=['verification_case', 'doc_type'],
                condition=(
                    models.Q(is_current=True, verification_case__isnull=False)
                    & ~models.Q(doc_type='identity_document')
                ),
                name='uniq_current_single_verification_doc_type',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('doc')
        super().save(*args, **kwargs)

    def __str__(self):
        owner = self.company_id or f'recruiter-{self.recruiter_id}'
        return f'{owner}:{self.doc_type}:v{self.version}:{self.status}'
