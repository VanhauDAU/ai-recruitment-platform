from apps.blog.models import Post


def published_blog_post_for_speech(public_id):
    """Return only the public fields needed to build a speech script."""
    return (
        Post.objects.filter(public_id=public_id, status=Post.Status.PUBLISHED)
        .only('public_id', 'title', 'content', 'status', 'edit_revision')
        .first()
    )
