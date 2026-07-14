"""Public V2 Template Catalog endpoints with a deliberately compact card contract."""

from hashlib import sha256

from django.http import Http404
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .api_v2_serializers import (
    CvCategorySerializer,
    CvSampleContentCardSerializer,
    CvTemplateCardSerializer,
    CvTemplateDetailSerializer,
)
from .models import CvTemplate
from .selectors import (
    active_cv_categories_queryset,
    published_sample_contents_queryset,
    published_template_detail_queryset,
    published_template_queryset,
    related_published_templates,
)


class PublicCatalogCacheMixin:
    cache_seconds = 300

    def cached_response(self, data):
        response = Response(data)
        digest = sha256(repr(data).encode('utf-8')).hexdigest()
        response['Cache-Control'] = f'public, max-age={self.cache_seconds}'
        response['ETag'] = f'"{digest}"'
        return response


class CvTemplateCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvTemplateCardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return published_template_queryset(
            locale=self.request.query_params.get('locale', 'vi-VN'),
            category=self.request.query_params.get('category'),
            tag=self.request.query_params.get('tag'),
        ).order_by('-usage_count', 'sort_order', 'name')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response['Cache-Control'] = f'public, max-age={self.cache_seconds}'
        response['ETag'] = f'"{sha256(repr(response.data).encode("utf-8")).hexdigest()}"'
        return response


class CvTemplateCatalogDetailView(PublicCatalogCacheMixin, APIView):
    permission_classes = [permissions.AllowAny]

    def get_template(self, slug, locale):
        try:
            return published_template_detail_queryset(locale=locale).get(slug=slug)
        except CvTemplate.DoesNotExist as error:
            raise Http404 from error

    def get(self, request, slug):
        template = self.get_template(slug, request.query_params.get('locale', 'vi-VN'))
        return self.cached_response(CvTemplateDetailSerializer(template).data)


class CvTemplateRelatedListView(CvTemplateCatalogDetailView):
    def get(self, request, slug):
        locale = request.query_params.get('locale', 'vi-VN')
        template = self.get_template(slug, locale)
        return self.cached_response(CvTemplateCardSerializer(related_published_templates(template, locale=locale), many=True).data)


class CvCategoryCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvCategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_cv_categories_queryset(self.request.query_params.get('type'))

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)


class CvSampleContentCatalogListView(PublicCatalogCacheMixin, generics.ListAPIView):
    serializer_class = CvSampleContentCardSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return published_sample_contents_queryset(
            locale=self.request.query_params.get('locale'),
            experience_level=self.request.query_params.get('experience_level'),
        )

    def list(self, request, *args, **kwargs):
        return self.cached_response(self.get_serializer(self.get_queryset(), many=True).data)
