"""Slug duy nhất cho các bảng danh mục có `slug` unique."""

from django.utils.text import slugify


def unique_slug(model, name, *, exclude_pk=None, max_length=240):
    """Slug từ tên, thêm hậu tố khi trùng: "C", "C++", "C#" đều cho ra "c"."""
    base = slugify(name)[:max_length] or 'muc'
    taken = set(
        model.objects.filter(slug__startswith=base)
        .exclude(pk=exclude_pk)
        .values_list('slug', flat=True)
    )
    slug, suffix = base, 2
    while slug in taken:
        slug, suffix = f'{base}-{suffix}', suffix + 1
    return slug
