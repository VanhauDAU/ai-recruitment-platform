from django.db import migrations

from common.public_id import generate_public_id

# employer_profiles.status -> companies.verification_status
STATUS_MAP = {'pending': 'pending', 'approved': 'verified', 'rejected': 'rejected'}

SIZE_VALUES = {'1-9', '10-24', '25-99', '100-499', '500-1000', '1000+', '3000+', '5000+', '10000+'}


def normalize_size(raw):
    """'1000+ nhân viên' -> '1000+'; giá trị không khớp bucket nào thì bỏ trống."""
    value = raw.replace('nhân viên', '').replace(' ', '').strip()
    return value if value in SIZE_VALUES else ''


def forwards(apps, schema_editor):
    """Mỗi employer_profile -> 1 company + 1 recruiter_profile (owner).

    Profile trùng tax_code được gộp về 1 company (ưu tiên bản approved, rồi
    mới nhất) — các HR còn lại thành member; membership đều `approved` để
    không khoá tài khoản đang hoạt động (luồng duyệt chỉ áp cho join mới).
    """
    EmployerProfile = apps.get_model('employers', 'EmployerProfile')
    Company = apps.get_model('employers', 'Company')
    CompanyIndustry = apps.get_model('employers', 'CompanyIndustry')
    RecruiterProfile = apps.get_model('employers', 'RecruiterProfile')

    profiles = list(
        EmployerProfile.objects.select_related('user').prefetch_related('industries').order_by('created_at')
    )
    groups = {}
    for profile in profiles:
        # tax_code rỗng: không gộp, mỗi profile là một công ty riêng
        key = profile.tax_code or f'__solo_{profile.pk}'
        groups.setdefault(key, []).append(profile)

    for key, group in groups.items():
        winner = sorted(group, key=lambda p: (p.status != 'approved', -p.created_at.timestamp()))[0]
        company = Company.objects.create(
            public_id=winner.public_id,
            slug=winner.slug,
            tax_code=winner.tax_code or None,
            company_name=winner.company_name,
            logo_url=winner.company_logo_url,
            cover_image_url=winner.cover_image_url,
            website_url=winner.website_url,
            address=winner.address,
            company_size=normalize_size(winner.company_size),
            description=winner.description,
            founded_year=winner.founded_year,
            has_brand_page=winner.has_brand_page,
            verification_status=STATUS_MAP.get(winner.status, 'unverified'),
            verified_at=winner.verified_at,
            rejected_reason=winner.rejected_reason,
            created_by=winner.user,
        )
        # auto_now_add ghi đè khi insert -> giữ mốc thời gian gốc bằng update
        Company.objects.filter(pk=company.pk).update(created_at=winner.created_at, updated_at=winner.updated_at)

        seen_industries = set()
        for profile in [winner] + [p for p in group if p is not winner]:
            for industry in profile.industries.all():
                if industry.pk in seen_industries:
                    continue
                seen_industries.add(industry.pk)
                CompanyIndustry.objects.create(
                    company=company,
                    industry=industry,
                    is_primary=len(seen_industries) == 1 and profile is winner,
                )

        for profile in group:
            RecruiterProfile.objects.create(
                public_id=generate_public_id('rec'),
                user=profile.user,
                company=company,
                company_role='owner' if profile is winner else 'member',
                membership_status='approved',
            )


def backwards(apps, schema_editor):
    """employer_profiles không bị đụng tới nên chỉ cần dọn bảng mới."""
    for model_name in ['RecruiterProfile', 'CompanyIndustry', 'CompanyImage', 'Company']:
        apps.get_model('employers', model_name).objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0006_company_companyimage_companyindustry_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
