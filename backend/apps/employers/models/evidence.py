"""Proof behind verification cases and update requests: tax lookups and uploaded documents."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy

from common.db.public_id import generate_public_id

from .company import Company
from .company_update import CompanyUpdateRequest, CompanyUpdateRevision
from .verification import EmployerVerificationCase


class CompanyTaxLookupEvidence(models.Model):
    """Immutable VietQR lookup evidence for one submitted workflow revision."""

    class Status(models.TextChoices):
        PENDING = 'pending', gettext_lazy('Đang tra cứu')
        FOUND = 'found', gettext_lazy('Đã tìm thấy')
        NOT_FOUND = 'not_found', gettext_lazy('Không tìm thấy')
        UNAVAILABLE = 'unavailable', gettext_lazy('Nguồn không khả dụng')
        INVALID_RESPONSE = 'invalid_response', gettext_lazy('Phản hồi không hợp lệ')

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

    def __str__(self):
        return f'{self.tax_code}:{self.status}:r{self.workflow_revision}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('tle')
        super().save(*args, **kwargs)


class CompanyDocument(models.Model):
    """Giấy tờ xác thực của công ty và văn bản DLCN của nhà tuyển dụng.

    `uploaded_by` SET_NULL: giấy tờ pháp lý thuộc về công ty, không mất khi
    tài khoản người upload bị xóa. Các giấy tờ công ty gắn `company`; riêng
    văn bản DLCN ứng viên gắn `recruiter` để nhà tuyển dụng có thể cập nhật
    trước khi hoàn thiện thông tin công ty. Gắn `update_request` khi là hồ sơ
    đính kèm yêu cầu cập nhật.
    """

    class DocType(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', gettext_lazy('Giấy đăng ký doanh nghiệp')
        TRADE_NAME_PROOF = 'trade_name_proof', gettext_lazy('Chứng minh tên thương mại')
        AUTHORIZATION_LETTER = 'authorization_letter', gettext_lazy('Giấy ủy quyền')
        IDENTITY_DOCUMENT = 'identity_document', gettext_lazy('Giấy tờ định danh (CCCD/hộ chiếu)')
        DATA_PROCESSING_AGREEMENT = (
            'data_processing_agreement',
            gettext_lazy('Thỏa thuận xử lý dữ liệu cá nhân'),
        )

    class Status(models.TextChoices):
        PENDING = 'pending', gettext_lazy('Chờ duyệt')
        CHANGES_REQUESTED = 'changes_requested', gettext_lazy('Cần bổ sung')
        APPROVED = 'approved', gettext_lazy('Đã duyệt')
        REJECTED = 'rejected', gettext_lazy('Từ chối')

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

    def __str__(self):
        owner = self.company_id or f'recruiter-{self.recruiter_id}'
        return f'{owner}:{self.doc_type}:v{self.version}:{self.status}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('doc')
        super().save(*args, **kwargs)
