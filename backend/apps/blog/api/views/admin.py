from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiTypes, extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...models import PinnedPost, PostCategory, Tag
from ...selectors import (
    admin_categories_queryset,
    admin_pins_queryset,
    admin_post_detail_queryset,
    admin_post_summary,
    admin_posts_queryset,
    admin_tags_queryset,
)
from ...services import (
    archive_post,
    create_post,
    delete_tag,
    discard_draft,
    merge_tags,
    publish_post,
    reorder_by_public_id,
    restore_post,
    return_post,
    save_post_draft,
    submit_post,
)
from ..serializers import (
    AdminPinnedPostSerializer,
    AdminPostActionSerializer,
    AdminPostCategorySerializer,
    AdminPostDetailSerializer,
    AdminPostListSerializer,
    AdminPostWriteSerializer,
    AdminTagMergeSerializer,
    AdminTagSerializer,
)


def _serializer_context(request):
    return {'request': request}


def _post(request, public_id):
    return get_object_or_404(
        admin_post_detail_queryset(),
        public_id=public_id,
    )


_REORDER_BODY = inline_serializer(
    'BlogReorder', {'public_ids': serializers.ListField(child=serializers.CharField())}
)


@extend_schema_view(
    get=extend_schema(summary='Admin: danh sách bài viết'),
    post=extend_schema(
        summary='Admin: tạo bài viết nháp',
        request=AdminPostWriteSerializer,
        responses={201: AdminPostDetailSerializer},
    ),
)
@extend_schema(tags=['blog-admin'])
class AdminPostListCreateView(generics.ListCreateAPIView):
    permission_classes = [AdminPortalPermission]

    def get_queryset(self):
        return admin_posts_queryset(
            params=self.request.query_params,
        )

    def get_serializer_class(self):
        return (
            AdminPostWriteSerializer if self.request.method == 'POST' else AdminPostListSerializer
        )

    def get_serializer_context(self):
        return _serializer_context(self.request)

    def create(self, request, *args, **kwargs):
        serializer = AdminPostWriteSerializer(data=request.data, context={'creating': True})
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        tags = data.pop('tags', [])
        data.pop('base_revision', None)
        data.setdefault('summary', '')
        data.setdefault('content', '')
        data.setdefault('thumbnail_url', '')
        data.setdefault('seo_title', '')
        data.setdefault('seo_description', '')
        post = create_post(actor=request.user, validated_data=data, tags=tags)
        post = _post(request, post.public_id)
        return Response(
            AdminPostDetailSerializer(post, context=_serializer_context(request)).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    summary='Admin: số bài viết theo trạng thái',
    responses={200: OpenApiTypes.OBJECT},
    tags=['blog-admin'],
)
class AdminPostSummaryView(APIView):
    permission_classes = [AdminPortalPermission]

    def get(self, request):
        return Response(admin_post_summary())


@extend_schema(
    summary='Admin: chi tiết bài viết',
    responses={200: AdminPostDetailSerializer},
    tags=['blog-admin'],
)
class AdminPostDetailView(APIView):
    permission_classes = [AdminPortalPermission]

    def get(self, request, public_id):
        post = _post(request, public_id)
        return Response(AdminPostDetailSerializer(post, context=_serializer_context(request)).data)


