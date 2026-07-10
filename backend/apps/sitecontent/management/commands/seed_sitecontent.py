from django.core.management.base import BaseCommand

from apps.sitecontent.models import Banner, LinkGroup, LinkItem, SiteSetting

# Cấu hình mẫu để trang chạy ngay; admin chỉnh/thêm sau qua trang quản trị.
# Seed idempotent: đồng bộ metadata (label/group/type/options/order/is_public)
# nhưng KHÔNG ghi đè value admin đã chỉnh.
PROCV_LOGO_URL = '/images/logo/logo-full.png'
PROCV_MARK_URL = '/images/logo/logo-mark.png'
PROCV_FAVICON_URL = '/favicon-32.png'
LEGACY_BRAND_VALUES = {
    '', '/images/logo/aicareer-logo.svg', '/favicon.svg',
    # 2 ảnh gốc nặng (957KB/376KB) đã bị xoá khỏi frontend/public — DB nào còn
    # trỏ vào là ảnh vỡ; seed ép về bản resize nhẹ ở trên.
    '/images/logo/logo_proCV_2000_2000.png',
    '/images/logo/logo_proCV_2000_600.png',
}
BRAND_ASSET_KEYS = {'brand_logo_url', 'brand_logo_mark_url', 'brand_favicon_url'}

G = SiteSetting.Group
T = SiteSetting.ValueType

