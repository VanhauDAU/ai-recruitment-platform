from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.public_id import generate_public_id


class Industry(models.Model):
    """Lĩnh vực hoạt động (Fintech, Bán lẻ, Giáo dục...). Một công ty có thể
    thuộc nhiều lĩnh vực cùng lúc — xem `EmployerProfile.industries`."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)

    class Meta:
        verbose_name_plural = 'industries'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class EmployerProfile(models.Model):
    """Company/recruiter profile (DB doc section 2.3).

    Intentionally 1-1 with a single user account — this scope does not
    support multiple HR staff sharing one company (documented limitation,
    not an oversight; would need a separate companies table to lift it).
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    public_id = models.CharField(max_length=50, unique=True, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='employer_profile')
    company_name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    company_logo_url = models.TextField(blank=True)
    cover_image_url = models.TextField(blank=True)
    company_size = models.CharField(max_length=100, blank=True)
    industries = models.ManyToManyField(Industry, blank=True, related_name='employers')
    founded_year = models.IntegerField(null=True, blank=True)
    website_url = models.TextField(blank=True)
    tax_code = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.PENDING)
    verified_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(status__in=['pending', 'approved', 'rejected']),
                name='chk_employer_status',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id('co')
        if not self.slug:
            self.slug = slugify(self.company_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.company_name
