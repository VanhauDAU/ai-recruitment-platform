"""Reader-facing announcement contracts: feed, dismiss/snooze state and telemetry."""

from datetime import datetime

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ...models import AnnouncementRevision
from ...selectors import PRIORITY_TIER_BY_KIND
from .announcements_presentation import (
    AnnouncementBackgroundSerializer,
    AnnouncementCtaSerializer,
    AnnouncementDismissSerializer,
    AnnouncementThemeSerializer,
    background_payload,
    theme_payload,
)

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
    theme = serializers.SerializerMethodField()
    background = serializers.SerializerMethodField()
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

    @extend_schema_field(AnnouncementThemeSerializer)
    def get_theme(self, obj) -> dict:
        return theme_payload(self._revision(obj))

    @extend_schema_field(AnnouncementBackgroundSerializer)
    def get_background(self, obj) -> dict:
        return background_payload(
            self._revision(obj),
            request=self.context.get('request'),
        )


class ActiveAnnouncementFeedSerializer(serializers.Serializer):
    items = ActiveAnnouncementSerializer(many=True)
    next_transition_at = serializers.DateTimeField(allow_null=True)
    remote_enabled = serializers.BooleanField()


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
