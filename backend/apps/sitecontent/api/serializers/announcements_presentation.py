"""Output blocks rendered identically in the reader feed and the admin preview."""

from rest_framework import serializers

from common.storage.media import media_url_from_value

from ...models import AnnouncementRevision


class AnnouncementCtaSerializer(serializers.Serializer):
    label = serializers.CharField()
    url = serializers.CharField()
    external = serializers.BooleanField()


class AnnouncementDismissSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=AnnouncementRevision.DismissMode.choices)
    snooze_seconds = serializers.IntegerField(allow_null=True)
    version = serializers.IntegerField(min_value=1)


class AnnouncementThemeSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=AnnouncementRevision.ThemeMode.choices)
    preset = serializers.CharField(allow_null=True, allow_blank=True)
    accent = serializers.CharField(allow_null=True, allow_blank=True)
    bg_from = serializers.CharField(allow_null=True, allow_blank=True)
    bg_to = serializers.CharField(allow_null=True, allow_blank=True)
    fg = serializers.CharField(allow_null=True, allow_blank=True)


class AnnouncementBackgroundSerializer(serializers.Serializer):
    image_url = serializers.CharField(allow_null=True, allow_blank=True)
    image_storage_key = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    fit = serializers.ChoiceField(choices=AnnouncementRevision.BackgroundFit.choices)
    position = serializers.ChoiceField(choices=AnnouncementRevision.BackgroundPosition.choices)
    overlay = serializers.ChoiceField(choices=AnnouncementRevision.BackgroundOverlay.choices)


def theme_payload(revision) -> dict:
    return {
        'mode': revision.theme_mode or AnnouncementRevision.ThemeMode.KIND,
        'preset': revision.theme_preset or None,
        'accent': revision.color_accent or None,
        'bg_from': revision.color_bg_from or None,
        'bg_to': revision.color_bg_to or None,
        'fg': revision.color_fg or None,
    }


def background_payload(revision, *, request=None, include_storage_key=False) -> dict:
    image_key = (revision.background_image or '').strip()
    payload = {
        'image_url': media_url_from_value(image_key, request=request) if image_key else None,
        'fit': revision.background_fit or AnnouncementRevision.BackgroundFit.COVER,
        'position': revision.background_position or AnnouncementRevision.BackgroundPosition.CENTER,
        'overlay': revision.background_overlay or AnnouncementRevision.BackgroundOverlay.NONE,
    }
    if include_storage_key:
        payload['image_storage_key'] = image_key or None
    return payload
