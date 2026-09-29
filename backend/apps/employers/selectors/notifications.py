from ..models import EmployerActivity, EmployerNotification


def employer_notification_queryset(user):
    return EmployerNotification.objects.filter(recipient=user).order_by('-created_at', '-id')


def employer_activity_queryset(user):
    return EmployerActivity.objects.filter(recipient=user).order_by('-occurred_at', '-id')


def employer_unread_notification_count(user):
    return EmployerNotification.objects.filter(recipient=user, read_at__isnull=True).count()
