from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class PostCategory(models.Model):
    """Danh mục bài viết cẩm nang nghề nghiệp (thanh danh mục ngang ở /blog).

    Taxonomy phẳng 1 cấp: breadcrumb chỉ hiển thị một cấp danh mục
    (Trang chủ > Cẩm nang nghề nghiệp > <Danh mục> > <Bài viết>). Đây là
    taxonomy biên tập nội dung, tách biệt với `jobs.JobCategory` (phân loại
    tin tuyển dụng) dù có danh mục trùng tên như "Kiến thức chuyên ngành".
    """

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True, blank=True,
                            help_text='Dùng cho URL /blog/danh-muc/<slug> và SEO')
    description = models.CharField(max_length=300, blank=True,
                                   help_text='Mô tả ngắn, dùng cho meta description trang danh mục')
    order = models.PositiveSmallIntegerField(default=0, help_text='Thứ tự trên thanh danh mục ngang')
    is_active = models.BooleanField(default=True, help_text='Tắt danh mục mà không xóa bài')
    seo_title = models.CharField(max_length=200, blank=True, help_text='Ghi đè title tag nếu cần')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Danh mục bài viết'
        verbose_name_plural = 'Danh mục bài viết'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Thẻ gắn vào bài viết (vd: kinh doanh). Có slug cho trang lọc /blog/tag/<slug>."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Thẻ bài viết'
        verbose_name_plural = 'Thẻ bài viết'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Post(models.Model):
    """Bài viết cẩm nang nghề nghiệp hiển thị ở /blog và trang chi tiết.

    `content` là HTML rich-text (ảnh, bảng, button, heading để sinh mục lục ở
    frontend). Mục lục, breadcrumb, nút chia sẻ đều suy ra ở frontend nên không
    lưu DB. `thumbnail_url` lưu **storage key** theo quy ước media của dự án;
    ảnh chèn trong `content` lưu URL cuối cùng do editor sinh ra.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        PENDING = 'pending', 'Chờ duyệt'
        PUBLISHED = 'published', 'Đã xuất bản'
        ARCHIVED = 'archived', 'Đã gỡ'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True,
                            help_text='URL /blog/<slug>; auto từ tiêu đề, sửa tay được để tối ưu SEO')
    category = models.ForeignKey(PostCategory, on_delete=models.PROTECT, related_name='posts')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='blog_posts', help_text='Nhân viên soạn bài; giữ bài khi xóa tài khoản')
    summary = models.CharField(max_length=500, blank=True,
                               help_text='Sapo/mô tả ngắn: card danh sách + meta description')
    thumbnail_url = models.TextField(blank=True,
                                     help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve thành URL public')
    content = models.TextField(help_text='Nội dung HTML từ rich-text editor')
    related_job_category = models.ForeignKey(
        'jobs.JobCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='blog_posts',
        help_text='Nguồn cho khối "Danh sách việc làm ..." trong bài; để trống thì ẩn khối',
    )
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True,
                                        help_text='Ngày đăng hiển thị; set lần đầu khi xuất bản')
    view_count = models.PositiveIntegerField(default=0)
    seo_title = models.CharField(max_length=200, blank=True, help_text='Ghi đè title tag')
    seo_description = models.CharField(max_length=300, blank=True,
                                       help_text='Ghi đè meta description (mặc định dùng summary)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', '-created_at']
        verbose_name = 'Bài viết'
        verbose_name_plural = 'Bài viết'
        permissions = [('can_publish_post', 'Có thể duyệt và xuất bản bài viết')]
        indexes = [
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['category', 'status', '-published_at'], name='blog_post_category_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['draft', 'pending', 'published', 'archived']),
                name='chk_blog_post_status',
            ),
            models.CheckConstraint(
                check=~models.Q(status='published') | models.Q(published_at__isnull=False),
                name='chk_blog_post_published_at',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ps')
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class PinnedPost(models.Model):
    """Bài viết ghim theo vị trí — khối "Tài liệu hỗ trợ tìm việc" ở sidebar.

    Trỏ FK thẳng vào `Post` (thay vì lưu label/url nhập tay) để tiêu đề luôn
    khớp bài thật và bài gỡ xuống thì tự ẩn khỏi sidebar. `placement` mở đường
    tái dùng cho các vị trí ghim khác về sau.
    """

    class Placement(models.TextChoices):
        SUPPORT_DOCS = 'support_docs', 'Tài liệu hỗ trợ tìm việc (sidebar bài viết)'

    placement = models.CharField(max_length=30, choices=Placement.choices, default=Placement.SUPPORT_DOCS)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='pins')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['placement', 'order']
        verbose_name = 'Bài viết ghim'
        verbose_name_plural = 'Bài viết ghim'
        constraints = [
            models.UniqueConstraint(fields=['placement', 'post'], name='uq_blog_pinned_placement_post'),
        ]

    def __str__(self):
        return f'{self.get_placement_display()} — {self.post.title}'
