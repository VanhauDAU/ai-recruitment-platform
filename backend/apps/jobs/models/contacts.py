from django.db import models

from .core import Job


class JobApplicationContact(models.Model):
    """Internal notification recipient; never expose through public job APIs."""

    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name='application_contact')
    recipient_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.recipient_name} - {self.job}'


class JobApplicationEmail(models.Model):
    contact = models.ForeignKey(JobApplicationContact, on_delete=models.CASCADE, related_name='emails')
    email = models.EmailField()
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']
        constraints = [models.UniqueConstraint(fields=['contact', 'email'], name='uq_job_contact_email')]

