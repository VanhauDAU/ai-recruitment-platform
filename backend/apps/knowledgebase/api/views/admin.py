from time import monotonic

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasAdminPermission
from common.metrics import record_metric
from common.pagination import StandardPagination

from ...selectors import (
    admin_article_detail_queryset,
    admin_article_summary,
    admin_articles_queryset,
    admin_categories_queryset,
    admin_media_queryset,
    article_audit_events,
)
from ...services import (
    KnowledgeConflict,
    KnowledgeMediaTooLarge,
    approve_revision,
    archive_article,
    create_article,
    create_category,
    create_revision,
    publish_revision,
    reject_revision,
    reorder_articles,
    reorder_categories,
    restore_article,
    set_category_active,
    submit_revision,
    update_article,
    update_category,
    update_draft_revision,
    upload_knowledge_media,
)
from ..serializers import (
    AdminArticleDetailSerializer,
    AdminArticleListSerializer,
    AdminArticleSummarySerializer,
    AdminCategorySerializer,
    ArticleCreateSerializer,
    ArticleQuerySerializer,
    ArticleUpdateSerializer,
    CategoryWriteSerializer,
    MediaSerializer,
    MediaUploadSerializer,
    PublishSerializer,
    ReorderSerializer,
    RevisionActionSerializer,
    RevisionSerializer,
    RevisionWriteSerializer,
    TokenActionSerializer,
)

ERROR_RESPONSES = {
    400: OpenApiResponse(
        description='Dữ liệu không hợp lệ.',
        examples=[
            OpenApiExample('Validation error', value={'body': ['Nội dung không được để trống.']})
        ],
    ),
    403: OpenApiResponse(
        description='Thiếu permission quản trị.',
        examples=[OpenApiExample('Forbidden', value={'detail': 'Bạn không có quyền thực hiện.'})],
    ),
    409: OpenApiResponse(
        description='Xung đột trạng thái hoặc revision token cũ.',
        examples=[
            OpenApiExample(
                'Stale revision',
                value={
                    'code': 'knowledgebase_revision_stale',
                    'detail': 'Nội dung đã thay đổi trên máy chủ.',
                    'current_revision_token': 4,
                },
            )
        ],
    ),
}


class PrivateNoStoreMixin:
    def initial(self, request, *args, **kwargs):
        self._knowledgebase_started_at = monotonic()
        return super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
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
        record_metric('knowledgebase_admin_request', 1, **tags)
        record_metric(
            'knowledgebase_admin_latency_ms',
            round((monotonic() - self._knowledgebase_started_at) * 1000, 2),
            **tags,
        )
        return response


def _validation_detail(error):
    return getattr(error, 'message_dict', {'detail': error.messages})


def _run_mutation(operation):
    try:
        return operation()
    except KnowledgeConflict as error:
        data = {'code': error.code, 'detail': error.detail}
        if error.current_revision_token is not None:
            data['current_revision_token'] = error.current_revision_token
        if error.open_revision is not None:
            data['open_revision'] = {
                'number': error.open_revision.number,
                'status': error.open_revision.status,
            }
        return Response(data, status=status.HTTP_409_CONFLICT)
    except DjangoValidationError as error:
        raise ValidationError(_validation_detail(error)) from error


def _category(public_id):
    return get_object_or_404(admin_categories_queryset(), public_id=public_id)


def _article(public_id):
    return get_object_or_404(admin_article_detail_queryset(), public_id=public_id)


def _category_response(request, category, *, response_status=status.HTTP_200_OK):
    refreshed = _category(category.public_id)
    return Response(
        AdminCategorySerializer(refreshed, context={'request': request}).data,
        status=response_status,
    )


def _article_response(request, article, *, response_status=status.HTTP_200_OK):
    refreshed = _article(article.public_id)
    return Response(
        AdminArticleDetailSerializer(
            refreshed,
            context={
                'request': request,
                'audit_events': article_audit_events(refreshed.public_id),
            },
        ).data,
        status=response_status,
    )


