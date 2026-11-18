"""Quy tắc ảnh của ``CvAsset`` (avatar và ảnh nền catalogue): kích thước và định dạng."""

MAX_CV_IMAGE_BYTES = 5 * 1024 * 1024
CV_IMAGE_FORMATS = {
    'JPEG': ('jpg', 'image/jpeg'),
    'PNG': ('png', 'image/png'),
    'WEBP': ('webp', 'image/webp'),
}
