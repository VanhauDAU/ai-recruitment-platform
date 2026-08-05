from datetime import datetime

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...models import Announcement, AnnouncementRevision
from ...selectors import PRIORITY_TIER_BY_KIND, presentation_status
from ...services import normalize_revision_data

ANNOUNCEMENT_RUNTIME_EVENTS = (
    ('feed_error', 'feed_error'),
    ('contract_error', 'contract_error'),
    ('render_error', 'render_error'),
)
ANNOUNCEMENT_RUNTIME_REASONS = (
    ('network', 'network'),
    ('timeout', 'timeout'),
    ('http_4xx', 'http_4xx'),
    ('http_5xx', 'http_5xx'),
    ('contract', 'contract'),
    ('render', 'render'),
    ('unknown', 'unknown'),
)


def _user_summary(user) -> dict | None:
    if not user:
        return None
    return {
        'public_id': user.public_id,
        'name': user.full_name or user.email,
    }


class AnnouncementCtaSerializer(serializers.Serializer):
    label = serializers.CharField()
    url = serializers.CharField()
    external = serializers.BooleanField()


class AnnouncementDismissSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=AnnouncementRevision.DismissMode.choices)
    snooze_seconds = serializers.IntegerField(allow_null=True)
    version = serializers.IntegerField(min_value=1)


class AnnouncementActorSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    name = serializers.CharField()


class ActiveAnnouncementQuerySerializer(serializers.Serializer):
    surface = serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices)
    path = serializers.CharField(max_length=500, default='/')
    locale = serializers.CharField(max_length=16, default='vi')

    def validate_path(self, value):
        path = value.split('?', 1)[0].split('#', 1)[0]
        if not path.startswith('/') or path.startswith('//'):
            raise serializers.ValidationError('Path phải là application path tuyệt đối.')
        return path


class ActiveAnnouncementSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    revision = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()
    priority_tier = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    message = serializers.SerializerMethodField()
    badge = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    cta = serializers.SerializerMethodField()
    animation = serializers.SerializerMethodField()
    display_seconds = serializers.SerializerMethodField()
    dismiss = serializers.SerializerMethodField()
    starts_at = serializers.SerializerMethodField()
    ends_at = serializers.SerializerMethodField()

    def _revision(self, obj):
        return obj.active_revision

    def _localized(self, revision, field):
        locale = self.context.get('locale', 'vi').lower()
        if locale.startswith('en'):
            value = getattr(revision, f'{field}_en', '')
            if value:
                return value
        return getattr(revision, f'{field}_vi')

    def get_revision(self, obj) -> int:
        return self._revision(obj).number

    @extend_schema_field(serializers.ChoiceField(choices=AnnouncementRevision.Kind.choices))
    def get_kind(self, obj) -> str:
        return self._revision(obj).kind

    def get_priority_tier(self, obj) -> int:
        return PRIORITY_TIER_BY_KIND[self._revision(obj).kind]

    def get_priority(self, obj) -> int:
        return self._revision(obj).priority

    def get_message(self, obj) -> str:
        return self._localized(self._revision(obj), 'message')

    def get_badge(self, obj) -> str:
        return self._localized(self._revision(obj), 'badge')

    @extend_schema_field(serializers.ChoiceField(choices=AnnouncementRevision.Icon.choices))
    def get_icon(self, obj) -> str:
        return self._revision(obj).icon

    @extend_schema_field(AnnouncementCtaSerializer(allow_null=True))
    def get_cta(self, obj) -> dict | None:
        revision = self._revision(obj)
        if not revision.cta_url:
            return None
        return {
            'label': self._localized(revision, 'cta_label'),
            'url': revision.cta_url,
            'external': revision.cta_url.startswith('https://'),
        }

    @extend_schema_field(serializers.ChoiceField(choices=AnnouncementRevision.Animation.choices))
    def get_animation(self, obj) -> str:
        return self._revision(obj).animation

    def get_display_seconds(self, obj) -> int:
        return self._revision(obj).display_seconds

    @extend_schema_field(AnnouncementDismissSerializer)
    def get_dismiss(self, obj) -> dict:
        revision = self._revision(obj)
        return {
            'mode': revision.dismiss_mode,
            'snooze_seconds': revision.snooze_seconds,
            'version': obj.dismissal_version,
        }

    def get_starts_at(self, obj) -> datetime | None:
        return self._revision(obj).starts_at

    def get_ends_at(self, obj) -> datetime | None:
        return self._revision(obj).ends_at


