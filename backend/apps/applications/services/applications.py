"""Write workflows for the applications domain."""

from django.utils import timezone

from ..models import Application


STATUS_TIMESTAMP_FIELD = {
    Application.Status.VIEWED: 'viewed_at',
    Application.Status.SHORTLISTED: 'shortlisted_at',
    Application.Status.INTERVIEWED: 'interviewed_at',
    Application.Status.REJECTED: 'rejected_at',
    Application.Status.ACCEPTED: 'accepted_at',
}


def create_application(serializer, candidate):
    """Persist a candidate's validated application."""
    return serializer.save(candidate=candidate)


def update_application_status(serializer):
    """Persist the status and its first-class transition timestamp."""
    status = serializer.validated_data.get('status')
    timestamp_field = STATUS_TIMESTAMP_FIELD.get(status)
    return serializer.save(**({timestamp_field: timezone.now()} if timestamp_field else {}))
