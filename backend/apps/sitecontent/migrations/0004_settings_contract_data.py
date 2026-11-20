"""Hợp đồng cấu hình (ADR-0026): gỡ key không có code đọc, xếp lại nhóm.

Các key bị gỡ không có consumer, hoặc giá trị thật nằm ở .env (giờ hiển thị ở
bảng thông số chỉ đọc). Danh sách được đóng băng tại đây, không đọc seed hiện
hành. Reverse không khôi phục row: chạy lại ``seed_sitecontent`` của bản cũ nếu
thật sự cần.
"""

from django.db import migrations

REMOVED_KEYS = (
    'payment_enabled',
    'payment_currency',
    'payment_vnpay_enabled',
    'payment_vnpay_configured',
    'payment_momo_enabled',
    'payment_bank_transfer_info',
    'payment_trial_days',
    'seo_default_keywords',
    'seo_google_analytics_id',
    'candidate_require_email_verification',
    'candidate_max_applications_per_day',
    'candidate_allow_avatar_upload',
    'candidate_profile_completion_required',
    'employer_require_approval',
    'employer_require_company_info',
    'employer_max_active_jobs',
    'employer_allow_logo_upload',
    'job_expiry_days',
    'jobs_per_page',
    'job_allow_salary_negotiable',
    'job_require_salary_range',
    'job_allow_urgent_tag',
    'cv_allow_pdf_export',
    'cv_default_template',
    'cv_allow_public_share',
    'cv_watermark_enabled',
    'cv_ai_review_free_limit',
    'security_min_password_length',
    'security_require_strong_password',
    'security_max_login_attempts',
    'security_lockout_minutes',
    'security_session_timeout_minutes',
    'security_recaptcha_enabled',
    'security_recaptcha_site_key',
    'upload_max_image_size_mb',
    'upload_avatar_max_size_mb',
    'upload_max_cv_size_mb',
    'upload_allowed_image_types',
    'upload_allowed_cv_types',
    'email_notify_job_approved',
    'email_smtp_configured',
    'ai_api_key_configured',
    'ai_cv_review_enabled',
    'ai_daily_request_limit',
    'blog_meta_description',
    'blog_benefits',
)

GROUP_KEYS = {
    'brand': (
        'site_name',
        'site_tagline',
        'brand_logo_url',
        'brand_logo_mark_url',
        'brand_favicon_url',
        'brand_primary_color',
    ),
    'homepage': (
        'home_show_banner',
        'home_show_stats',
        'home_show_categories',
        'home_show_featured_jobs',
        'home_featured_jobs_count',
        'home_show_cv_templates',
        'home_show_popular_searches',
    ),
    'seo': (
        'seo_default_title',
        'seo_default_description',
        'seo_og_image',
        'seo_robots_index',
        'seo_google_site_verification',
    ),
    'contact': (
        'hotline',
        'support_email',
        'contact_address',
        'contact_working_hours',
        'contact_zalo_url',
        'contact_messenger_url',
        'contact_map_embed_url',
        'employer_hotline_north',
        'employer_hotline_south',
        'footer_facebook_url',
        'footer_linkedin_url',
        'footer_youtube_url',
        'footer_tiktok_url',
    ),
    'footer': (
        'footer_logo_url',
        'footer_description',
        'footer_copyright',
        'footer_company_name',
        'footer_business_license',
        'footer_app_store_url',
        'footer_google_play_url',
        'footer_qr_code_url',
        'footer_qr_label',
        'footer_show_link_groups',
        'footer_show_contact',
        'footer_show_apps',
        'footer_show_socials',
    ),
    'blog': (
        'blog_page_title',
        'blog_support_docs_title',
    ),
    'accounts': (
        'candidate_allow_registration',
        'employer_allow_registration',
    ),
    'employer': (
        'employer_free_job_quota',
        'employer_verified_level_three_job_quota',
        'employer_badge_min_account_months',
        'employer_stats',
        'employer_partners',
    ),
    'cv': (
        'candidate_max_cvs',
        'cv_builder_wysiwyg_enabled',
    ),
    'email': (
        'email_notifications_enabled',
        'email_notify_new_application',
        'email_welcome_enabled',
        'email_from_name',
        'email_footer_text',
    ),
    'ai': (
        'ai_enabled',
        'ai_provider',
        'ai_model',
        'ai_job_match_enabled',
        'ai_job_recommendation_semantic_enabled',
        'ai_data_policy_url',
        'ai_job_generation_enabled',
        'ai_job_generation_model',
        'ai_job_generation_model_allowlist',
        'ai_job_generation_daily_limit',
        'ai_job_generation_rollout_percent',
        'ai_job_generation_company_allowlist',
    ),
    'operations': (
        'maintenance_mode',
        'maintenance_message',
    ),
}

# Key tự thêm ngoài seed: chuyển theo nhóm cũ để không rơi khỏi trang quản trị.
LEGACY_GROUPS = {
    'general': 'brand',
    'candidate': 'cv',
    'payment': 'operations',
    'security': 'operations',
    'upload': 'operations',
}


def forwards(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.filter(key__in=REMOVED_KEYS).delete()
    for group, keys in GROUP_KEYS.items():
        SiteSetting.objects.filter(key__in=keys).update(group=group)
    for old, new in LEGACY_GROUPS.items():
        SiteSetting.objects.filter(group=old).update(group=new)


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0003_settings_contract_fields')]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
