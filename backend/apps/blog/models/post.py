from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id

from .slug import friendly_post_slug


class PostCategory(models.Model):
    """Danh mục bài viết cẩm nang nghề nghiệp (thanh danh mục ngang ở /blog).

    Taxonomy phẳng 1 cấp: breadcrumb chỉ hiển thị một cấp danh mục
    (Trang chủ > Cẩm nang nghề nghiệp > <Danh mục> > <Bài viết>). Đây là
    taxonomy biên tập nội dung, tách biệt với `jobs.JobCategory` (phân loại
    tin tuyển dụng) dù có danh mục trùng tên như "Kiến thức chuyên ngành".
    """

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(
        max_length=160,
        unique=True,
        blank=True,
        help_text='Dùng cho URL /blog/danh-muc/<slug> và SEO',
    )
    description = models.CharField(
        max_length=300, blank=True, help_text='Mô tả ngắn, dùng cho meta description trang danh mục'
    )
    order = models.PositiveSmallIntegerField(
        default=0, help_text='Thứ tự trên thanh danh mục ngang'
    )
    is_active = models.BooleanField(default=True, help_text='Tắt danh mục mà không xóa bài')
    seo_title = models.CharField(max_length=200, blank=True, help_text='Ghi đè title tag nếu cần')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Danh mục bài viết'
        verbose_name_plural = 'Danh mục bài viết'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('pcat')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Thẻ gắn vào bài viết (vd: kinh doanh). Có slug cho trang lọc /blog/tag/<slug>."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    is_active = models.BooleanField(
        default=True, help_text='Ẩn thẻ khỏi phía ứng viên và form chọn thẻ'
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'Thẻ bài viết'
        verbose_name_plural = 'Thẻ bài viết'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ptag')
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class BlogMediaAsset(models.Model):
    """Metadata của ảnh có thể dùng lại trong trình soạn thảo blog."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    storage_key = models.TextField(unique=True)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_blog_media',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name = 'Ảnh nội dung blog'
        verbose_name_plural = 'Kho ảnh nội dung blog'
        indexes = [models.Index(fields=['-created_at'], name='blog_media_created_idx')]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('pmedia')
        super().save(*args, **kwargs)

    def __str__(self):
        return self.original_name


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
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        help_text='URL /blog/<slug>; auto từ tiêu đề, sửa tay được để tối ưu SEO',
    )
    category = models.ForeignKey(PostCategory, on_delete=models.PROTECT, related_name='posts')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blog_posts',
        help_text='Nhân viên soạn bài; giữ bài khi xóa tài khoản',
    )
    summary = models.CharField(
        max_length=500, blank=True, help_text='Sapo/mô tả ngắn: card danh sách + meta description'
    )
    thumbnail_url = models.TextField(
        blank=True, help_text='Storage key nội bộ hoặc URL ngoài; API tự resolve thành URL public'
    )
    content = models.TextField(help_text='Nội dung HTML từ rich-text editor')
    related_job_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blog_posts',
        help_text='Nguồn cho khối "Danh sách việc làm ..." trong bài; để trống thì ẩn khối',
    )
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(
        null=True, blank=True, help_text='Ngày đăng hiển thị; set lần đầu khi xuất bản'
    )
    view_count = models.PositiveIntegerField(default=0)
    seo_title = models.CharField(max_length=200, blank=True, help_text='Ghi đè title tag')
    seo_description = models.CharField(
        max_length=300, blank=True, help_text='Ghi đè meta description (mặc định dùng summary)'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    edit_revision = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', '-created_at']
        verbose_name = 'Bài viết'
        verbose_name_plural = 'Bài viết'
        permissions = [('can_publish_post', 'Có thể duyệt và xuất bản bài viết')]
        indexes = [
            models.Index(fields=['status', '-published_at']),
            models.Index(
                fields=['category', 'status', '-published_at'], name='blog_post_category_status_idx'
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['draft', 'pending', 'published', 'archived']),
                name='chk_blog_post_status',
            ),
            models.CheckConstraint(
                condition=~models.Q(status='published') | models.Q(published_at__isnull=False),
                name='chk_blog_post_published_at',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ps')
        if not self.slug:
            base_slug = friendly_post_slug(self.title)
            candidate = base_slug
            suffix = 2
            queryset = type(self).objects.exclude(pk=self.pk)
            while queryset.filter(slug=candidate).exists():
                suffix_text = f'-{suffix}'
                candidate = f'{base_slug[: 255 - len(suffix_text)].rstrip("-")}{suffix_text}'
                suffix += 1
            self.slug = candidate
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

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    placement = models.CharField(
        max_length=30, choices=Placement.choices, default=Placement.SUPPORT_DOCS
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='pins')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['placement', 'order']
        verbose_name = 'Bài viết ghim'
        verbose_name_plural = 'Bài viết ghim'
        constraints = [
            models.UniqueConstraint(
                fields=['placement', 'post'], name='uq_blog_pinned_placement_post'
            ),
        ]

    def __str__(self):
        return f'{self.get_placement_display()} — {self.post.title}'

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('ppin')
        super().save(*args, **kwargs)


class PostWorkingCopy(models.Model):
    """Một bản sửa duy nhất cho bài đang public.

    Bản public tiếp tục nằm trên ``Post``. Working copy bị xóa sau khi duyệt
    hoặc hủy, nên đây không phải kho version history dài hạn.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Nháp'
        PENDING = 'pending', 'Chờ duyệt'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='working_copy')
    title = models.CharField(max_length=255)
    category = models.ForeignKey(
        PostCategory, on_delete=models.PROTECT, related_name='working_copies'
    )
    summary = models.CharField(max_length=500, blank=True)
    thumbnail_url = models.TextField(blank=True)
    content = models.TextField()
    related_job_category = models.ForeignKey(
        'jobs.JobCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='blog_working_copies',
    )
    tags = models.ManyToManyField(Tag, related_name='working_copies', blank=True)
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    edit_revision = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_blog_working_copies',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_blog_working_copies',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('pwc')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Bản sửa: {self.title}'


class PostStatusHistory(models.Model):
    """Timeline nghiệp vụ; autosave không tạo bản ghi để tránh nhiễu."""

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='status_history')
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='blog_status_changes',
    )
    action = models.CharField(max_length=40)
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    note = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['post', '-created_at'], name='blog_history_post_created_idx')
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('phist')
        super().save(*args, **kwargs)