class ActiveAnnouncementFeedSerializer(serializers.Serializer):
    items = ActiveAnnouncementSerializer(many=True)
    next_transition_at = serializers.DateTimeField(allow_null=True)
    remote_enabled = serializers.BooleanField()


class AnnouncementRevisionWriteSerializer(serializers.Serializer):
    message_vi = serializers.CharField(max_length=500)
    message_en = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    badge_vi = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    badge_en = serializers.CharField(max_length=80, required=False, allow_blank=True, default='')
    icon = serializers.ChoiceField(
        choices=AnnouncementRevision.Icon.choices,
        required=False,
        default=AnnouncementRevision.Icon.INFO,
    )
    cta_label_vi = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default='',
    )
    cta_label_en = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default='',
    )
    cta_url = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        default='',
    )
    kind = serializers.ChoiceField(
        choices=AnnouncementRevision.Kind.choices,
        required=False,
        default=AnnouncementRevision.Kind.INFO,
    )
    surfaces = serializers.ListField(
        child=serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices),
        allow_empty=False,
    )
    auth_audiences = serializers.ListField(
        child=serializers.ChoiceField(choices=AnnouncementRevision.Audience.choices),
        allow_empty=False,
    )
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=('candidate', 'employer', 'admin')),
        required=False,
        default=list,
    )
    include_path_prefixes = serializers.ListField(
        child=serializers.CharField(max_length=500),
        required=False,
        default=list,
    )
    exclude_path_prefixes = serializers.ListField(
        child=serializers.CharField(max_length=500),
        required=False,
        default=list,
    )
    starts_at = serializers.DateTimeField(required=False, allow_null=True, default=None)
    ends_at = serializers.DateTimeField(required=False, allow_null=True, default=None)
    priority = serializers.IntegerField(min_value=0, max_value=1000, required=False, default=50)
    animation = serializers.ChoiceField(
        choices=AnnouncementRevision.Animation.choices,
        required=False,
        default=AnnouncementRevision.Animation.SLIDE,
    )
    display_seconds = serializers.IntegerField(
        min_value=4,
        max_value=15,
        required=False,
        default=6,
    )
    dismiss_mode = serializers.ChoiceField(
        choices=AnnouncementRevision.DismissMode.choices,
        required=False,
        default=AnnouncementRevision.DismissMode.CLOSE,
    )
    snooze_seconds = serializers.IntegerField(
        min_value=60,
        required=False,
        allow_null=True,
        default=None,
    )

    def validate(self, attrs):
        try:
            attrs = normalize_revision_data(attrs)
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                getattr(error, 'message_dict', {'detail': error.messages})
            ) from error
        errors = {}
        if attrs['starts_at'] and attrs['ends_at'] and attrs['starts_at'] >= attrs['ends_at']:
            errors['ends_at'] = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
        if attrs['kind'] == AnnouncementRevision.Kind.CRITICAL:
            if not attrs['ends_at']:
                errors['ends_at'] = 'Thông báo critical bắt buộc có thời gian kết thúc.'
            if attrs['dismiss_mode'] != AnnouncementRevision.DismissMode.LOCKED:
                errors['dismiss_mode'] = 'Thông báo critical không thể dismiss.'
        if bool(attrs['cta_label_vi'].strip()) != bool(attrs['cta_url']):
            errors['cta_url'] = 'CTA tiếng Việt và URL phải được cấu hình cùng nhau.'
        if attrs['dismiss_mode'] == AnnouncementRevision.DismissMode.SNOOZE:
            if not attrs['snooze_seconds']:
                errors['snooze_seconds'] = 'Chế độ snooze cần thời lượng.'
        elif attrs['snooze_seconds'] is not None:
            errors['snooze_seconds'] = 'Chỉ cấu hình thời lượng cho chế độ snooze.'
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class AnnouncementCreateSerializer(serializers.Serializer):
    internal_name = serializers.CharField(max_length=200)
    revision = AnnouncementRevisionWriteSerializer()


class AnnouncementRenameSerializer(serializers.Serializer):
    internal_name = serializers.CharField(max_length=200)
    revision_token = serializers.IntegerField(min_value=1)