# (key, label, group, value_type, default, is_public, description, options)
# order = vị trí trong nhóm (tự đánh khi seed).
SETTINGS = [
    # ---- 1. Cài đặt chung ----
    ('site_name', 'Tên site', G.GENERAL, T.TEXT, 'ProCV', True,
     'Tên thương hiệu hiển thị ở header, footer và các màn đăng nhập/đăng ký.', {}),
    ('site_tagline', 'Slogan', G.GENERAL, T.TEXT, 'Nền tảng việc làm & AI Career Coach', True,
     'Câu slogan ngắn hiển thị kèm tên site.', {}),
    ('brand_logo_url', 'Logo đầy đủ', G.GENERAL, T.IMAGE, PROCV_LOGO_URL, True,
     'Logo dạng ngang/wordmark dùng ở header.', {}),
    ('brand_logo_mark_url', 'Logo biểu tượng', G.GENERAL, T.IMAGE, PROCV_MARK_URL, True,
     'Logo vuông/icon dùng ở màn đăng nhập hoặc nơi thiếu diện tích.', {}),
    ('brand_favicon_url', 'Favicon', G.GENERAL, T.IMAGE, PROCV_FAVICON_URL, True,
     'Icon cho tab trình duyệt. Ảnh upload sẽ tự resize xuống tối đa 256x256 để tránh nặng trang.', {}),
    ('brand_primary_color', 'Màu thương hiệu chính', G.GENERAL, T.COLOR, '#00b14f', True,
     'Mã màu hex dùng làm biến --brand-primary cho giao diện.', {}),
    ('maintenance_mode', 'Chế độ bảo trì', G.GENERAL, T.BOOLEAN, False, True,
     'Bật để hiển thị thông báo bảo trì thay cho nội dung site.', {}),
    ('maintenance_message', 'Thông báo bảo trì', G.GENERAL, T.TEXTAREA,
     'Hệ thống đang bảo trì, vui lòng quay lại sau.', True, '', {}),

    # ---- 2. Giao diện trang chủ ----
    ('home_show_banner', 'Hiện carousel banner', G.HOMEPAGE, T.BOOLEAN, True, True, '', {}),
    ('home_show_stats', 'Hiện khối thống kê', G.HOMEPAGE, T.BOOLEAN, True, True, '', {}),
    ('home_show_categories', 'Hiện ngành nghề nổi bật', G.HOMEPAGE, T.BOOLEAN, True, True, '', {}),
    ('home_show_featured_jobs', 'Hiện việc làm nổi bật', G.HOMEPAGE, T.BOOLEAN, True, True, '', {}),
    ('home_featured_jobs_count', 'Số việc làm nổi bật', G.HOMEPAGE, T.NUMBER, 12, True,
     'Số tin hiển thị ở khối việc làm nổi bật trang chủ.', {}),
    ('home_show_cv_templates', 'Hiện khối mẫu CV', G.HOMEPAGE, T.BOOLEAN, True, True, '', {}),
    ('home_show_popular_searches', 'Hiện cụm link SEO', G.HOMEPAGE, T.BOOLEAN, True, True,
     'Khối "Tra cứu phổ biến" cuối trang chủ (dữ liệu từ Cụm link).', {}),

    # ---- 3. SEO ----
    ('seo_default_title', 'Tiêu đề mặc định', G.SEO, T.TEXT,
     'ProCV - Việc làm & Tạo CV cùng AI', True, 'Thẻ <title> mặc định khi trang không tự đặt.', {}),
    ('seo_default_description', 'Mô tả mặc định', G.SEO, T.TEXTAREA,
     'ProCV - Nền tảng tìm việc làm, tạo CV chuyên nghiệp và phát triển sự nghiệp cùng AI.', True,
     'Thẻ meta description mặc định.', {}),
    ('seo_default_keywords', 'Từ khoá mặc định', G.SEO, T.TEXT,
     'việc làm, tuyển dụng, tạo cv, ai', True, '', {}),
    ('seo_og_image', 'Ảnh OG mặc định', G.SEO, T.IMAGE, '', True,
     'Ảnh hiển thị khi chia sẻ link lên mạng xã hội.', {}),
    ('seo_robots_index', 'Cho phép index', G.SEO, T.BOOLEAN, True, True,
     'Tắt để chặn công cụ tìm kiếm index toàn site (robots noindex).', {}),
    ('seo_google_analytics_id', 'Google Analytics ID', G.SEO, T.TEXT, '', True,
     'VD: G-XXXXXXXXXX. Để trống nếu chưa dùng.', {}),
    ('seo_google_site_verification', 'Google Search Console verification', G.SEO, T.TEXT, '', True, '', {}),

    # ---- 4. Tài khoản ứng viên ----
    ('candidate_allow_registration', 'Cho phép đăng ký ứng viên', G.CANDIDATE, T.BOOLEAN, True, True, '', {}),
    ('candidate_require_email_verification', 'Bắt buộc xác thực email', G.CANDIDATE, T.BOOLEAN, False, True, '', {}),
    ('candidate_max_cvs', 'Số CV tối đa mỗi người', G.CANDIDATE, T.NUMBER, 10, True, '', {}),
    ('candidate_max_applications_per_day', 'Giới hạn ứng tuyển mỗi ngày', G.CANDIDATE, T.NUMBER, 20, False, '', {}),
    ('candidate_allow_avatar_upload', 'Cho phép upload avatar', G.CANDIDATE, T.BOOLEAN, True, True, '', {}),
    ('candidate_profile_completion_required', 'Bắt buộc hoàn thiện hồ sơ để ứng tuyển',
     G.CANDIDATE, T.BOOLEAN, False, True, '', {}),

    # ---- 5. Nhà tuyển dụng ----
    ('employer_allow_registration', 'Cho phép đăng ký NTD', G.EMPLOYER, T.BOOLEAN, True, True, '', {}),
    ('employer_require_approval', 'Duyệt tài khoản NTD trước khi hoạt động', G.EMPLOYER, T.BOOLEAN, True, False, '', {}),
    ('employer_require_company_info', 'Bắt buộc thông tin công ty', G.EMPLOYER, T.BOOLEAN, True, False, '', {}),
    ('employer_max_active_jobs', 'Số tin đang đăng tối đa', G.EMPLOYER, T.NUMBER, 10, False, '', {}),
    ('employer_allow_logo_upload', 'Cho phép upload logo công ty', G.EMPLOYER, T.BOOLEAN, True, True, '', {}),

    # ---- 6. Việc làm ----
    ('job_expiry_days', 'Số ngày hết hạn tin', G.JOBS, T.NUMBER, 30, False,
     'Tin tự chuyển hết hạn sau số ngày này kể từ khi đăng.', {}),
    ('jobs_per_page', 'Số tin mỗi trang', G.JOBS, T.NUMBER, 20, True, '', {}),
    ('job_auto_approve', 'Tự động duyệt tin', G.JOBS, T.BOOLEAN, False, False,
     'Bật để tin đăng hiển thị ngay không cần admin duyệt.', {}),
    ('job_allow_salary_negotiable', 'Cho phép lương thoả thuận', G.JOBS, T.BOOLEAN, True, True, '', {}),
    ('job_require_salary_range', 'Bắt buộc khoảng lương', G.JOBS, T.BOOLEAN, False, False, '', {}),
    ('job_allow_urgent_tag', 'Cho phép tag tuyển gấp', G.JOBS, T.BOOLEAN, True, True, '', {}),

    # ---- 7. Hồ sơ / CV ----
    ('cv_allow_pdf_export', 'Cho phép xuất PDF', G.CV, T.BOOLEAN, True, True, '', {}),
    ('cv_default_template', 'Mẫu CV mặc định', G.CV, T.SELECT, 'modern', True, '',
     {'choices': [{'value': 'modern', 'label': 'Modern'}, {'value': 'classic', 'label': 'Classic'},
                  {'value': 'minimal', 'label': 'Minimal'}]}),
    ('cv_allow_public_share', 'Cho phép chia sẻ CV công khai', G.CV, T.BOOLEAN, True, True, '', {}),
    ('cv_watermark_enabled', 'Đóng watermark bản miễn phí', G.CV, T.BOOLEAN, False, True, '', {}),
    ('cv_ai_review_free_limit', 'Lượt AI review miễn phí', G.CV, T.NUMBER, 3, False, '', {}),

    # ---- 8. Email & thông báo ----
    ('email_notifications_enabled', 'Bật gửi email', G.EMAIL, T.BOOLEAN, True, False, '', {}),
    ('email_from_name', 'Tên người gửi', G.EMAIL, T.TEXT, 'ProCV', False, '', {}),
    ('email_smtp_configured', 'Mật khẩu SMTP', G.EMAIL, T.ENV, '', False,
     'Cấu hình qua biến môi trường, không lưu trong DB.', {'env_var': 'EMAIL_HOST_PASSWORD'}),
    ('email_notify_new_application', 'Báo NTD khi có ứng tuyển mới', G.EMAIL, T.BOOLEAN, True, False, '', {}),
    ('email_notify_job_approved', 'Báo NTD khi tin được duyệt', G.EMAIL, T.BOOLEAN, True, False, '', {}),
    ('email_welcome_enabled', 'Email chào mừng khi đăng ký', G.EMAIL, T.BOOLEAN, True, False, '', {}),
    ('email_footer_text', 'Chân email', G.EMAIL, T.TEXTAREA,
     'ProCV - Nền tảng việc làm & AI Career Coach', False, '', {}),

    # ---- 9. Thanh toán / gói dịch vụ (khung, chưa có nghiệp vụ) ----
    ('payment_enabled', 'Bật thanh toán/gói dịch vụ', G.PAYMENT, T.BOOLEAN, False, True, '', {}),
    ('payment_currency', 'Tiền tệ', G.PAYMENT, T.SELECT, 'VND', True, '',
     {'choices': [{'value': 'VND', 'label': 'VND'}, {'value': 'USD', 'label': 'USD'}]}),
    ('payment_vnpay_enabled', 'Bật VNPay', G.PAYMENT, T.BOOLEAN, False, False, '', {}),
    ('payment_vnpay_configured', 'Khoá VNPay', G.PAYMENT, T.ENV, '', False,
     'Cấu hình qua biến môi trường.', {'env_var': 'VNPAY_HASH_SECRET'}),
    ('payment_momo_enabled', 'Bật MoMo', G.PAYMENT, T.BOOLEAN, False, False, '', {}),
    ('payment_bank_transfer_info', 'Thông tin chuyển khoản', G.PAYMENT, T.TEXTAREA, '', True, '', {}),
    ('payment_trial_days', 'Số ngày dùng thử', G.PAYMENT, T.NUMBER, 7, False, '', {}),

    # ---- 10. Bảo mật ----
    ('security_min_password_length', 'Độ dài mật khẩu tối thiểu', G.SECURITY, T.NUMBER, 8, True, '', {}),
    ('security_require_strong_password', 'Bắt buộc mật khẩu mạnh', G.SECURITY, T.BOOLEAN, False, True,
     'Yêu cầu chữ hoa, chữ thường, số.', {}),
    ('security_max_login_attempts', 'Số lần đăng nhập sai tối đa', G.SECURITY, T.NUMBER, 5, False, '', {}),
    ('security_lockout_minutes', 'Số phút khoá tạm', G.SECURITY, T.NUMBER, 15, False, '', {}),
    ('security_session_timeout_minutes', 'Số phút hết hạn phiên', G.SECURITY, T.NUMBER, 60, False, '', {}),
    ('security_recaptcha_enabled', 'Bật reCAPTCHA', G.SECURITY, T.BOOLEAN, False, True, '', {}),
    ('security_recaptcha_site_key', 'reCAPTCHA site key', G.SECURITY, T.TEXT, '', True, '', {}),

    # ---- 11. Upload file / media ----
    ('upload_max_image_size_mb', 'Ảnh tối đa (MB)', G.UPLOAD, T.NUMBER, 5, True, '', {}),
    ('upload_avatar_max_size_mb', 'Avatar tối đa (MB)', G.UPLOAD, T.NUMBER, 2, True, '', {}),
    ('upload_max_cv_size_mb', 'File CV tối đa (MB)', G.UPLOAD, T.NUMBER, 10, True, '', {}),
    ('upload_allowed_image_types', 'Định dạng ảnh cho phép', G.UPLOAD, T.JSON,
     ['jpg', 'png', 'webp', 'gif'], True, 'Danh sách đuôi file, dạng JSON array.', {}),
    ('upload_allowed_cv_types', 'Định dạng CV cho phép', G.UPLOAD, T.JSON,
     ['pdf', 'doc', 'docx'], True, '', {}),

    # ---- 12. Footer ----
    ('footer_description', 'Mô tả ngắn ở footer', G.FOOTER, T.TEXTAREA,
     'ProCV - Nền tảng việc làm và phát triển sự nghiệp cùng AI dành cho người Việt.', True, '', {}),
    ('footer_copyright', 'Dòng bản quyền', G.FOOTER, T.TEXT,
     '© 2026 ProCV. All rights reserved.', True, '', {}),
    ('footer_show_link_groups', 'Hiện cụm link SEO', G.FOOTER, T.BOOLEAN, True, True, '', {}),
    ('footer_facebook_url', 'Facebook', G.FOOTER, T.URL, '', True, '', {}),
    ('footer_linkedin_url', 'LinkedIn', G.FOOTER, T.URL, '', True, '', {}),
    ('footer_youtube_url', 'YouTube', G.FOOTER, T.URL, '', True, '', {}),
    ('footer_tiktok_url', 'TikTok', G.FOOTER, T.URL, '', True, '', {}),

    # ---- 13. Liên hệ / hỗ trợ ----
    ('hotline', 'Hotline hỗ trợ', G.CONTACT, T.TEXT, '1900 1234', True, '', {}),
    ('support_email', 'Email hỗ trợ', G.CONTACT, T.EMAIL, 'support@aicareercoach.vn', True, '', {}),
    ('contact_address', 'Địa chỉ', G.CONTACT, T.TEXTAREA, '', True, '', {}),
    ('contact_working_hours', 'Giờ làm việc', G.CONTACT, T.TEXT, '8:00 - 17:30, Thứ 2 - Thứ 6', True, '', {}),
    ('contact_zalo_url', 'Zalo', G.CONTACT, T.URL, '', True, '', {}),
    ('contact_messenger_url', 'Facebook Messenger', G.CONTACT, T.URL, '', True, '', {}),
    ('contact_map_embed_url', 'Google Maps embed', G.CONTACT, T.URL, '', True, '', {}),

    # ---- 14. Phân quyền admin (khung, chưa có nghiệp vụ) ----
    ('admin_roles_enabled', 'Bật phân quyền chi tiết', G.ADMIN_ROLES, T.BOOLEAN, False, False, '', {}),
    ('admin_allow_staff_creation', 'Cho phép tạo tài khoản quản trị phụ', G.ADMIN_ROLES, T.BOOLEAN, False, False, '', {}),
    ('admin_default_role', 'Vai trò mặc định', G.ADMIN_ROLES, T.SELECT, 'moderator', False, '',
     {'choices': [{'value': 'superadmin', 'label': 'Super admin'}, {'value': 'moderator', 'label': 'Moderator'},
                  {'value': 'content', 'label': 'Content'}]}),
    ('admin_action_log_enabled', 'Ghi log thao tác admin', G.ADMIN_ROLES, T.BOOLEAN, False, False, '', {}),

    # ---- 15. Cài đặt AI ----
    ('ai_enabled', 'Bật tính năng AI', G.AI, T.BOOLEAN, True, True, '', {}),
    ('ai_provider', 'Nhà cung cấp', G.AI, T.SELECT, 'gemini', False, '',
     {'choices': [{'value': 'gemini', 'label': 'Google Gemini'}, {'value': 'openai', 'label': 'OpenAI'},
                  {'value': 'anthropic', 'label': 'Anthropic Claude'}]}),
    ('ai_model', 'Model', G.AI, T.TEXT, 'gemini-2.0-flash', False, '', {}),
    ('ai_api_key_configured', 'API key', G.AI, T.ENV, '', False,
     'Cấu hình qua biến môi trường, không lưu trong DB.', {'env_var': 'GEMINI_API_KEY'}),
    ('ai_cv_review_enabled', 'AI chấm/review CV', G.AI, T.BOOLEAN, True, True, '', {}),
    ('ai_job_match_enabled', 'AI gợi ý việc phù hợp', G.AI, T.BOOLEAN, True, True, '', {}),
    ('ai_interview_enabled', 'AI luyện phỏng vấn', G.AI, T.BOOLEAN, False, True, '', {}),
    ('ai_daily_request_limit', 'Giới hạn request AI/ngày/người', G.AI, T.NUMBER, 50, False, '', {}),
]

