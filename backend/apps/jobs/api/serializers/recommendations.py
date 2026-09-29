import re

from rest_framework import serializers

from ...models import CandidateHiddenJob
from .jobs import PublicJobListSerializer

RANKING_SEED_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
PUBLIC_ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,50}$')
MAX_INLINE_EXCLUDED_JOBS = 50


class RecommendationMatchDetailSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    points = serializers.IntegerField()


class RecommendedJobSerializer(PublicJobListSerializer):
    match_score = serializers.IntegerField()
    match_details = RecommendationMatchDetailSerializer(many=True)
    match_reasons = serializers.ListField(child=serializers.CharField())
    is_high_match = serializers.BooleanField()

    class Meta(PublicJobListSerializer.Meta):
        fields = [
            *PublicJobListSerializer.Meta.fields,
            'match_score',
            'match_details',
            'match_reasons',
            'is_high_match',
        ]
        read_only_fields = fields


class RelatedPositionSerializer(serializers.Serializer):
    label = serializers.CharField()
    search = serializers.CharField()


class RecommendationSourcesSerializer(serializers.Serializer):
    job_preferences = serializers.BooleanField()
    cv = serializers.BooleanField()
    search_activity = serializers.BooleanField()


class RecommendationSourceCvSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    title = serializers.CharField()
    is_default = serializers.BooleanField()


class RecommendationPaginationSerializer(serializers.Serializer):
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True)
    previous_page = serializers.IntegerField(allow_null=True)


class CvJobRecommendationResponseSerializer(serializers.Serializer):
    focus_keyword = serializers.CharField()
    strategy = serializers.CharField()
    minimum_match_score = serializers.IntegerField()
    results = RecommendedJobSerializer(many=True)
    related_positions = RelatedPositionSerializer(many=True)


class CandidateJobRecommendationResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['preferences_required', 'consent_required', 'ready'])
    strategy = serializers.CharField()
    minimum_match_score = serializers.IntegerField()
    preference_configured = serializers.BooleanField()
    needs_setup = serializers.BooleanField()
    consent_required = serializers.BooleanField()
    sources = RecommendationSourcesSerializer()
    source_cv = RecommendationSourceCvSerializer(allow_null=True)
    focus_keyword = serializers.CharField()
    related_positions = RelatedPositionSerializer(many=True)
    results = RecommendedJobSerializer(many=True)
    pagination = RecommendationPaginationSerializer()


class InlineJobRecommendationQuerySerializer(serializers.Serializer):
    page = serializers.IntegerField(min_value=1, default=1)
    ranking_seed = serializers.RegexField(
        RANKING_SEED_PATTERN,
        required=True,
        allow_blank=False,
        max_length=64,
        error_messages={'invalid': 'Invalid ranking seed.'},
    )
    excluded = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=2550,
    )

    def validate(self, attrs):
        raw_ids = attrs['excluded']
        public_ids = []
        seen = set()
        for raw_id in raw_ids.split(',') if raw_ids else []:
            public_id = raw_id.strip()
            if not public_id or not PUBLIC_ID_PATTERN.fullmatch(public_id):
                raise serializers.ValidationError(
                    {'excluded': 'Danh sách mã tin tuyển dụng không hợp lệ.'}
                )
            if public_id not in seen:
                seen.add(public_id)
                public_ids.append(public_id)
        if len(public_ids) > MAX_INLINE_EXCLUDED_JOBS:
            raise serializers.ValidationError(
                {'excluded': f'Chỉ được loại tối đa {MAX_INLINE_EXCLUDED_JOBS} tin.'}
            )
        attrs['excluded_public_ids'] = public_ids
        return attrs


class InlineJobRecommendationResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=['ready', 'not_shown', 'preferences_required', 'consent_required']
    )
    after_result_index = serializers.IntegerField(min_value=0, allow_null=True)
    results = PublicJobListSerializer(many=True)


class HiddenJobCreateSerializer(serializers.Serializer):
    job_public_id = serializers.RegexField(PUBLIC_ID_PATTERN, max_length=50)
    source = serializers.ChoiceField(choices=CandidateHiddenJob.Source.choices)


class HiddenJobResponseSerializer(serializers.Serializer):
    hidden = serializers.BooleanField()
    job_public_id = serializers.CharField(max_length=50)


class RecommendationPermissionDeniedSerializer(serializers.Serializer):
    detail = serializers.CharField()


class SavedJobSimilarityDetailSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    points = serializers.IntegerField()


class SavedJobSimilaritySerializer(PublicJobListSerializer):
    similarity_score = serializers.IntegerField()
    similarity_reasons = serializers.ListField(child=serializers.CharField())
    similarity_details = SavedJobSimilarityDetailSerializer(many=True)

    class Meta(PublicJobListSerializer.Meta):
        fields = [
            *PublicJobListSerializer.Meta.fields,
            'similarity_score',
            'similarity_reasons',
            'similarity_details',
        ]
        read_only_fields = fields


class SavedJobRecommendationResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['ready', 'empty'])
    strategy = serializers.ChoiceField(
        choices=['saved-job-similarity-v1', 'recent-active-fallback-v1']
    )
    source_saved_job_count = serializers.IntegerField(min_value=0)
    results = SavedJobSimilaritySerializer(many=True)