class AnnouncementRevisionCreateSerializer(serializers.Serializer):
    revision_token = serializers.IntegerField(min_value=1)
    revision = AnnouncementRevisionWriteSerializer()


class AnnouncementActionSerializer(serializers.Serializer):
    revision_token = serializers.IntegerField(min_value=1)
    revision = serializers.IntegerField(min_value=1, required=False)


class AnnouncementStateWriteSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=1)
    dismissal_version = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=('dismiss', 'snooze'))


class AnnouncementUserStateSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    revision = serializers.IntegerField()
    dismissal_version = serializers.IntegerField()
    dismissed_at = serializers.DateTimeField(allow_null=True)
    snoozed_until = serializers.DateTimeField(allow_null=True)


class AnnouncementEventSerializer(serializers.Serializer):
    public_id = serializers.CharField(max_length=50)
    revision = serializers.IntegerField(min_value=1)
    surface = serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices)
    event = serializers.ChoiceField(choices=('impression', 'click', 'dismiss'))


class AnnouncementEventBatchSerializer(serializers.Serializer):
    events = AnnouncementEventSerializer(many=True, allow_empty=False)

    def validate_events(self, value):
        if len(value) > 50:
            raise serializers.ValidationError('Mỗi batch nhận tối đa 50 event.')
        unique = {}
        for event in value:
            key = (
                event['public_id'],
                event['revision'],
                event['surface'],
                event['event'],
            )
            unique[key] = event
        return list(unique.values())


class AnnouncementRuntimeEventSerializer(serializers.Serializer):
    surface = serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices)
    event = serializers.ChoiceField(choices=ANNOUNCEMENT_RUNTIME_EVENTS)
    reason = serializers.ChoiceField(choices=ANNOUNCEMENT_RUNTIME_REASONS)


class AnnouncementMetricQuerySerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        date_from = attrs.get('date_from')
        date_to = attrs.get('date_to')
        if date_from and date_to:
            if date_from > date_to:
                raise serializers.ValidationError(
                    {'date_to': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.'}
                )
            if (date_to - date_from).days > 92:
                raise serializers.ValidationError({'date_to': 'Khoảng báo cáo tối đa là 93 ngày.'})
        return attrs


class AnnouncementDailyMetricSerializer(serializers.Serializer):
    date = serializers.DateField()
    surface = serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices)
    impressions = serializers.IntegerField()
    unique_impressions = serializers.IntegerField()
    clicks = serializers.IntegerField()
    unique_clicks = serializers.IntegerField()
    dismisses = serializers.IntegerField()
    ctr = serializers.FloatField()
    dismiss_rate = serializers.FloatField()


class AnnouncementMetricSummarySerializer(serializers.Serializer):
    impressions = serializers.IntegerField()
    unique_impressions = serializers.IntegerField()
    clicks = serializers.IntegerField()
    unique_clicks = serializers.IntegerField()
    dismisses = serializers.IntegerField()
    ctr = serializers.FloatField()
    dismiss_rate = serializers.FloatField()


class AnnouncementMetricReportSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    consent_notice = serializers.CharField()
    summary = AnnouncementMetricSummarySerializer()
    daily = AnnouncementDailyMetricSerializer(many=True)


class AnnouncementDuplicateSerializer(serializers.Serializer):
    revision_token = serializers.IntegerField(min_value=1)
    internal_name = serializers.CharField(max_length=200)


