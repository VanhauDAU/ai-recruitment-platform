from drf_spectacular.utils import OpenApiTypes, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    active_categories,
    admin_media_queryset,
    blog_home_sections,
    pinned_posts,
    published_post_detail_queryset,
    published_posts_queryset,
    related_published_posts,
)
from ...services import (
    import_blog_thumbnail,
    record_post_view,
    upload_blog_media,
    upload_blog_thumbnail,
)
from ..serializers import (
    BlogMediaAssetSerializer,
    PinnedPostSerializer,
    PostCategorySerializer,
    PostDetailSerializer,
    PostListSerializer,
)


@extend_schema(summary='Bài viết đã xuất bản', tags=['blog'])
class PostListView(generics.ListAPIView):
    """Danh sách bài đã xuất bản. Lọc ?category=<slug>&tag=<slug>&q=<text>."""

    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return published_posts_queryset(self.request.query_params)


@extend_schema(summary='Chi tiết bài viết theo slug', tags=['blog'])
class PostDetailView(generics.RetrieveAPIView):
    """Chi tiết bài viết theo slug; tăng lượt xem mỗi lần mở."""

    serializer_class = PostDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    queryset = published_post_detail_queryset()

    def get_object(self):
        post = record_post_view(super().get_object())
        # Gắn related trên instance để SerializerMethodField không query lại.
        post.prefetched_related_posts = related_published_posts(post, limit=6)
        return post


@extend_schema(
    summary='Dữ liệu trang chủ blog (nổi bật + theo chuyên mục)',
    responses={200: OpenApiTypes.OBJECT},
    tags=['blog'],
)
class BlogHomeView(APIView):
    """Dữ liệu trang /blog kiểu magazine: 4 bài nổi bật + section theo danh mục."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        featured, sections = blog_home_sections()
        ctx = {'request': request}
        return Response(
            {
                'featured': PostListSerializer(featured, many=True, context=ctx).data,
                'sections': [
                    {
                        'category': PostCategorySerializer(section['category']).data,
                        'posts': PostListSerializer(section['posts'], many=True, context=ctx).data,
                    }
                    for section in sections
                ],
            }
        )


@extend_schema(summary='Danh mục bài viết đang bật', tags=['blog'])
class PostCategoryListView(generics.ListAPIView):
    """Danh mục bài viết đang bật (thanh danh mục ngang)."""

    serializer_class = PostCategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_categories()


@extend_schema(summary='Bài ghim ở sidebar blog', tags=['blog'])
class PinnedPostListView(generics.ListAPIView):
    """Bài ghim khối "Tài liệu hỗ trợ tìm việc" ở sidebar."""

    serializer_class = PinnedPostSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return pinned_posts()


@extend_schema(
    summary='Tải ảnh dùng trong bài viết',
    request=OpenApiTypes.OBJECT,
    responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
    tags=['blog'],
)
class BlogImageUploadView(generics.ListAPIView):
    """Upload ảnh chèn trong nội dung bài (rich-text editor). Chỉ nhân viên biên tập.

    Trả về URL công khai để editor nhúng thẳng vào HTML `content`; ảnh nội dung
    lưu URL cuối cùng (khác thumbnail lưu storage key).
    """

    permission_classes = [AdminPortalPermission]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = BlogMediaAssetSerializer

    def get_queryset(self):
        return admin_media_queryset(self.request.query_params)

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('image')
        if upload is None:
            raise ValidationError({'detail': 'Thiếu file ảnh (field "file").'})
        asset = upload_blog_media(upload=upload, actor=request.user, request=request)
        data = BlogMediaAssetSerializer(asset, context={'request': request}).data
        return Response({**data, 'name': asset.original_name}, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Tải ảnh đại diện (thumbnail) cho bài viết từ tệp hoặc đường dẫn',
    request=OpenApiTypes.OBJECT,
    responses={
        201: inline_serializer(
            'BlogThumbnailUpload',
            {
                'path': serializers.CharField(),
                'url': serializers.CharField(),
                'name': serializers.CharField(),
            },
        )
    },
    tags=['blog'],
)
class BlogThumbnailUploadView(APIView):
    permission_classes = [AdminPortalPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('image')
        url = str(request.data.get('url') or '').strip()
        if upload is not None:
            saved = upload_blog_thumbnail(upload, request=request)
        elif url:
            saved = import_blog_thumbnail(url, request=request)
        else:
            raise ValidationError({'detail': 'Thiếu file ảnh (field "file") hoặc "url".'})
        return Response(
            {'path': saved['path'], 'url': saved['url'], 'name': saved['name']},
            status=status.HTTP_201_CREATED,
        )
