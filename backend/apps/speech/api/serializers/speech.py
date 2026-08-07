from django.conf import settings
from rest_framework import serializers


class SpeechSessionRequestSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=['blog_post', 'text'])
    surface = serializers.ChoiceField(
        choices=['onboarding', 'chatbot', 'interview'], required=False
    )
    source_public_id = serializers.RegexField(r'^[A-Za-z0-9_-]{3,50}$', required=False, default='')
    text = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=settings.SPEECH_MAX_ADHOC_TEXT_CHARS,
    )

    def validate(self, attrs):
        if attrs['source_type'] == 'blog_post':
            if not attrs['source_public_id']:
                raise serializers.ValidationError(
                    {'source_public_id': 'Cần mã bài viết để tạo giọng đọc.'}
                )
            return attrs
        if not attrs['text'].strip():
            raise serializers.ValidationError({'text': 'Nội dung cần đọc không được để trống.'})
        if not attrs.get('surface'):
            raise serializers.ValidationError({'surface': 'Cần xác định bề mặt sử dụng giọng đọc.'})
        return attrs
