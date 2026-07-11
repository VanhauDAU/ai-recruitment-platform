from django.conf import settings
from django.db import models

from common.public_id import generate_public_id

from .company import Company


class CompanyUpdateRequest(models.Model):
    """Yêu cầu cập nhật thông tin công ty — công ty tạo mới có hiệu lực ngay,
    nhưng sửa về sau phải chờ admin duyệt. Đổi MST/tên công ty (`is_sensitive`)
    bắt buộc kèm lý do và giấy tờ chứng minh (`proof_type` + CompanyDocument)."""

    class ProofType(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', 'Giấy đăng ký doanh nghiệp hoặc tương đương'
        AUTHORIZATION_AND_ID = 'authorization_and_id', 'Giấy ủy quyền + giấy tờ định danh'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ duyệt'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Từ chối'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='update_requests')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    # Snapshot {field: giá_trị_mới}; admin approve thì service apply vào Company.
    changes = models.JSONField(default=dict)
    is_sensitive = models.BooleanField(default=False)
    reason = models.TextField(blank=True)
    proof_type = models.CharField(max_length=30, choices=ProofType.choices, blank=True)
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
            models.UniqueConstraint(
                fields=['company'],
                condition=models.Q(status='pending'),
                name='uniq_company_pending_update_request',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cur')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.company_id}:{self.status}'


class CompanyDocument(models.Model):
    """Giấy tờ xác thực của công ty (ĐKDN, ủy quyền, định danh, DLCN...).

    `uploaded_by` SET_NULL: giấy tờ pháp lý thuộc về công ty, không mất khi
    tài khoản người upload bị xóa. Gắn `update_request` khi là hồ sơ đính kèm
    yêu cầu cập nhật; gắn với luồng join công ty qua `uploaded_by` + company.
    """

    class DocType(models.TextChoices):
        BUSINESS_REGISTRATION = 'business_registration', 'Giấy đăng ký doanh nghiệp'
        TRADE_NAME_PROOF = 'trade_name_proof', 'Chứng minh tên thương mại'
        AUTHORIZATION_LETTER = 'authorization_letter', 'Giấy ủy quyền'
        IDENTITY_DOCUMENT = 'identity_document', 'Giấy tờ định danh (CCCD/hộ chiếu)'
        DATA_PROCESSING_AGREEMENT = 'data_processing_agreement', 'Thỏa thuận xử lý dữ liệu cá nhân'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ duyệt'
        APPROVED = 'approved', 'Đã duyệt'
        REJECTED = 'rejected', 'Từ chối'

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='documents')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+'
    )
    update_request = models.ForeignKey(
        CompanyUpdateRequest, on_delete=models.CASCADE, null=True, blank=True, related_name='documents'
    )
    doc_type = models.CharField(max_length=30, choices=DocType.choices)
    file_url = models.TextField()
    file_name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.company_id}:{self.doc_type}:{self.status}'

