"""Reverse proxy, Django REST Framework, SimpleJWT và drf-spectacular."""

from datetime import timedelta

from decouple import Csv

from config.env import config

from .core import DEBUG, SECRET_KEY

# Reverse proxy: khai báo ai được quyền nói thay client. Đặt trước
# REST_FRAMEWORK vì throttle lấy danh tính client từ đây.
TRUSTED_PROXY_IPS = config('TRUSTED_PROXY_IPS', default='', cast=Csv())
# Số hop reverse proxy của mình đứng trước Django. Chỉ ngần này phần tử ngoài
# cùng bên phải của X-Forwarded-For là do proxy ghi; phần còn lại client tự khai.
TRUSTED_PROXY_HOPS = config('TRUSTED_PROXY_HOPS', default=1, cast=int)

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.api.authentication.AccountJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_PAGINATION_CLASS': 'common.api.pagination.StandardPagination',
    'EXCEPTION_HANDLER': 'common.api.exceptions.api_exception_handler',
    # Browsable API chỉ cho dev: production trả JSON, không lộ form HTML của DRF.
    'DEFAULT_RENDERER_CLASSES': ('rest_framework.renderers.JSONRenderer',)
    + (('rest_framework.renderers.BrowsableAPIRenderer',) if DEBUG else ()),
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Phòng thủ lớp hai cho các throttle chưa dùng ClientIPScopedRateThrottle:
    # mặc định của DRF (None) lấy nguyên chuỗi X-Forwarded-For làm khoá, tức là
    # để client tự chọn bucket cho mình.
    'NUM_PROXIES': TRUSTED_PROXY_HOPS,
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/min',
        'register': '5/min',
        'register_email_check': '12/min',
        'verify_email': '5/min',
        # Bucket riêng cho các bước ĐỔI token lấy kết quả: gõ/mở link hỏng vài
        # lần không được phép khoá luôn khả năng xin gửi lại mail, và ngược lại.
        'verify_email_confirm': '20/min',
        'change_email': '5/min',
        'password_reset': '5/min',
        'password_reset_validate': '20/min',
        # Bucket riêng cho bước confirm: gõ sai mật khẩu mới vài lần không được
        # phép khoá luôn việc xin link (và ngược lại) — chung IP, chung quota.
        'password_reset_confirm': '10/min',
        'oauth': '10/min',
        'feedback': '5/min',
        'consultation': '5/min',
        'consent': '20/hour',
        # Mỗi lần (re)connect WebSocket một vé; backoff phía client giữ dưới mức này.
        'realtime_ticket': '30/min',
        # Việc làm gần bạn: mỗi lần đổi bán kính/bộ lọc gọi danh sách + bản đồ.
        'nearby_jobs': '120/min',
        'geo_lookup': '60/min',
        'job_view': '120/hour',
        'job_impression': '240/hour',
        'job_report': '10/hour',
        'announcement_event': '240/hour',
        'announcement_runtime': '60/hour',
        'cv_import': '10/hour',
        'ai_job_generation': '3/min',
        'match_analysis': '20/hour',
        # Tìm CV: mỗi lượt tìm chấm lại tới 200 CV; lời mời gửi thông báo cho ứng viên.
        'candidate_search': '240/hour',
        'candidate_search_invite': '40/hour',
        'knowledgebase_public': '120/min',
        'public_companies': '120/min',
        # Invited reviewers: open the CV and save a scorecard a few times.
        'application_review': '60/hour',
        'company_follow': '60/hour',
        'company_report': '10/hour',
        'company_page_layout': '60/hour',
        'company_page_content': '30/hour',
        'company_page_editors': '20/hour',
        'upload_session': '30/hour',
        'upload_status': '120/min',
        'upload_content': '20/hour',
        'employer_phone_send': '5/min',
        'employer_phone_verify': '10/min',
        'employer_phone_status': '120/min',
        # Account limits protect one recruiter; IP limits are deliberately
        # broader because offices and local Docker users commonly share an IP.
        'employer_domain_claim_issue_account': '10/day',
        'employer_domain_claim_issue_ip': '60/hour',
        'employer_domain_claim_verify_account': '30/hour',
        'employer_domain_claim_verify_ip': '120/hour',
        'employer_domain_claim_manual_account': '3/day',
        'employer_domain_claim_manual_ip': '30/hour',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=config('JWT_ACCESS_TOKEN_MINUTES', default=15, cast=int)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    # `or` để dòng .env bỏ trống (JWT_SIGNING_KEY=) vẫn rơi về SECRET_KEY: chuỗi
    # rỗng làm PyJWT ném InvalidKeyError ở mọi lần phát token. Production vẫn bị
    # ép phải khai báo key riêng ở khối kiểm tra IS_PRODUCTION bên dưới.
    'SIGNING_KEY': config('JWT_SIGNING_KEY', default='') or SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# drf-spectacular (OpenAPI 3 schema + Swagger UI / ReDoc)
