from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import CandidateProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_candidate_profile(sender, instance, created, **kwargs):
    if created and instance.role == instance.Role.CANDIDATE:
        CandidateProfile.objects.get_or_create(user=instance)