@extend_schema(
    summary='Admin: autosave bản nháp của bài viết',
    request=AdminPostWriteSerializer,
    responses={200: AdminPostDetailSerializer},
    tags=['blog-admin'],
)
class AdminPostDraftView(APIView):
    permission_classes = [AdminPortalPermission]

    def patch(self, request, public_id):
        post = _post(request, public_id)
        serializer = AdminPostWriteSerializer(
            data=request.data,
            partial=True,
            context={'post': post},
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if 'base_revision' not in data:
            raise ValidationError({'base_revision': ['Trường này là bắt buộc khi autosave.']})
        revision = data.pop('base_revision')
        tags = data.pop('tags', None)
        save_post_draft(
            post=post,
            actor=request.user,
            validated_data=data,
            tags=tags,
            base_revision=revision,
        )
        post = _post(request, public_id)
        return Response(AdminPostDetailSerializer(post, context=_serializer_context(request)).data)


@extend_schema(
    summary='Admin: chuyển trạng thái biên tập của bài viết',
    request=AdminPostActionSerializer,
    responses={200: AdminPostDetailSerializer},
    tags=['blog-admin'],
)
class AdminPostActionView(APIView):
    permission_classes = [AdminPortalPermission]
    action = None

    def post(self, request, public_id):
        post = _post(request, public_id)
        note_required = self.action in {'return', 'archive'}
        serializer = AdminPostActionSerializer(
            data=request.data,
            context={'note_required': note_required},
        )
        serializer.is_valid(raise_exception=True)
        note = serializer.validated_data.get('note', '')

        operation = {
            'submit': lambda: submit_post(post=post, actor=request.user),
            'return': lambda: return_post(post=post, actor=request.user, note=note),
            'publish': lambda: publish_post(post=post, actor=request.user),
            'archive': lambda: archive_post(post=post, actor=request.user, note=note),
            'restore': lambda: restore_post(post=post, actor=request.user),
            'discard-draft': lambda: discard_draft(post=post, actor=request.user),
        }[self.action]
        operation()
        post = _post(request, public_id)
        return Response(AdminPostDetailSerializer(post, context=_serializer_context(request)).data)


@extend_schema(summary='Admin: gửi bài viết chờ duyệt')
class AdminPostSubmitView(AdminPostActionView):
    action = 'submit'


@extend_schema(summary='Admin: trả bài viết về nháp kèm ghi chú')
class AdminPostReturnView(AdminPostActionView):
    action = 'return'


@extend_schema(summary='Admin: xuất bản bài viết')
class AdminPostPublishView(AdminPostActionView):
    action = 'publish'


@extend_schema(summary='Admin: gỡ bài viết')
class AdminPostArchiveView(AdminPostActionView):
    action = 'archive'


@extend_schema(summary='Admin: khôi phục bài viết đã gỡ')
class AdminPostRestoreView(AdminPostActionView):
    action = 'restore'


@extend_schema(summary='Admin: bỏ bản nháp đang sửa')
class AdminPostDiscardDraftView(AdminPostActionView):
    action = 'discard-draft'


@extend_schema(tags=['blog-admin'])
class AdminCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [AdminPortalPermission]
    pagination_class = None
    serializer_class = AdminPostCategorySerializer
    queryset = admin_categories_queryset()


@extend_schema(tags=['blog-admin'])
class AdminCategoryDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminPostCategorySerializer
    queryset = PostCategory.objects.all()
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'


@extend_schema(tags=['blog-admin'])
class AdminTagListCreateView(generics.ListCreateAPIView):
    permission_classes = [AdminPortalPermission]
    pagination_class = None
    serializer_class = AdminTagSerializer

    def get_queryset(self):
        return admin_tags_queryset(self.request.query_params)


@extend_schema(tags=['blog-admin'])
class AdminTagDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminTagSerializer
    queryset = Tag.objects.all()
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'

    def perform_destroy(self, instance):
        delete_tag(instance)


@extend_schema(
    summary='Admin: gộp thẻ vào một thẻ khác',
    request=AdminTagMergeSerializer,
    responses={200: AdminTagSerializer},
    tags=['blog-admin'],
)
class AdminTagMergeView(APIView):
    permission_classes = [AdminPortalPermission]

    def post(self, request, public_id):
        source = get_object_or_404(Tag, public_id=public_id)
        serializer = AdminTagMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = merge_tags(
            source=source,
            target=serializer.validated_data['target'],
            actor=request.user,
        )
        target = admin_tags_queryset().get(pk=target.pk)
        return Response(AdminTagSerializer(target).data)


@extend_schema(tags=['blog-admin'])
class AdminPinListCreateView(generics.ListCreateAPIView):
    permission_classes = [AdminPortalPermission]
    pagination_class = None
    serializer_class = AdminPinnedPostSerializer
    queryset = admin_pins_queryset()


@extend_schema(tags=['blog-admin'])
class AdminPinDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [AdminPortalPermission]
    serializer_class = AdminPinnedPostSerializer
    queryset = admin_pins_queryset()
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'


@extend_schema(
    summary='Admin: sắp xếp lại theo danh sách public ID',
    request=_REORDER_BODY,
    responses={200: _REORDER_BODY},
    tags=['blog-admin'],
)
class AdminReorderView(APIView):
    permission_classes = [AdminPortalPermission]
    model = None

    def post(self, request):
        public_ids = reorder_by_public_id(self.model, request.data.get('public_ids'))
        return Response({'public_ids': public_ids})


@extend_schema(summary='Admin: sắp xếp danh mục')
class AdminCategoryReorderView(AdminReorderView):
    model = PostCategory


@extend_schema(summary='Admin: sắp xếp bài ghim')
class AdminPinReorderView(AdminReorderView):
    model = PinnedPost
