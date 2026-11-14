"""Trường riêng theo vị trí và job sinh nội dung mẫu bằng AI (CVT-3).

Trường riêng do admin định nghĩa cho từng `CvPositionProfile` (ví dụ GitHub cho
lập trình viên, doanh số cho nhân viên kinh doanh). Khi dựng CV, định nghĩa được
chụp vào section `position_details` của document (nhãn, kiểu, lựa chọn), nên sửa
hay xóa trường ở đây không làm hỏng CV đã tạo.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

from common.public_id import generate_public_id

from .experience import ExperienceBand
from .language import CvLanguage, catalog_language, localized_field
from .template import CvPositionProfile, CvSampleContent

FIELD_KEY_RE = r'^[a-z][a-z0-9_]{0,49}$'
MAX_FIELD_OPTIONS = 30


class CvPositionField(models.Model):
    class FieldType(models.TextChoices):
        TEXT = 'text', 'Văn bản ngắn'
        LONG_TEXT = 'long_text', 'Đoạn văn'
        URL = 'url', 'Liên kết'
        NUMBER = 'number', 'Số'
        DATE = 'date', 'Tháng/năm'
        SELECT = 'select', 'Chọn một'
        MULTI_SELECT = 'multi_select', 'Chọn nhiều'
        TAGS = 'tags', 'Thẻ'

    class MapsTo(models.TextChoices):
        NONE = 'none', 'Không'
        # Giá trị của trường thẻ/chọn nhiều được đối chiếu với taxonomy kỹ năng
        # khi lưu CV (cùng từ vựng với kỹ năng của tin tuyển dụng).
        SKILLS = 'skills', 'Kỹ năng'

    CHOICE_TYPES = frozenset({FieldType.SELECT, FieldType.MULTI_SELECT})
    LIST_TYPES = frozenset({FieldType.MULTI_SELECT, FieldType.TAGS})

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    profile = models.ForeignKey(CvPositionProfile, on_delete=models.CASCADE, related_name='fields')
    key = models.CharField(
        max_length=50,
        validators=[RegexValidator(FIELD_KEY_RE, 'Chỉ gồm chữ thường, số, gạch dưới.')],
    )
    label_vi = models.CharField(max_length=100)
    label_en = models.CharField(max_length=100)
    placeholder_vi = models.CharField(max_length=200, blank=True)
    placeholder_en = models.CharField(max_length=200, blank=True)
    field_type = models.CharField(max_length=20, choices=FieldType.choices)
    # Lựa chọn của select/multi_select: [{"vi": "...", "en": "..."}].
    options = models.JSONField(default=list, blank=True)
    maps_to = models.CharField(max_length=20, choices=MapsTo.choices, default=MapsTo.NONE)
    is_required_hint = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'pk']
        constraints = [
            models.UniqueConstraint(fields=['profile', 'key'], name='uq_cv_position_field_key'),
        ]

    def clean(self):
        errors = {}
        if self.field_type in self.CHOICE_TYPES:
            if (
                not isinstance(self.options, list)
                or not 0 < len(self.options) <= MAX_FIELD_OPTIONS
                or any(
                    not isinstance(option, dict)
                    or any(
                        not isinstance(option.get(code), str) or not 0 < len(option[code]) <= 100
                        for code in ('vi', 'en')
                    )
                    for option in self.options
                )
            ):
                errors['options'] = (
                    f'Cần 1–{MAX_FIELD_OPTIONS} lựa chọn, mỗi lựa chọn có nhãn "vi" và "en".'
                )
        elif self.options:
            errors['options'] = 'Chỉ trường chọn một/chọn nhiều mới có lựa chọn.'
        if self.maps_to == self.MapsTo.SKILLS and self.field_type not in self.LIST_TYPES:
            errors['maps_to'] = 'Chỉ trường thẻ hoặc chọn nhiều mới đối chiếu được với kỹ năng.'
        if errors:
            raise ValidationError(errors)

    def label(self, locale):
        return getattr(self, localized_field('label', locale))

    def placeholder(self, locale):
        return getattr(self, localized_field('placeholder', locale))

    def option_labels(self, locale):
        code = catalog_language(locale).field_suffix
        return [option[code] for option in self.options]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvfld')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.profile}: {self.key}'


class CvSampleGeneration(models.Model):
    """Một lượt sinh nội dung mẫu bằng AI cho (vị trí, ngôn ngữ, nhóm kinh nghiệm).

    Các lượt cùng một yêu cầu của admin chung `batch_id`. Kết quả là một
    `CvSampleContent` ở trạng thái chờ duyệt; lượt lỗi chỉ lưu mã lỗi đã chuẩn
    hóa, không lưu prompt hay phản hồi của provider.
    """

    class Status(models.TextChoices):
        QUEUED = 'queued', 'Đang chờ'
        PROCESSING = 'processing', 'Đang sinh'
        COMPLETED = 'completed', 'Hoàn tất'
        FAILED = 'failed', 'Lỗi'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    batch_id = models.CharField(max_length=50, db_index=True)
    position_profile = models.ForeignKey(
        CvPositionProfile, on_delete=models.CASCADE, related_name='sample_generations'
    )
    locale = models.CharField(max_length=16, choices=CvLanguage.choices)
    experience_band = models.CharField(max_length=20, choices=ExperienceBand.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    failure_code = models.CharField(max_length=64, blank=True)
    sample = models.ForeignKey(
        CvSampleContent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generations',
    )
    invocation = models.ForeignKey(
        'ai_core.AiInvocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cv_sample_generations',
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_cv_sample_generations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-pk']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='idx_cv_sample_gen_status'),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvgen')
        super().save(*args, **kwargs)