class AdminAnnouncementListSerializer(serializers.ModelSerializer):
    presentation_status = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()
    surfaces = serializers.SerializerMethodField()
    starts_at = serializers.SerializerMethodField()
    ends_at = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    active_revision_number = serializers.SerializerMethodField()
    draft_revision_number = serializers.SerializerMethodField()
    creator = serializers.SerializerMethodField()
    publisher = serializers.SerializerMethodField()
    impressions = serializers.SerializerMethodField()
    clicks = serializers.SerializerMethodField()
    ctr = serializers.SerializerMethodField()
    dismisses = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'public_id',
            'internal_name',
            'lifecycle_state',
            'presentation_status',
            'kind',
            'surfaces',
            'starts_at',
            'ends_at',
            'priority',
            'active_revision_number',
            'draft_revision_number',
            'creator',
            'publisher',
            'impressions',
            'clicks',
            'ctr',
            'dismisses',
            'published_at',
            'created_at',
            'updated_at',
        ]

    def _active(self, obj):
        return obj.active_revision

    def get_presentation_status(self, obj) -> str:
        return presentation_status(obj)

    @extend_schema_field(serializers.ChoiceField(choices=AnnouncementRevision.Kind.choices))
    def get_kind(self, obj) -> str | None:
        return self._active(obj).kind if self._active(obj) else None

    @extend_schema_field(
        serializers.ListField(
            child=serializers.ChoiceField(choices=AnnouncementRevision.Surface.choices)
        )
    )
    def get_surfaces(self, obj) -> list[str]:
        return self._active(obj).surfaces if self._active(obj) else []

    def get_starts_at(self, obj) -> datetime | None:
        return self._active(obj).starts_at if self._active(obj) else None

    def get_ends_at(self, obj) -> datetime | None:
        return self._active(obj).ends_at if self._active(obj) else None

    def get_priority(self, obj) -> int | None:
        return self._active(obj).priority if self._active(obj) else None

    def get_active_revision_number(self, obj) -> int | None:
        return self._active(obj).number if self._active(obj) else None

    def get_draft_revision_number(self, obj) -> int | None:
        latest = getattr(obj, 'latest_revision_number', None)
        active = self.get_active_revision_number(obj)
        return latest if latest and latest != active else None

    @extend_schema_field(AnnouncementActorSerializer(allow_null=True))
    def get_creator(self, obj) -> dict | None:
        return _user_summary(obj.created_by)

    @extend_schema_field(AnnouncementActorSerializer(allow_null=True))
    def get_publisher(self, obj) -> dict | None:
        return _user_summary(obj.published_by)

    def get_impressions(self, obj) -> int:
        return getattr(obj, 'metric_impressions', 0)

    def get_clicks(self, obj) -> int:
        return getattr(obj, 'metric_clicks', 0)

    def get_ctr(self, obj) -> float:
        impressions = self.get_impressions(obj)
        return round(self.get_clicks(obj) * 100 / impressions, 2) if impressions else 0.0

    def get_dismisses(self, obj) -> int:
        return getattr(obj, 'metric_dismisses', 0)


class AnnouncementRevisionReadSerializer(serializers.ModelSerializer):
    creator = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementRevision
        fields = [
            'number',
            'message_vi',
            'message_en',
            'badge_vi',
            'badge_en',
            'icon',
            'cta_label_vi',
            'cta_label_en',
            'cta_url',
            'kind',
            'surfaces',
            'auth_audiences',
            'roles',
            'include_path_prefixes',
            'exclude_path_prefixes',
            'starts_at',
            'ends_at',
            'priority',
            'animation',
            'display_seconds',
            'dismiss_mode',
            'snooze_seconds',
            'creator',
            'is_active',
            'published_at',
            'created_at',
        ]

    @extend_schema_field(AnnouncementActorSerializer(allow_null=True))
    def get_creator(self, obj) -> dict | None:
        return _user_summary(obj.created_by)

    def get_is_active(self, obj) -> bool:
        return obj.announcement.active_revision_id == obj.id


class AnnouncementAuditEventSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    action = serializers.CharField()
    source = serializers.CharField()
    actor = serializers.SerializerMethodField()
    payload = serializers.JSONField()
    created_at = serializers.DateTimeField()

    @extend_schema_field(AnnouncementActorSerializer(allow_null=True))
    def get_actor(self, obj) -> dict | None:
        return _user_summary(obj.actor)


class AdminAnnouncementDetailSerializer(AdminAnnouncementListSerializer):
    revision_token = serializers.IntegerField()
    dismissal_version = serializers.IntegerField()
    revisions = AnnouncementRevisionReadSerializer(many=True, read_only=True)
    audit_events = serializers.SerializerMethodField()

    @extend_schema_field(AnnouncementAuditEventSerializer(many=True))
    def get_audit_events(self, obj) -> list[dict]:
        return AnnouncementAuditEventSerializer(
            self.context.get('audit_events', []),
            many=True,
        ).data

    class Meta(AdminAnnouncementListSerializer.Meta):
        fields = [
            *AdminAnnouncementListSerializer.Meta.fields,
            'revision_token',
            'dismissal_version',
            'paused_at',
            'archived_at',
            'revisions',
            'audit_events',
        ]
