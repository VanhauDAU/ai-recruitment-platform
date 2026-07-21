"""Chuyển URL media legacy thành storage key độc lập môi trường."""

from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.cvs.models import UserCv
from apps.employers.models import Company, CompanyDocument, CompanyImage
from apps.jobs.models import JobCategory
from apps.sitecontent.models import Banner, SiteSetting
from common.media_storage import normalise_media_value

MEDIA_FIELDS = (
    (User, ('avatar_url',)),
    (Company, ('logo_url', 'cover_image_url')),
    (CompanyImage, ('image_url',)),
    (CompanyDocument, ('file_url',)),
    (JobCategory, ('logo_url',)),
    (Banner, ('image_url',)),
    (SiteSetting, ('value',)),
    (UserCv, ('file_url', 'pdf_url', 'thumbnail_url')),
)


class Command(BaseCommand):
    help = 'Chuẩn hoá URL /media/ legacy thành storage key; URL ngoài hệ thống được giữ nguyên.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Ghi thay đổi. Nếu không có cờ này, lệnh chỉ kiểm tra (dry run).',
        )

    def handle(self, *args, **options):
        changes = []
        for model, fields in MEDIA_FIELDS:
            for instance in model.objects.all().iterator():
                updated_fields = []
                for field in fields:
                    value = getattr(instance, field)
                    # SiteSetting chỉ chuẩn hoá setting dạng image; các string
                    # khác có thể tình cờ chứa URL /media/ trong nội dung text.
                    if model is SiteSetting and instance.value_type != SiteSetting.ValueType.IMAGE:
                        continue
                    normalised = normalise_media_value(value)
                    if normalised != value:
                        changes.append((model._meta.label, instance.pk, field, value, normalised))
                        setattr(instance, field, normalised)
                        updated_fields.append(field)
                if updated_fields and options['apply']:
                    instance.save(
                        update_fields=[*updated_fields, 'updated_at']
                        if hasattr(instance, 'updated_at')
                        else updated_fields
                    )

        mode = 'Đã cập nhật' if options['apply'] else 'Dry run — sẽ cập nhật'
        self.stdout.write(self.style.SUCCESS(f'{mode} {len(changes)} tham chiếu media.'))
        for label, pk, field, old_value, new_value in changes:
            self.stdout.write(f'{label}#{pk}.{field}: {old_value!r} -> {new_value!r}')
