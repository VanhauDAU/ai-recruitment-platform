from django.db.models import F

from .models import Post


def record_post_view(post):
    """Tăng lượt xem của bài viết một cách nguyên tử rồi làm mới instance."""
    Post.objects.filter(pk=post.pk).update(view_count=F('view_count') + 1)
    post.refresh_from_db(fields=['view_count'])
    return post
