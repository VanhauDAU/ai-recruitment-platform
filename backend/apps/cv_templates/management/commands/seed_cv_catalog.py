"""Seed CV Builder template colors, position profiles and sample contents.

Idempotent: every row uses get_or_create. Sample contents are keyed by
(position profile, locale, experience band) — profile null means generic content
with `{position}` tokens — and are never overwritten once an editor owns them.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.cv_templates.models import (
    CvColor,
    CvPositionField,
    CvPositionProfile,
    CvSampleContent,
    CvTemplate,
    CvTemplateColorLink,
    ExperienceBand,
)
from apps.cv_templates.seed_data.position_fields import POSITION_SETUP
from apps.cv_templates.seed_data.sample_contents import (
    DEFAULT_COLORS,
    LOCALE_TEXTS,
    SAMPLE_POSITIONS,
    SKILLS_FIRST_POSITIONS,
    SKILLS_FIRST_PRESET,
    build_generic_content,
    build_sample_content,
)
from apps.jobs.models import JobCategory, JobCategoryLocalization


class Command(BaseCommand):
    help = 'Seed CV template taxonomy, colors and per-position sample contents (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        profiles = {}
        for category in JobCategory.objects.filter(
            category_type=JobCategory.CategoryType.SPECIALIZATION,
            status=JobCategory.Status.ACTIVE,
        ):
            JobCategoryLocalization.objects.get_or_create(
                category=category,
                locale=JobCategoryLocalization.Locale.VI,
                defaults={'display_name': category.name, 'is_active': True},
            )
            profile, _ = CvPositionProfile.objects.get_or_create(job_category=category)
            # Chỉ điền preset khi profile chưa được cấu hình, không ghi đè admin.
            if category.name in SKILLS_FIRST_POSITIONS and not profile.section_preset:
                profile.section_preset = SKILLS_FIRST_PRESET
                profile.full_clean()
                profile.save(update_fields=['section_preset', 'updated_at'])
            profiles[category.name] = profile

        fields_created = self._seed_position_fields(profiles)
        samples_created = 0
        for locale in LOCALE_TEXTS:
            for band in ExperienceBand:
                samples_created += self._seed_sample(
                    profile=None,
                    locale=locale,
                    band=band,
                    title=LOCALE_TEXTS[locale]['title'],
                    content=build_generic_content(locale, band),
                )

        colors = []
        for index, (name, slug, hex_code) in enumerate(DEFAULT_COLORS):
            color, _ = CvColor.objects.get_or_create(
                hex_code=hex_code,
                defaults={'name': name, 'slug': slug, 'sort_order': index, 'is_active': True},
            )
            colors.append(color)

        color_links_created = 0
        for template in CvTemplate.objects.filter(
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__isnull=False,
        ):
            version = template.current_published_version
            theme = str((version.default_style_json or {}).get('theme_color', '#00A66A')).upper()
            theme_color, _ = CvColor.objects.get_or_create(
                hex_code=theme,
                defaults={
                    'name': f'Màu {theme}',
                    'slug': f'color-{theme.lstrip("#").lower()}',
                },
            )
            ordered_colors = [
                theme_color,
                *[color for color in colors if color.pk != theme_color.pk],
            ]
            has_default = template.color_links.filter(is_default=True).exists()
            for index, color in enumerate(ordered_colors):
                _, created = CvTemplateColorLink.objects.get_or_create(
                    template=template,
                    color=color,
                    defaults={
                        'is_default': index == 0 and not has_default,
                        'sort_order': index,
                    },
                )
                color_links_created += int(created)

        names = {
            (item.category_id, item.locale): item.display_name
            for item in JobCategoryLocalization.objects.filter(
                category__name__in=SAMPLE_POSITIONS, is_active=True
            )
        }
        for name in SAMPLE_POSITIONS:
            profile = profiles.get(name)
            if not profile:
                self.stdout.write(self.style.WARNING(f'Specialization not found, skipped: {name}'))
                continue
            for locale in LOCALE_TEXTS:
                position_name = names.get((profile.job_category_id, locale))
                if not position_name:
                    continue
                samples_created += self._seed_sample(
                    profile=profile,
                    locale=locale,
                    band=ExperienceBand.MID,
                    title=LOCALE_TEXTS[locale]['title'].replace('{position}', position_name),
                    content=build_sample_content(locale, position_name),
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {color_links_created} template color link(s), '
                f'{fields_created} position field(s) and '
                f'{samples_created} sample content(s) created.'
            )
        )

    def _seed_position_fields(self, profiles):
        """Từ khóa và trường riêng đề xuất; không ghi đè cấu hình admin đã có."""
        created_count = 0
        for name, setup in POSITION_SETUP.items():
            profile = profiles.get(name)
            if profile is None:
                continue
            if not profile.keywords:
                profile.keywords = setup['keywords']
                profile.full_clean()
                profile.save(update_fields=['keywords', 'updated_at'])
            for order, data in enumerate(setup['fields']):
                field, created = CvPositionField.objects.get_or_create(
                    profile=profile,
                    key=data['key'],
                    defaults={**data, 'sort_order': order},
                )
                if created:
                    field.full_clean()
                created_count += int(created)
        return created_count

    def _seed_sample(self, *, profile, locale, band, title, content):
        sample, created = CvSampleContent.objects.get_or_create(
            position_profile=profile,
            locale=locale,
            experience_band=band,
            status=CvSampleContent.Status.PUBLISHED,
            defaults={
                'title': title,
                'content_json': content,
                'published_at': timezone.now(),
            },
        )
        if created:
            sample.full_clean()
        return int(created)
