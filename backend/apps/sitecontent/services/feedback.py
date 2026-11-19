"""Product feedback from the floating "Góp ý" button."""

from ..models import Feedback


def submit_feedback(*, user=None, **data):
    # Người đã đăng nhập bỏ trống ô email -> lấy email tài khoản để còn phản hồi được.
    data['email'] = data.get('email') or (user.email if user else '')
    return Feedback.objects.create(user=user, **data)
