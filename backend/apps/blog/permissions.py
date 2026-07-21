from rest_framework.permissions import BasePermission


class CanEditBlog(BasePermission):
    """Nhân viên có quyền soạn/sửa bài viết (biên tập viên hoặc quản lý nội dung)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_staff
            and (user.has_perm('blog.add_post') or user.has_perm('blog.change_post'))
        )
