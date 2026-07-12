"""Job-posting mutation workflows."""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.employers.models import RecruiterProfile

from ..models import Job


@transaction.atomic
def create_pending_job(serializer, user):
    """Create a pending posting for the recruiter's approved company."""
    recruiter = RecruiterProfile.objects.select_related('company').filter(user=user).first()
    if recruiter is None or recruiter.company_id is None:
        raise ValidationError('Cập nhật thông tin công ty trước khi đăng tin.')
    if recruiter.membership_status != RecruiterProfile.MembershipStatus.APPROVED:
        raise ValidationError('Tài khoản của bạn đang chờ duyệt vào công ty nên chưa thể đăng tin.')
    return serializer.save(
        posted_by=user,
        company=recruiter.company,
        status=Job.Status.PENDING,
    )


@transaction.atomic
def update_employer_job(serializer):
    """Persist an employer's existing job through the domain mutation boundary."""
    return serializer.save()