# (key, title, source, order, [items]) — items chỉ dùng cho source=manual.
# url rỗng => frontend hiển thị "Sắp ra mắt" (tính năng chưa có).
LINK_GROUPS = [
    ('footer-locations', 'Việc làm theo khu vực', LinkGroup.Source.LOCATIONS, 1, []),
    ('footer-categories', 'Việc làm theo ngành nghề', LinkGroup.Source.CATEGORIES, 2, []),
    ('footer-cv', 'Mẫu CV & Cẩm nang', LinkGroup.Source.MANUAL, 3, [
        'Mẫu CV', 'Mẫu CV tiếng Anh', 'Mẫu CV IT', 'Mẫu CV Kế toán',
        'Mẫu CV Marketing', 'CV là gì?', 'Cách viết CV xin việc', 'Mẫu Cover Letter',
    ]),
    ('footer-tools', 'Công cụ & Tra cứu', LinkGroup.Source.MANUAL, 4, [
        'Tính lương Gross - Net', 'Tính thuế thu nhập cá nhân', 'Trắc nghiệm tính cách MBTI',
        'Tra cứu mức lương', 'Cẩm nang ngành CNTT', 'Cẩm nang ngành Logistics', 'Cẩm nang ngành Du lịch',
    ]),
]

# (title, eyebrow, subtitle, theme, cta_label, cta_url, order)
BANNERS = [
    (
        'Lập trình viên & Kỹ sư AI', 'TUYỂN DỤNG GẤP',
        'Mức lương hấp dẫn, môi trường năng động, cơ hội thăng tiến nhanh.',
        Banner.Theme.BLUE, 'Xem việc làm IT', '/viec-lam?search=IT', 1,
    ),
    (
        'Tạo CV chuyên nghiệp cùng AI', 'MIỄN PHÍ',
        'Chỉ mất 5 phút để có CV ấn tượng, sẵn sàng ứng tuyển.',
        Banner.Theme.ORANGE, '', '', 2,
    ),
]