SPECTACULAR_SETTINGS = {
    'TITLE': 'ProCV API',
    'DESCRIPTION': (
        'API cho nền tảng ProCV — CV Builder, phân tích CV, '
        'so khớp CV–Job và tuyển dụng. Dùng JWT: đăng nhập lấy access token '
        'rồi bấm "Authorize" và nhập "Bearer <access_token>".'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
        'displayRequestDuration': True,
    },
    # Đặt tên enum tường minh để tránh trùng tên tự sinh (status/level dùng ở nhiều bảng)
    'ENUM_NAME_OVERRIDES': {
        # Va chạm tên enum giữa các app (ADR-0022 GĐ3): đặt tên theo nghĩa thay cho hash.
        'CompanyDocumentStatusEnum': 'apps.employers.models.CompanyDocument.Status',
        'CompanyUpdateRequestStatusEnum': 'apps.employers.models.CompanyUpdateRequest.Status',
        'EmployerVerificationCaseStatusEnum': 'apps.employers.models.EmployerVerificationCase.Status',
        'EmployerVerificationMethodEnum': 'apps.employers.models.EmployerVerificationCase.VerificationMethod',
        'CompanyJoinRequestStatusEnum': 'apps.employers.models.CompanyJoinRequest.Status',
        'CompanyDomainClaimStatusEnum': 'apps.employers.models.CompanyDomainClaim.Status',
        'CompanyReportReasonEnum': 'apps.employers.models.CompanyReport.Reason',
        'EmployerNotificationEventTypeEnum': 'apps.employers.models.EmployerNotification.EventType',
        'RecruitmentNeedPositionLevelEnum': 'apps.employers.models.choices.PositionLevel',
        'UserCvSourceEnum': 'apps.cvs.models.UserCv.Source',
        'CvCategoryTypeEnum': 'apps.cv_templates.models.CvCategory.CategoryType',
        'ExperienceBandEnum': 'apps.cv_templates.models.ExperienceBand',
        'ReportResolutionEnum': [('upheld', 'upheld'), ('dismissed', 'dismissed')],
        'VerificationReviewDecisionEnum': [
            ('approved', 'approved'),
            ('changes_requested', 'changes_requested'),
            ('rejected', 'rejected'),
        ],
        'VerificationLifecycleActionEnum': [('revoked', 'revoked'), ('expired', 'expired')],
        'TaxNameComparisonEnum': [
            ('match', 'match'),
            ('mismatch', 'mismatch'),
            ('pending', 'pending'),
            ('unavailable', 'unavailable'),
            ('stale_input', 'stale_input'),
        ],
        'CapabilityBlockedEnum': [('blocked', 'blocked')],
        'CapabilityRecomputeEnum': [
            ('eligible_after_recompute', 'eligible_after_recompute'),
            ('blocked', 'blocked'),
        ],
        'CapabilityUnchangedEnum': [('unchanged', 'unchanged')],
        'LocaleEnum': 'apps.jobs.models.JobCategoryLocalization.Locale',
        'JobStatusEnum': 'apps.jobs.models.Job.Status',
        'ApplicationStatusEnum': 'apps.applications.models.Application.Status',
        'ApplicationSourceEnum': 'apps.applications.models.Application.Source',
        'CandidateBlockReasonEnum': 'apps.applications.models.CandidateBlock.Reason',
        'JobPositionLevelEnum': 'apps.jobs.models.Job.PositionLevel',
        # work_type và work_types (danh sách) dùng chung một tập lựa chọn.
        'JobWorkTypeEnum': 'apps.jobs.models.Job.WorkType',
        'JobCategoryTypeEnum': 'apps.jobs.models.JobCategory.CategoryType',
        'JobCategoryStatusEnum': 'apps.jobs.models.JobCategory.Status',
        'BenefitCategoryEnum': 'apps.jobs.models.Benefit.Category',
        'JobAiGenerationModeEnum': 'apps.jobs.models.JobAiGeneration.Mode',
        'JobAiGenerationStatusEnum': 'apps.jobs.models.JobAiGeneration.Status',
        'JobAiFeedbackReasonEnum': 'apps.jobs.models.JobAiGeneration.FeedbackReason',
        'JobReportReasonEnum': 'apps.jobs.models.JobReport.Reason',
        # Báo cáo tin và báo cáo công ty cùng tập pending/upheld/dismissed.
        'ReportStatusEnum': 'apps.jobs.models.JobReport.Status',
        'CampaignStatusEnum': 'apps.campaigns.models.RecruitmentCampaign.Status',
        'CampaignChannelKindEnum': 'apps.campaigns.models.CampaignChannel.Kind',
        # CvSkill.Level và JobSkill.MinLevel cùng tập beginner/intermediate/advanced -> 1 enum chung
        'SkillLevelEnum': 'apps.jobs.models.JobSkill.MinLevel',
        'LocationLevelEnum': 'apps.locations.models.Location.Level',
        'AnnouncementLifecycleStateEnum': ('apps.sitecontent.models.Announcement.LifecycleState'),
        'AnnouncementKindEnum': 'apps.sitecontent.models.AnnouncementRevision.Kind',
        'BannerKindEnum': 'apps.sitecontent.models.Banner.Kind',
        'BannerPlacementEnum': 'apps.sitecontent.models.Banner.Placement',
        'BannerThemeEnum': 'apps.sitecontent.models.Banner.Theme',
        'AnnouncementSurfaceEnum': 'apps.sitecontent.models.AnnouncementRevision.Surface',
        'AnnouncementAudienceEnum': 'apps.sitecontent.models.AnnouncementRevision.Audience',
        'AnnouncementIconEnum': 'apps.sitecontent.models.AnnouncementRevision.Icon',
        'AnnouncementAnimationEnum': 'apps.sitecontent.models.AnnouncementRevision.Animation',
        'AnnouncementDismissModeEnum': ('apps.sitecontent.models.AnnouncementRevision.DismissMode'),
        'AnnouncementRuntimeEventEnum': (
            'apps.sitecontent.api.serializers.announcements_reader.ANNOUNCEMENT_RUNTIME_EVENTS'
        ),
        'AnnouncementRuntimeReasonEnum': (
            'apps.sitecontent.api.serializers.announcements_reader.ANNOUNCEMENT_RUNTIME_REASONS'
        ),
        'UserRoleEnum': 'apps.accounts.models.User.Role',
        'SelfServiceRoleEnum': 'apps.accounts.api.serializers.auth.SELF_SERVICE_ROLES',
        # Tên cổng đăng nhập (key của dict) — main | employer | admin.
        'AuthPortalEnum': 'apps.accounts.services.refresh_cookies.PORTAL_ROLE_BY_NAME',
        'AccountStatusEnum': 'apps.accounts.models.User.Status',
        'ManagedAccountStatusEnum': (
            'apps.accounts.api.serializers.account_actions.MANAGED_ACCOUNT_STATUSES'
        ),
        'BlogPostStatusEnum': 'apps.blog.models.Post.Status',
        'KnowledgeArticleTypeEnum': 'apps.knowledgebase.models.KnowledgeArticle.ArticleType',
        'KnowledgeArticleLifecycleStateEnum': (
            'apps.knowledgebase.models.KnowledgeArticle.LifecycleState'
        ),
        'AnnouncementThemeModeEnum': 'apps.sitecontent.models.AnnouncementRevision.ThemeMode',
        'AnnouncementBackgroundFitEnum': (
            'apps.sitecontent.models.AnnouncementRevision.BackgroundFit'
        ),
        'AnnouncementBackgroundPositionEnum': (
            'apps.sitecontent.models.AnnouncementRevision.BackgroundPosition'
        ),
        'AnnouncementBackgroundOverlayEnum': (
            'apps.sitecontent.models.AnnouncementRevision.BackgroundOverlay'
        ),
    },
    'TAGS': [
        {'name': 'auth', 'description': 'Đăng ký, đăng nhập, JWT, tài khoản hiện tại'},
        {'name': 'candidate', 'description': 'Hồ sơ ứng viên'},
        {'name': 'employer', 'description': 'Hồ sơ công ty / nhà tuyển dụng'},
        {'name': 'cvs', 'description': 'CV Builder + upload CV'},
        {'name': 'cv-templates', 'description': 'Mẫu CV'},
        {'name': 'jobs', 'description': 'Tin tuyển dụng, danh mục ngành nghề, thống kê'},
        {'name': 'applications', 'description': 'Ứng tuyển & quản lý hồ sơ ứng tuyển'},
        {'name': 'locations', 'description': 'Tra cứu địa điểm (tỉnh/xã)'},
    ],
}
