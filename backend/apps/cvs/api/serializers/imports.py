"""Request contract for importing a PDF/DOCX into the CV library."""

from rest_framework import serializers

from apps.cv_templates.models import DEFAULT_CV_LANGUAGE, CvLanguage

from .lookups import THEME_COLOR_PATTERN, normalize_theme_color, template_by_public_id


class CvImportSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    upload_session = serializers.CharField(max_length=50, required=False, trim_whitespace=True)
    title = serializers.CharField(
        max_length=255, required=False, allow_blank=False, trim_whitespace=True
    )
    template_public_id = serializers.CharField(max_length=50, required=False)
    language = serializers.ChoiceField(choices=CvLanguage.choices, default=DEFAULT_CV_LANGUAGE)
    theme_color = serializers.RegexField(THEME_COLOR_PATTERN, required=False)

    def validate_template_public_id(self, value):
        return template_by_public_id(value)

    def validate(self, attrs):
        if bool(attrs.get('file')) == bool(attrs.get('upload_session')):
            raise serializers.ValidationError(
                {'upload_session': 'Gửi đúng một trong file hoặc upload_session.'}
            )
        template = attrs.get('template_public_id')
        if attrs.get('theme_color') and template is None:
            raise serializers.ValidationError({'theme_color': 'template_public_id is required.'})
        if template is not None:
            normalize_theme_color(attrs, template)
        return attrs
