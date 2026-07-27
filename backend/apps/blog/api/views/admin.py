from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.exceptions import AdminPermissionDenied
from apps.accounts.permissions import HasAdminPermission, require_admin_permission
from common.pagination import StandardPagination

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
    discard_draft,
    merge_tags,
    publish_post,
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


def _has_permission(user, code):
    try:
        require_admin_permission(user, code)
        return True
    except AdminPermissionDenied:
        return False


def _permissions(request):
    can_publish = _has_permission(request.user, 'blog.publish')
    return {
        'can_manage': _has_permission(request.user, 'blog.manage') or can_publish,
        'can_publish': can_publish,
    }


def _serializer_context(request):
    return {'request': request, **_permissions(request)}


def _post(request, public_id):
    return get_object_or_404(
        admin_post_detail_queryset(
            actor=request.user,
            can_publish=_has_permission(request.user, 'blog.publish'),
        ),
        public_id=public_id,
    )


class AdminPostListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view'], 'POST': ['blog.view', 'blog.manage']}
    pagination_class = StandardPagination

    def get_queryset(self):
        return admin_posts_queryset(
            actor=self.request.user,
            can_publish=_has_permission(self.request.user, 'blog.publish'),
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


class AdminPostSummaryView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view']}

    def get(self, request):
        return Response(
            admin_post_summary(
                actor=request.user,
                can_publish=_has_permission(request.user, 'blog.publish'),
            )
        )


class AdminPostDetailView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view']}

    def get(self, request, public_id):
        post = _post(request, public_id)
        return Response(AdminPostDetailSerializer(post, context=_serializer_context(request)).data)


class AdminPostDraftView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'PATCH': ['blog.view']}

    def patch(self, request, public_id):
        require_admin_permission(request.user, 'blog.manage', 'blog.publish', match='any')
        post = _post(request, public_id)
        serializer = AdminPostWriteSerializer(
            data=request.data,
            partial=True,
            context={'post': post},
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if 'base_revision' not in data:
            return Response(
                {'base_revision': ['Trường này là bắt buộc khi autosave.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
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


class AdminPostActionView(APIView):
    permission_classes = [HasAdminPermission]
    action = None

    def get_required_admin_permissions(self, request):
        if self.action in {'return', 'publish', 'archive'}:
            return ['blog.view', 'blog.publish']
        return ['blog.view']

    def post(self, request, public_id):
        post = _post(request, public_id)
        note_required = self.action in {'return', 'archive'}
        serializer = AdminPostActionSerializer(
            data=request.data,
            context={'note_required': note_required},
        )
        serializer.is_valid(raise_exception=True)
        note = serializer.validated_data.get('note', '')
        if self.action in {'return', 'publish', 'archive'}:
            require_admin_permission(request.user, 'blog.publish')
        else:
            require_admin_permission(request.user, 'blog.manage', 'blog.publish', match='any')

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


class AdminPostSubmitView(AdminPostActionView):
    action = 'submit'


class AdminPostReturnView(AdminPostActionView):
    action = 'return'


class AdminPostPublishView(AdminPostActionView):
    action = 'publish'


class AdminPostArchiveView(AdminPostActionView):
    action = 'archive'


class AdminPostRestoreView(AdminPostActionView):
    action = 'restore'


class AdminPostDiscardDraftView(AdminPostActionView):
    action = 'discard-draft'


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view'], 'POST': ['blog.view', 'blog.manage']}
    pagination_class = None
    serializer_class = AdminPostCategorySerializer
    queryset = admin_categories_queryset()


class AdminCategoryDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['blog.view'],
        'PUT': ['blog.view', 'blog.manage'],
        'PATCH': ['blog.view', 'blog.manage'],
    }
    serializer_class = AdminPostCategorySerializer
    queryset = PostCategory.objects.all()
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'


class AdminTagListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view'], 'POST': ['blog.view', 'blog.manage']}
    pagination_class = None
    serializer_class = AdminTagSerializer

    def get_queryset(self):
        return admin_tags_queryset(self.request.query_params)


class AdminTagDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['blog.view'],
        'PUT': ['blog.view', 'blog.manage'],
        'PATCH': ['blog.view', 'blog.manage'],
        'DELETE': ['blog.view', 'blog.manage'],
    }
    serializer_class = AdminTagSerializer
    queryset = Tag.objects.all()
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'

    def perform_destroy(self, instance):
        if instance.posts.exists() or instance.working_copies.exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError({'detail': 'Không thể xóa thẻ đang được sử dụng.'})
        instance.delete()


class AdminTagMergeView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['blog.view', 'blog.manage']}

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


class AdminPinListCreateView(generics.ListCreateAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['blog.view'], 'POST': ['blog.view', 'blog.manage']}
    pagination_class = None
    serializer_class = AdminPinnedPostSerializer
    queryset = admin_pins_queryset()


class AdminPinDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {
        'GET': ['blog.view'],
        'PUT': ['blog.view', 'blog.manage'],
        'PATCH': ['blog.view', 'blog.manage'],
        'DELETE': ['blog.view', 'blog.manage'],
    }
    serializer_class = AdminPinnedPostSerializer
    queryset = PinnedPost.objects.select_related('post')
    lookup_field = 'public_id'
    lookup_url_kwarg = 'public_id'


class AdminReorderView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'POST': ['blog.view', 'blog.manage']}
    model = None

    def post(self, request):
        public_ids = request.data.get('public_ids')
        if not isinstance(public_ids, list) or not public_ids:
            return Response(
                {'public_ids': ['Gửi danh sách public ID theo thứ tự mong muốn.']}, status=400
            )
        items = {
            item.public_id: item for item in self.model.objects.filter(public_id__in=public_ids)
        }
        if set(items) != set(public_ids):
            return Response(
                {'public_ids': ['Danh sách chứa tài nguyên không tồn tại.']}, status=400
            )
        with transaction.atomic():
            for order, public_id in enumerate(public_ids, start=1):
                self.model.objects.filter(pk=items[public_id].pk).update(order=order)
        return Response({'public_ids': public_ids})


class AdminCategoryReorderView(AdminReorderView):
    model = PostCategory


class AdminPinReorderView(AdminReorderView):
    model = PinnedPost
