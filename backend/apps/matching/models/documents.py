from django.db import models
from pgvector.django import VectorField

# Số chiều của `intfloat/multilingual-e5-base`. Đổi sang mô hình khác số chiều
# thì phải có migration đổi kích thước cột và tính lại toàn bộ vector.
EMBEDDING_DIMENSIONS = 768


class MatchDocument(models.Model):
    """Hồ sơ đã chuẩn hóa và vector của một phiên bản CV hoặc một nội dung tin tuyển dụng.

    Mỗi hàng ứng với đúng một bộ (nguồn, nội dung, phiên bản trích xuất, phiên bản
    mô hình). CV/JD đổi nội dung hay đổi mô hình thì sinh hàng mới chứ không ghi
    đè, nên hàng đã có đóng vai trò cache.
    """

    class Kind(models.TextChoices):
        CV = 'cv', 'CV'
        JOB = 'job', 'Tin tuyển dụng'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Chờ xử lý'
        READY = 'ready', 'Sẵn sàng'
        FAILED = 'failed', 'Thất bại'

    kind = models.CharField(max_length=8, choices=Kind.choices)
    cv_version = models.ForeignKey(
        'cvs.CvVersion',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='match_documents',
    )
    job = models.ForeignKey(
        'jobs.Job',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='match_documents',
    )
    content_hash = models.CharField(max_length=64)
    language = models.CharField(max_length=8, blank=True)
    profile_json = models.JSONField(default=dict, blank=True)
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)
    extractor_version = models.CharField(max_length=32)
    model_version = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    error_code = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(kind='cv', cv_version__isnull=False, job__isnull=True)
                    | models.Q(kind='job', job__isnull=False, cv_version__isnull=True)
                ),
                name='chk_match_document_source',
            ),
            models.UniqueConstraint(
                fields=['cv_version', 'content_hash', 'extractor_version', 'model_version'],
                condition=models.Q(kind='cv'),
                name='uq_match_document_cv',
            ),
            models.UniqueConstraint(
                fields=['job', 'content_hash', 'extractor_version', 'model_version'],
                condition=models.Q(kind='job'),
                name='uq_match_document_job',
            ),
        ]

    def __str__(self):
        return f'{self.kind}: {self.content_hash[:12]}'


class MatchChunk(models.Model):
    """Một đoạn của tài liệu (một mục kinh nghiệm, một dòng yêu cầu…) kèm vector.

    Điểm ngữ nghĩa được tính ở mức đoạn, nên mỗi đoạn giữ vector riêng. Tập giá
    trị của `section` do bước trích xuất quy định.
    """

    document = models.ForeignKey(MatchDocument, on_delete=models.CASCADE, related_name='chunks')
    position = models.PositiveSmallIntegerField()
    section = models.CharField(max_length=32)
    text = models.TextField()
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['document', 'position'], name='uq_match_chunk_document_position'
            ),
        ]
        ordering = ['document_id', 'position']

    def __str__(self):
        return f'{self.document_id}#{self.position}'
