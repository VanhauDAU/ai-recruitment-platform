from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from common.media_storage import save_image_upload

from .permissions import CanEditBlog
from .selectors import (
    active_categories,
    blog_home_sections,
    pinned_posts,
    published_post_detail_queryset,
    published_posts_queryset,
)
from .serializers import (
    PinnedPostSerializer,
    PostCategorySerializer,
    PostDetailSerializer,
    PostListSerializer,
)
from .services import record_post_view


class PostListView(generics.ListAPIView):
    """Danh sách bài đã xuất bản. Lọc ?category=<slug>&tag=<slug>&q=<text>."""

    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return published_posts_queryset(self.request.query_params)


class PostDetailView(generics.RetrieveAPIView):
    """Chi tiết bài viết theo slug; tăng lượt xem mỗi lần mở."""

    serializer_class = PostDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
    queryset = published_post_detail_queryset()

    def get_object(self):
        return record_post_view(super().get_object())


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


class PostCategoryListView(generics.ListAPIView):
    """Danh mục bài viết đang bật (thanh danh mục ngang)."""

    serializer_class = PostCategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return active_categories()


class PinnedPostListView(generics.ListAPIView):
    """Bài ghim khối "Tài liệu hỗ trợ tìm việc" ở sidebar."""

    serializer_class = PinnedPostSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return pinned_posts()


class BlogImageUploadView(APIView):
    """Upload ảnh chèn trong nội dung bài (rich-text editor). Chỉ nhân viên biên tập.

    Trả về URL công khai để editor nhúng thẳng vào HTML `content`; ảnh nội dung
    lưu URL cuối cùng (khác thumbnail lưu storage key).
    """

    permission_classes = [CanEditBlog]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get('file') or request.FILES.get('image')
        if upload is None:
            return Response(
                {'detail': 'Thiếu file ảnh (field "file").'}, status=status.HTTP_400_BAD_REQUEST
            )
        saved = save_image_upload(
            upload, 'blog/content', request=request, max_dimensions=(1600, 1600)
        )
        return Response(
            {'url': saved['url'], 'name': saved['name']}, status=status.HTTP_201_CREATED
        )
