from django.conf import settings
from django.db.models import Avg, Count
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.cvs.services import asset_map

from ...models import ApplicationReview, ApplicationReviewLink
from ...services import deidentified_content

REVIEW_PAGE_PATH = '/tuyendung/danh-gia-ho-so'


def review_page_url(raw_token):
    return f'{settings.EMPLOYER_FRONTEND_URL.rstrip("/")}{REVIEW_PAGE_PATH}/{raw_token}'


class ReviewLinkCreateSerializer(serializers.Serializer):
    reviewer_name = serializers.CharField(max_length=120)
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    expires_in_days = serializers.ChoiceField(choices=[3, 7, 14, 30], default=7)


class ReviewLinkSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationReviewLink
        fields = [
            'public_id',
            'reviewer_name',
            'message',
            'status',
            'has_review',
            'expires_at',
            'revoked_at',
            'last_opened_at',
            'open_count',
            'created_at',
        ]
        read_only_fields = fields

    def get_status(self, obj) -> str:
        if obj.revoked_at:
            return 'revoked'
        return 'expired' if obj.expires_at <= timezone.now() else 'active'

    def get_has_review(self, obj) -> bool:
        return hasattr(obj, 'review')


class ApplicationReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='link.reviewer_name', read_only=True)
    recommendation_label = serializers.CharField(
        source='get_recommendation_display', read_only=True
    )

    class Meta:
        model = ApplicationReview
        fields = [
            'reviewer_name',
            'recommendation',
            'recommendation_label',
            'rating',
            'strengths',
            'concerns',
            'submitted_at',
            'updated_at',
        ]
        read_only_fields = fields


class ReviewSubmitSerializer(serializers.Serializer):
    recommendation = serializers.ChoiceField(choices=ApplicationReview.Recommendation.choices)
    rating = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    strengths = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    concerns = serializers.CharField(max_length=2000, required=False, allow_blank=True)


def review_summary(reviews):
    """Counts per recommendation and the average rating, for the inspector."""
    aggregate = reviews.aggregate(total=Count('id'), average_rating=Avg('rating'))
    counts = dict(
        reviews.order_by()
        .values_list('recommendation')
        .annotate(n=Count('id'))
        .values_list('recommendation', 'n')
    )
    return {
        'total': aggregate['total'],
        'average_rating': (
            round(aggregate['average_rating'], 1) if aggregate['average_rating'] else None
        ),
        'by_recommendation': {
            value: counts.get(value, 0) for value in ApplicationReview.Recommendation.values
        },
    }


def reviewer_payload(link, request):
    """What the invited reviewer sees: job context and a de-identified CV."""
    application = link.application
    version = application.submitted_cv_version
    content = deidentified_content(version.content_json)
    review = getattr(link, 'review', None)
    return {
        'reviewer_name': link.reviewer_name,
        'message': link.message,
        'expires_at': link.expires_at,
        'job_title': application.job.title,
        'company_name': application.job.company.company_name,
        'candidate_name': (
            version.content_json.get('personal_info', {}).get('full_name')
            or application.candidate.full_name
            or _('Ứng viên')
        ),
        'submitted_cv_title': application.submitted_cv_title,
        'cv': {
            'schema_version': version.schema_version,
            'content_json': content,
            'layout_json': version.layout_json,
            'style_json': version.style_json,
            'template_renderer_key': (
                version.template_version.renderer_key if version.template_version_id else ''
            ),
            # Only template backgrounds remain: the photo was removed above.
            'assets': asset_map(
                content_json=content,
                style_json=version.style_json,
                request=request,
                version=version,
                signed=True,
            ),
        },
        'review': ApplicationReviewSerializer(review).data if review else None,
    }