class Command(BaseCommand):
    help = 'Tạo dữ liệu cấu hình & cụm link mặc định (idempotent, không ghi đè value đã chỉnh).'

    def handle(self, *args, **options):
        order_in_group = {}
        for key, label, group, value_type, value, is_public, description, opts in SETTINGS:
            order = order_in_group[group] = order_in_group.get(group, 0) + 1
            metadata = {
                'label': label, 'group': group, 'value_type': value_type,
                'options': opts, 'order': order, 'description': description, 'is_public': is_public,
            }
            setting, created = SiteSetting.objects.get_or_create(key=key, defaults={**metadata, 'value': value})
            if not created:
                changed = False
                for field, next_value in metadata.items():
                    if getattr(setting, field) != next_value:
                        setattr(setting, field, next_value)
                        changed = True
                if key in BRAND_ASSET_KEYS and setting.value in LEGACY_BRAND_VALUES:
                    setting.value = value
                    changed = True
                if changed:
                    setting.save()
            self.stdout.write(f'{"+ " if created else "= "}setting {key}')

        for key, title, source, order, items in LINK_GROUPS:
            grp, created = LinkGroup.objects.get_or_create(
                key=key, defaults={'title': title, 'source': source, 'order': order}
            )
            self.stdout.write(f'{"+ " if created else "= "}group {key}')
            if created and source == LinkGroup.Source.MANUAL:
                LinkItem.objects.bulk_create(
                    [LinkItem(group=grp, label=label, url='', order=i) for i, label in enumerate(items)]
                )

        for title, eyebrow, subtitle, theme, cta_label, cta_url, order in BANNERS:
            _, created = Banner.objects.get_or_create(
                title=title,
                defaults={'eyebrow': eyebrow, 'subtitle': subtitle, 'theme': theme, 'cta_label': cta_label, 'cta_url': cta_url, 'order': order},
            )
            self.stdout.write(f'{"+ " if created else "= "}banner {title}')

        self.stdout.write(self.style.SUCCESS('Seed sitecontent xong.'))
