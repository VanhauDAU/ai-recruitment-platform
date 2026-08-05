import hashlib
import json
from time import monotonic

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from common.metrics import record_metric
from common.pagination import StandardPagination
from common.throttling import ClientIPScopedRateThrottle

from ...selectors import (
    public_article_by_slugs,
    public_article_navigation,
    public_articles_queryset,
    public_categories_queryset,
)
from ...services import knowledge_public_cache_version
from ..serializers import (
    PublicArticleDetailSerializer,
    PublicArticleListSerializer,
    PublicArticleQuerySerializer,
    PublicCategorySerializer,
)


class PublicKnowledgebaseMixin:
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ClientIPScopedRateThrottle]
    throttle_scope = 'knowledgebase_public'

    def initial(self, request, *args, **kwargs):
        self._knowledgebase_started_at = monotonic()
        if not settings.KNOWLEDGEBASE_PUBLIC_ENABLED:
            raise Http404
        return super().initial(request, *args, **kwargs)

    def _record_metrics(self, request, response):
        endpoint = request.resolver_match.url_name or 'unknown'
        status_code = response.status_code
        tags = {
            'endpoint': endpoint,
            'status': status_code,
            'failure_code': (
                response.data.get('code', f'http_{status_code}')
                if status_code >= 400 and isinstance(response.data, dict)
                else ''
            ),
        }
        if endpoint == 'kb-public-article-list':
            query_length = len(request.query_params.get('q', '').strip())
            if query_length == 0:
                query_bucket = 'none'
            elif query_length <= 20:
                query_bucket = '2_20'
            elif query_length <= 60:
                query_bucket = '21_60'
            elif query_length <= 120:
                query_bucket = '61_120'
            else:
                query_bucket = 'invalid'
            result_count = (
                response.data.get('count')
                if status_code == 200 and isinstance(response.data, dict)
                else None
            )
            tags.update(
                {
                    'category': 'filtered' if request.query_params.get('category') else 'all',
                    'article_type': request.query_params.get('type')
                    if request.query_params.get('type') in {'faq', 'guide'}
                    else 'all',
                    'query_length_bucket': query_bucket,
                    'result_bucket': (
                        'zero' if result_count == 0 else 'some' if result_count else 'unknown'
                    ),
                }
            )
        record_metric('knowledgebase_public_request', 1, **tags)
        record_metric(
            'knowledgebase_public_latency_ms',
            round((monotonic() - self._knowledgebase_started_at) * 1000, 2),
            **tags,
        )

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code != 200:
            response['Cache-Control'] = 'no-store'
            self._record_metrics(request, response)
            return response
        response['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
        payload = json.dumps(
            {
                'generation': knowledge_public_cache_version(),
                'data': response.data,
            },
            cls=DjangoJSONEncoder,
            ensure_ascii=False,
            sort_keys=True,
            separators=(',', ':'),
        )
        etag = f'"{hashlib.sha256(payload.encode()).hexdigest()}"'
        response['ETag'] = etag
        if request.headers.get('If-None-Match') == etag:
            response.status_code = 304
            response.data = None
        self._record_metrics(request, response)
        return response


@extend_schema(tags=['knowledgebase-public'])
class PublicCategoryListView(PublicKnowledgebaseMixin, generics.ListAPIView):
    serializer_class = PublicCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return public_categories_queryset()


@extend_schema(
    tags=['knowledgebase-public'],
    parameters=[PublicArticleQuerySerializer],
)
class PublicArticleListView(PublicKnowledgebaseMixin, generics.ListAPIView):
    serializer_class = PublicArticleListSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        query = PublicArticleQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return public_articles_queryset(query.validated_data)


@extend_schema(tags=['knowledgebase-public'])
class PublicArticleDetailView(PublicKnowledgebaseMixin, APIView):
    @extend_schema(responses={200: PublicArticleDetailSerializer})
    def get(self, request, category_slug, article_slug):
        article = public_article_by_slugs(category_slug, article_slug)
        if not article:
            raise Http404
        navigation = public_article_navigation(article)
        return Response(
            PublicArticleDetailSerializer(
                article,
                context={'request': request, **navigation},
            ).data
        )
