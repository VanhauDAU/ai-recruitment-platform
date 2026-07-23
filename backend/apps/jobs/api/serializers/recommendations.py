from rest_framework import serializers

from .jobs import PublicJobListSerializer


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


class RecommendationPermissionDeniedSerializer(serializers.Serializer):
    detail = serializers.CharField()