@extend_schema(tags=['knowledgebase-admin'])
class AdminCategoryListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'POST': ['knowledgebase.view', 'knowledgebase.manage'],
    }
    pagination_class = None
    serializer_class = AdminCategorySerializer
    queryset = admin_categories_queryset()

    @extend_schema(
        request=CategoryWriteSerializer, responses={201: AdminCategorySerializer, **ERROR_RESPONSES}
    )
    def post(self, request):
        serializer = CategoryWriteSerializer(data=request.data, context={'creating': True})
        serializer.is_valid(raise_exception=True)
        category = _run_mutation(
            lambda: create_category(actor=request.user, **serializer.validated_data)
        )
        if isinstance(category, Response):
            return category
        return _category_response(request, category, response_status=status.HTTP_201_CREATED)


@extend_schema(tags=['knowledgebase-admin'])
class AdminCategoryDetailView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'PATCH': ['knowledgebase.view', 'knowledgebase.manage'],
    }

    def get(self, request, public_id):
        return _category_response(request, _category(public_id))

    @extend_schema(
        request=CategoryWriteSerializer, responses={200: AdminCategorySerializer, **ERROR_RESPONSES}
    )
    def patch(self, request, public_id):
        serializer = CategoryWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = _run_mutation(
            lambda: update_category(
                category=_category(public_id),
                actor=request.user,
                expected_revision_token=expected,
                **data,
            )
        )
        if isinstance(result, Response):
            return result
        return _category_response(request, result)


class AdminCategoryReorderView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['knowledgebase.view', 'knowledgebase.manage']}

    @extend_schema(
        request=ReorderSerializer,
        responses={200: AdminCategorySerializer(many=True), **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: reorder_categories(
                categories=list(admin_categories_queryset()),
                ordered_public_ids=serializer.validated_data['public_ids'],
                actor=request.user,
            )
        )
        if isinstance(result, Response):
            return result
        return Response(AdminCategorySerializer(admin_categories_queryset(), many=True).data)


class AdminCategoryLifecycleView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['knowledgebase.view', 'knowledgebase.publish']}
    is_active = None

    @extend_schema(
        request=TokenActionSerializer,
        responses={200: AdminCategorySerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id):
        serializer = TokenActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: set_category_active(
                category=_category(public_id),
                actor=request.user,
                is_active=self.is_active,
                expected_revision_token=serializer.validated_data['revision_token'],
            )
        )
        if isinstance(result, Response):
            return result
        return _category_response(request, result)


class AdminCategoryActivateView(AdminCategoryLifecycleView):
    is_active = True


class AdminCategoryDeactivateView(AdminCategoryLifecycleView):
    is_active = False


@extend_schema(tags=['knowledgebase-admin'])
class AdminArticleListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'POST': ['knowledgebase.view', 'knowledgebase.manage'],
    }
    pagination_class = StandardPagination
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
        result = _run_mutation(
            lambda: create_article(actor=request.user, **serializer.validated_data)
        )
        if isinstance(result, Response):
            return result
        article, _revision = result
        return _article_response(request, article, response_status=status.HTTP_201_CREATED)


class AdminArticleSummaryView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['knowledgebase.view']}

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
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'PATCH': ['knowledgebase.view', 'knowledgebase.manage'],
    }

    def get(self, request, public_id):
        return _article_response(request, _article(public_id))

    @extend_schema(
        request=ArticleUpdateSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
    )
    def patch(self, request, public_id):
        serializer = ArticleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = _run_mutation(
            lambda: update_article(
                article=_article(public_id),
                actor=request.user,
                expected_revision_token=expected,
                **data,
            )
        )
        if isinstance(result, Response):
            return result
        return _article_response(request, result)


class AdminArticleReorderView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['knowledgebase.view', 'knowledgebase.manage']}

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
        result = _run_mutation(
            lambda: reorder_articles(
                category=_category(category_public_id),
                ordered_public_ids=serializer.validated_data['public_ids'],
                actor=request.user,
            )
        )
        if isinstance(result, Response):
            return result
        return Response(
            AdminArticleListSerializer(
                admin_articles_queryset({'category': _category(category_public_id).slug}),
                many=True,
            ).data
        )


