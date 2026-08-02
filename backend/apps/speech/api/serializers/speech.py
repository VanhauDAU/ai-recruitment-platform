from rest_framework import serializers


class SpeechSessionRequestSerializer(serializers.Serializer):
    source_type = serializers.ChoiceField(choices=['blog_post'])
    source_public_id = serializers.RegexField(r'^[A-Za-z0-9_-]{3,50}$')
    voice_id = serializers.RegexField(r'^[a-z0-9-]{1,64}$', required=False, default='')
    style = serializers.ChoiceField(
        choices=['tu_nhien', 'tin_tuc', 'doc_truyen'], required=False, default=''
    )
