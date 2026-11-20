"""Admin endpoints for articles and their draft -> publish revision workflow."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    admin_article_summary,
    admin_articles_queryset,
)
from ...services import (
    archive_article,
    create_article,
    create_revision,
    discard_draft_revision,
    publish_revision,
    reorder_articles,
    restore_article,
    update_article,
    update_draft_revision,
)
from ..serializers import (
    AdminArticleDetailSerializer,
    AdminArticleListSerializer,
    AdminArticleSummarySerializer,
    ArticleCreateSerializer,
    ArticleQuerySerializer,
    ArticleUpdateSerializer,
    PublishSerializer,
    ReorderSerializer,
    RevisionSerializer,
    RevisionWriteSerializer,
    TokenActionSerializer,
)
from .admin_shared import (
    ERROR_RESPONSES,
    PrivateNoStoreMixin,
    article_or_404,
    article_response,
    category_or_404,
)


@extend_schema(tags=['knowledgebase-admin'])
class AdminArticleListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminArticleListSerializer

    def get_queryset(self):
        query = ArticleQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        return admin_articles_queryset(query.validated_data)

    @extend_schema(
        request=ArticleCreateSerializer,
        responses={201: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def post(self, request):
        serializer = ArticleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = create_article(actor=request.user, **serializer.validated_data)
        article, _revision = result
        return article_response(request, article, response_status=status.HTTP_201_CREATED)


class AdminArticleSummaryView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        responses={200: AdminArticleSummarySerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def get(self, request):
        query = ArticleQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return Response(admin_article_summary(query.validated_data))


@extend_schema(tags=['knowledgebase-admin'])
class AdminArticleDetailView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES})
    def get(self, request, public_id):
        return article_response(request, article_or_404(public_id))

    @extend_schema(
        request=ArticleUpdateSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def patch(self, request, public_id):
        serializer = ArticleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = update_article(
            article=article_or_404(public_id),
            actor=request.user,
            expected_revision_token=expected,
            **data,
        )
        return article_response(request, result)


class AdminArticleReorderView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        request=ReorderSerializer,
        responses={200: AdminArticleListSerializer(many=True), **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category_public_id = serializer.validated_data.get('category_public_id')
        if not category_public_id:
            raise ValidationError({'category_public_id': 'Trường này là bắt buộc.'})
        reorder_articles(
            category=category_or_404(category_public_id),
            ordered_public_ids=serializer.validated_data['public_ids'],
            actor=request.user,
        )
        return Response(
            AdminArticleListSerializer(
                admin_articles_queryset({'category': category_or_404(category_public_id).slug}),
                many=True,
            ).data
        )


@extend_schema(tags=['knowledgebase-admin'])
class AdminRevisionListCreateView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        operation_id='knowledgebase_admin_revision_list',
        responses={200: RevisionSerializer(many=True), **ERROR_RESPONSES},
    )
    def get(self, request, public_id):
        article = article_or_404(public_id)
        return Response(RevisionSerializer(article.admin_revisions, many=True).data)

    @extend_schema(
        request=RevisionWriteSerializer,
        responses={201: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def post(self, request, public_id):
        serializer = RevisionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = create_revision(
            article=article_or_404(public_id),
            actor=request.user,
            expected_revision_token=expected,
            **data,
        )
        article, _revision = result
        return article_response(request, article, response_status=status.HTTP_201_CREATED)


@extend_schema(tags=['knowledgebase-admin'])
class AdminRevisionDetailView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        operation_id='knowledgebase_admin_revision_detail',
        responses={200: RevisionSerializer, **ERROR_RESPONSES},
    )
    def get(self, request, public_id, number):
        article = article_or_404(public_id)
        revision = get_object_or_404(article.revisions.all(), number=number)
        return Response(RevisionSerializer(revision).data)

    @extend_schema(
        request=RevisionWriteSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def patch(self, request, public_id, number):
        serializer = RevisionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = update_draft_revision(
            article=article_or_404(public_id),
            revision_number=number,
            actor=request.user,
            expected_revision_token=expected,
            **data,
        )
        article, _revision = result
        return article_response(request, article)


@extend_schema(tags=['knowledgebase-admin'])
class AdminRevisionDiscardView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        request=TokenActionSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def post(self, request, public_id, number):
        serializer = TokenActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article = discard_draft_revision(
            article=article_or_404(public_id),
            revision_number=number,
            actor=request.user,
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        return article_response(request, article)


class AdminArticlePublishView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        request=PublishSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id):
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = publish_revision(
            article=article_or_404(public_id),
            actor=request.user,
            expected_revision_token=serializer.validated_data['revision_token'],
            revision_number=serializer.validated_data['revision_number'],
            review_due_at=serializer.validated_data.get('review_due_at'),
        )
        return article_response(request, result)


class AdminArticleLifecycleView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]
    lifecycle_action = None

    @extend_schema(
        request=TokenActionSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id):
        serializer = TokenActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operation = archive_article if self.lifecycle_action == 'archive' else restore_article
        result = operation(
            article=article_or_404(public_id),
            actor=request.user,
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        return article_response(request, result)


class AdminArticleArchiveView(AdminArticleLifecycleView):
    lifecycle_action = 'archive'


class AdminArticleRestoreView(AdminArticleLifecycleView):
    lifecycle_action = 'restore'
