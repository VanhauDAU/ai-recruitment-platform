"""Cấu hình CV theo vị trí chuyên môn: profile của vị trí và trường riêng (CVT-3).

Trường riêng do admin định nghĩa cho từng `CvPositionProfile` (ví dụ GitHub cho
lập trình viên, doanh số cho nhân viên kinh doanh). Khi dựng CV, định nghĩa được
chụp vào section `position_details` của document (nhãn, kiểu, lựa chọn), nên sửa
hay xóa trường ở đây không làm hỏng CV đã tạo.
"""

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

from common.db.public_id import generate_public_id

from ..domain.section_registry import get_section_contract
from .language import catalog_language, localized_field

FIELD_KEY_RE = r'^[a-z][a-z0-9_]{0,49}$'
MAX_FIELD_OPTIONS = 30


class CvPositionProfile(models.Model):
    """Cấu hình CV cho một vị trí chuyên môn.

    Gắn 1-1 với `JobCategory(category_type=specialization)` — cùng taxonomy với
    tin tuyển dụng, nên tên, slug và bản dịch của vị trí lấy từ `JobCategory`
    thay vì lưu lặp ở đây. Vị trí chỉ xuất hiện ở ô chọn của trang mẫu CV khi có
    profile đang bật.
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    job_category = models.OneToOneField(
        'jobs.JobCategory',
        on_delete=models.CASCADE,
        related_name='cv_position_profile',
    )
    # Thứ tự và trạng thái bật của section khi dựng CV từ nội dung mẫu của vị
    # trí, ví dụ [{"section_key": "skills", "enabled": true}, ...]. Rỗng = giữ
    # nguyên thứ tự của nội dung mẫu.
    section_preset = models.JSONField(default=list, blank=True)
    # Từ khóa kỹ năng gợi ý của vị trí (dùng cho prompt sinh nội dung mẫu và đối
    # chiếu vị trí khi trích xuất CV tải lên).
    keywords = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    MAX_KEYWORDS = 30

    class Meta:
        ordering = ['sort_order', 'pk']

    def __str__(self):
        return self.job_category.name

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvpos')
        super().save(*args, **kwargs)

    def clean(self):
        # Nạp lười: jobs.models gián tiếp nạp cv_templates.models lúc khởi động.
        from apps.jobs.models import JobCategory

        if self.job_category.category_type != JobCategory.CategoryType.SPECIALIZATION:
            raise ValidationError({'job_category': 'Chỉ gắn với vị trí chuyên môn.'})
        if not isinstance(self.section_preset, list):
            raise ValidationError({'section_preset': 'Phải là danh sách.'})
        keys = []
        for entry in self.section_preset:
            key = entry.get('section_key') if isinstance(entry, dict) else None
            if not get_section_contract(key) or not isinstance(entry.get('enabled', True), bool):
                raise ValidationError({'section_preset': f'Section không hợp lệ: {entry!r}.'})
            keys.append(key)
        if len(keys) != len(set(keys)):
            raise ValidationError({'section_preset': 'Section bị lặp.'})
        if (
            not isinstance(self.keywords, list)
            or len(self.keywords) > self.MAX_KEYWORDS
            or any(
                not isinstance(word, str) or not 0 < len(word.strip()) <= 60
                for word in self.keywords
            )
        ):
            raise ValidationError(
                {'keywords': f'Tối đa {self.MAX_KEYWORDS} từ khóa, mỗi từ khóa 1–60 ký tự.'}
            )


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

    def __str__(self):
        return f'{self.profile}: {self.key}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('cvfld')
        super().save(*args, **kwargs)

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
