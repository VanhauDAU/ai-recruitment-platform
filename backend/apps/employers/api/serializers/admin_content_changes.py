"""Post-moderation of company page content for administrators."""

from drf_spectacular.utils import extend_schema_field, inline_serializer
from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import CompanyContentChange
from ...selectors.company_page_content_form import SECTION_REQUEST_KEYS

FIELD_ORDER = (
    ('headline', 'Khẩu hiệu'),
    ('logo_url', 'Logo'),
    ('cover_image_url', 'Ảnh bìa'),
    ('description', 'Giới thiệu'),
    ('benefits', 'Phúc lợi'),
    ('employee_benefits', 'Phúc lợi (mô tả)'),
    ('culture', 'Văn hoá'),
    ('gallery_additions', 'Ảnh thư viện mới'),
    ('gallery_deletions', 'Ảnh thư viện đã xoá'),
    ('video_url', 'Video'),
    ('social_links', 'Mạng xã hội'),
    ('offices', 'Văn phòng'),
)
MEDIA_FIELDS = {'logo_url', 'cover_image_url'}
# How each field is drawn: plain text, sanitized rich text, image(s), or a list.
FIELD_KINDS = {
    'description': 'html',
    'culture': 'html',
    'employee_benefits': 'html',
    'logo_url': 'image',
    'cover_image_url': 'image',
    'gallery_additions': 'images',
    'gallery_deletions': 'images',
    'benefits': 'list',
    'offices': 'list',
    'social_links': 'list',
}


CHANGE_COMPANY = inline_serializer(
    'AdminContentChangeCompany',
    fields={
        'public_id': serializers.CharField(),
        'name': serializers.CharField(),
        'public_path': serializers.CharField(),
        'content_review_required': serializers.BooleanField(),
    },
)
CHANGED_FIELDS = inline_serializer(
    'AdminContentChangeField',
    many=True,
    fields={
        'field': serializers.CharField(),
        'label': serializers.CharField(),
        'kind': serializers.ChoiceField(choices=['text', 'html', 'image', 'images', 'list']),
        'before': serializers.JSONField(allow_null=True),
        'after': serializers.JSONField(allow_null=True),
    },
)


class AdminCompanyContentChangeSerializer(serializers.ModelSerializer):
    """``changed_fields`` lists each changed field with display-ready ``before``/``after``.

    Needs ``labels`` in the context (``content_change_labels``) for benefit and
    province names.
    """

    status_label = serializers.CharField(source='get_status_display', read_only=True)
    company = serializers.SerializerMethodField()
    actor_email = serializers.EmailField(source='actor.email', read_only=True)
    reviewed_by_email = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()
    changed_fields = serializers.SerializerMethodField()

    class Meta:
        model = CompanyContentChange
        fields = [
            'public_id',
            'status',
            'status_label',
            'company',
            'actor_email',
            'sections',
            'changed_fields',
            'created_at',
            'reviewed_by_email',
            'reviewed_at',
            'review_note',
        ]
        read_only_fields = fields

    @extend_schema_field(CHANGE_COMPANY)
    def get_company(self, obj):
        company = obj.company
        return {
            'public_id': company.public_id,
            'name': company.trade_name or company.company_name,
            'public_path': company.public_page_path,
            'content_review_required': company.content_review_required,
        }

    def get_reviewed_by_email(self, obj) -> str:
        return obj.reviewed_by.email if obj.reviewed_by_id else ''

    def get_sections(self, obj) -> list[str]:
        keys = set(obj.changes or {})
        return [section for section, fields in SECTION_REQUEST_KEYS.items() if keys & fields]

    def _url(self, value):
        return media_url_from_value(value, request=self.context.get('request')) if value else ''

    def _display(self, field, value):
        labels = self.context.get('labels') or {}
        if value is None:
            return None
        if field in MEDIA_FIELDS:
            return self._url(value)
        if field in {'gallery_additions', 'gallery_deletions'}:
            return [self._url(row['image_url']) for row in value if isinstance(row, dict)]
        if field == 'benefits':
            names = labels.get('benefits', {})
            return [
                ' — '.join(filter(None, [names.get(item['benefit_id'], ''), item.get('note', '')]))
                for item in value
            ]
        if field == 'offices':
            provinces = labels.get('provinces', {})
            return [
                ', '.join(
                    filter(
                        None,
                        [
                            ('Trụ sở chính: ' if item.get('is_headquarters') else '')
                            + item.get('label', ''),
                            item.get('address_line', ''),
                            provinces.get(item.get('province_id'), ''),
                        ],
                    )
                )
                for item in value
            ]
        if field == 'social_links':
            return [f'{network}: {url}' for network, url in sorted((value or {}).items()) if url]
        return value

    @extend_schema_field(CHANGED_FIELDS)
    def get_changed_fields(self, obj):
        changes, previous = obj.changes or {}, obj.previous or {}
        rows = []
        for field, label in FIELD_ORDER:
            if field not in changes:
                continue
            # Deleted gallery rows live in ``previous``; ``changes`` holds their ids.
            after = [] if field == 'gallery_deletions' else changes[field]
            rows.append(
                {
                    'field': field,
                    'label': label,
                    'kind': FIELD_KINDS.get(field, 'text'),
                    'before': self._display(field, previous.get(field)),
                    'after': self._display(field, after),
                }
            )
        return rows


class AdminContentChangeReviewSerializer(serializers.Serializer):
    public_ids = serializers.ListField(
        child=serializers.CharField(max_length=50), min_length=1, max_length=100
    )


class AdminContentChangeRevertSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=500)
    require_review = serializers.BooleanField(required=False, default=False)


class AdminCompanyContentReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['require', 'release'])
    reason = serializers.CharField(min_length=10, max_length=500)