@extend_schema(tags=['knowledgebase-admin'])
class AdminRevisionListCreateView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'POST': ['knowledgebase.view', 'knowledgebase.manage'],
    }

    @extend_schema(operation_id='knowledgebase_admin_revision_list')
    def get(self, request, public_id):
        article = _article(public_id)
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
        result = _run_mutation(
            lambda: create_revision(
                article=_article(public_id),
                actor=request.user,
                expected_revision_token=expected,
                **data,
            )
        )
        if isinstance(result, Response):
            return result
        article, _revision = result
        return _article_response(request, article, response_status=status.HTTP_201_CREATED)


@extend_schema(tags=['knowledgebase-admin'])
class AdminRevisionDetailView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'PATCH': ['knowledgebase.view', 'knowledgebase.manage'],
    }

    @extend_schema(operation_id='knowledgebase_admin_revision_detail')
    def get(self, request, public_id, number):
        article = _article(public_id)
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
        result = _run_mutation(
            lambda: update_draft_revision(
                article=_article(public_id),
                revision_number=number,
                actor=request.user,
                expected_revision_token=expected,
                **data,
            )
        )
        if isinstance(result, Response):
            return result
        article, _revision = result
        return _article_response(request, article)


class AdminRevisionActionView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    action = None

    def get_required_admin_permissions(self, request):
        if self.action in {'approve', 'reject'}:
            return ['knowledgebase.view', 'knowledgebase.review']
        return ['knowledgebase.view', 'knowledgebase.manage']

    @extend_schema(
        request=RevisionActionSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id, number):
        serializer = RevisionActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operation = {
            'submit': submit_revision,
            'approve': approve_revision,
            'reject': reject_revision,
        }[self.action]
        result = _run_mutation(
            lambda: operation(
                article=_article(public_id),
                revision_number=number,
                actor=request.user,
                expected_revision_token=serializer.validated_data['revision_token'],
                review_note=serializer.validated_data.get('review_note', ''),
            )
        )
        if isinstance(result, Response):
            return result
        article, _revision = result
        return _article_response(request, article)


class AdminRevisionSubmitView(AdminRevisionActionView):
    action = 'submit'


class AdminRevisionApproveView(AdminRevisionActionView):
    action = 'approve'


class AdminRevisionRejectView(AdminRevisionActionView):
    action = 'reject'


class AdminArticlePublishView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['knowledgebase.view', 'knowledgebase.publish']}

    @extend_schema(
        request=PublishSerializer,
        responses={200: AdminArticleDetailSerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id):
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run_mutation(
            lambda: publish_revision(
                article=_article(public_id),
                actor=request.user,
                expected_revision_token=serializer.validated_data['revision_token'],
                revision_number=serializer.validated_data['revision_number'],
                review_due_at=serializer.validated_data.get('review_due_at'),
            )
        )
        if isinstance(result, Response):
            return result
        return _article_response(request, result)


class AdminArticleLifecycleView(PrivateNoStoreMixin, APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['knowledgebase.view', 'knowledgebase.publish']}
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
        result = _run_mutation(
            lambda: operation(
                article=_article(public_id),
                actor=request.user,
                expected_revision_token=serializer.validated_data['revision_token'],
            )
        )
        if isinstance(result, Response):
            return result
        return _article_response(request, result)


class AdminArticleArchiveView(AdminArticleLifecycleView):
    lifecycle_action = 'archive'


class AdminArticleRestoreView(AdminArticleLifecycleView):
    lifecycle_action = 'restore'


@extend_schema(tags=['knowledgebase-admin'])
class AdminMediaListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['knowledgebase.view'],
        'POST': ['knowledgebase.view', 'knowledgebase.manage'],
    }
    pagination_class = StandardPagination
    serializer_class = MediaSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return admin_media_queryset(self.request.query_params.get('q', '').strip())

    @extend_schema(
        request=MediaUploadSerializer,
        responses={201: MediaSerializer, 413: OpenApiResponse(), **ERROR_RESPONSES},
    )
    def post(self, request):
        serializer = MediaUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            asset = upload_knowledge_media(
                upload=serializer.validated_data['file'],
                actor=request.user,
                default_alt_text=serializer.validated_data.get('default_alt_text', ''),
                request=request,
            )
        except KnowledgeMediaTooLarge as error:
            return Response({'file': [str(error)]}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        except DjangoValidationError as error:
            raise ValidationError(_validation_detail(error)) from error
        return Response(
            MediaSerializer(asset, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )
