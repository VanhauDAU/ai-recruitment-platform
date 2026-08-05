import hashlib
import json

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

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
        if not settings.KNOWLEDGEBASE_PUBLIC_ENABLED:
            raise Http404
        return super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code != 200:
            response['Cache-Control'] = 'no-store'
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
