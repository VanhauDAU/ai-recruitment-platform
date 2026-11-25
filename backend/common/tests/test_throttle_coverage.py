"""Quét mọi route ghi: không view nào được lọt trần ghi theo tài khoản (ADR-0031).

DRF THAY THẾ ``DEFAULT_THROTTLE_CLASSES`` khi view tự khai ``throttle_classes``
hoặc ``get_throttles``; quên ``with_account_write_cap`` là mất trần mà không
test hành vi nào phát hiện. Ở đây dựng từng view như lúc nhận request rồi đọc
danh sách throttle thật cho từng method ghi.
"""

from django.conf import settings
from django.test import RequestFactory, SimpleTestCase
from django.urls import get_resolver
from rest_framework.request import Request
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.api.throttling import (
    AccountWriteBurstThrottle,
    AccountWriteRateThrottle,
    AccountWriteSustainedThrottle,
    SuffixedScopedRateThrottleMixin,
    WriteScopedRateThrottle,
)

UNSAFE_METHODS = ('post', 'put', 'patch', 'delete')

# Miễn trần: tín hiệu nền trình duyệt tự gửi, không phải thao tác người dùng.
# Mỗi view vẫn giữ scope riêng; tính vào trần sẽ làm lượt ghi thật bị 429 oan.
ACCOUNT_WRITE_CAP_EXEMPT = {
    'JobViewCreateView': 'Lượt xem tin tự gửi khi mở trang; đã có scope job_view.',
    'JobImpressionBatchCreateView': (
        'Lượt hiển thị gửi theo lô khi cuộn danh sách; đã có scope job_impression.'
    ),
    'AnnouncementEventBatchView': (
        'Sự kiện thông báo gửi nền, fail-open khi cache lỗi; đã có scope announcement_event.'
    ),
    'AnnouncementRuntimeEventView': (
        'Báo lỗi runtime thông báo gửi nền; đã có scope announcement_runtime.'
    ),
    'RealtimeTicketView': (
        'Vé WebSocket xin lại mỗi lần reconnect; chặn bởi trần ghi sẽ cắt realtime. '
        'Đã có scope realtime_ticket.'
    ),
}

# view -> (scope, các method ghi được tính). Nhóm rủi ro cao: tạo dữ liệu công
# khai, gửi thông báo/email cho người khác, gọi AI hoặc dựng file tốn tài nguyên.
HIGH_RISK_WRITE_SCOPES = {
    'SkillListView': ('skill_create', {'POST'}),
    'CreateCompanyView': ('company_create', {'POST'}),
    'CompanyLogoUploadView': ('company_media_upload', {'POST'}),
    'CompanyCoverUploadView': ('company_media_upload', {'POST'}),
    'CompanyGalleryUploadView': ('company_media_upload', {'POST'}),
    'CompanyUpdateRequestListCreateView': ('company_update_request', {'POST'}),
    'JoinCompanyView': ('company_join', {'POST'}),
    'CompanyDocumentListCreateView': ('company_document_upload', {'POST'}),
    'EmployerJobSubmitView': ('job_submit', {'POST'}),
    'EmployerJobResubmitView': ('job_submit', {'POST'}),
    'CandidateApplicationListCreateView': ('application_create', {'POST'}),
    'CandidateApplicationRemindView': ('application_remind', {'POST'}),
    'RecruiterReviewLinkListCreateView': ('review_link_create', {'POST'}),
    'RecruiterTalentPoolInviteView': ('talent_pool_invite', {'POST'}),
    'RecruiterApplicationCvExportView': ('application_cv_export', {'POST'}),
    'CampaignLaunchView': ('campaign_launch', {'POST'}),
    'ChannelPostListView': ('campaign_social_post', {'POST'}),
    'CampaignChannelContentView': ('campaign_ai_content', {'POST'}),
    'CvSharedLinkListCreateView': ('cv_share_link', {'POST'}),
    'CvPublishView': ('cv_publish', {'POST'}),
    'CvExportListCreateView': ('cv_export', {'POST'}),
    'CvExportRetryView': ('cv_export', {'POST'}),
    'CvAssetUploadView': ('cv_asset_upload', {'POST'}),
    'AvatarUploadView': ('avatar_upload', {'POST'}),
    'OwnDataRequestListCreateView': ('privacy_data_request', {'POST'}),
}


def _routes(patterns=None, prefix='/'):
    """(view_class, callback, path) của mọi route DRF, kể cả include lồng nhau."""
    for pattern in get_resolver().url_patterns if patterns is None else patterns:
        path = f'{prefix}{pattern.pattern}'
        if hasattr(pattern, 'url_patterns'):
            yield from _routes(pattern.url_patterns, path)
            continue
        view_class = getattr(pattern.callback, 'cls', None)
        if isinstance(view_class, type) and issubclass(view_class, APIView):
            yield view_class, pattern.callback, path


def _methods(view_class, callback):
    actions = getattr(callback, 'actions', None)
    if actions:
        return [method.upper() for method in actions]
    return [
        method.upper()
        for method in ('get', *UNSAFE_METHODS)
        if callable(getattr(view_class, method, None))
    ]


def _bound_view(view_class, callback, method):
    """Dựng view như ``as_view`` làm để ``get_throttles`` đọc đúng method/action."""
    view = view_class(**(getattr(callback, 'initkwargs', None) or {}))
    actions = getattr(callback, 'actions', None)
    if actions:
        view.action_map = actions
        view.action = actions.get(method.lower())
    view.request = Request(RequestFactory().generic(method, '/'))
    view.args, view.kwargs, view.format_kwarg = (), {}, None
    return view


def _write_routes():
    for view_class, callback, path in _routes():
        for method in _methods(view_class, callback):
            if method.lower() in UNSAFE_METHODS:
                view = _bound_view(view_class, callback, method)
                yield view_class.__name__, method, path, view, view.get_throttles()


def _has_cap(throttles):
    return any(isinstance(t, AccountWriteBurstThrottle) for t in throttles) and any(
        isinstance(t, AccountWriteSustainedThrottle) for t in throttles
    )


def _anonymous_only(view):
    # Không xác thực thì request.user luôn là khách: trần theo tài khoản vô nghĩa,
    # view đó đã tự giới hạn theo IP.
    return not view.get_authenticators()


class AccountWriteCapCoverageTests(SimpleTestCase):
    maxDiff = None

    def test_the_canary_actually_discovers_write_routes(self):
        """Nếu cách dò hỏng, các test dưới sẽ xanh giả. Neo lại bằng view đã biết."""
        discovered = {name for name, *_ in _write_routes()}

        self.assertLessEqual(
            {
                'SkillListView',
                'CreateCompanyView',
                'LoginView',
                'CompanyPageLayoutView',
                'AdminAccountViewSet',
            },
            discovered,
        )

    def test_every_write_route_has_the_account_write_cap(self):
        uncapped = sorted(
            {
                f'{name} {method} -> {path}'
                for name, method, path, view, throttles in _write_routes()
                if name not in ACCOUNT_WRITE_CAP_EXEMPT
                and not _anonymous_only(view)
                and not _has_cap(throttles)
            }
        )

        self.assertEqual(
            uncapped,
            [],
            'View tự khai throttle phải bọc with_account_write_cap(...) hoặc '
            'with_default_throttles(...), hoặc vào ACCOUNT_WRITE_CAP_EXEMPT kèm lý do.',
        )

    def test_exemptions_are_real_and_explained(self):
        routes = list(_write_routes())
        uncapped = {name for name, _, _, _, throttles in routes if not _has_cap(throttles)}
        stale = sorted(set(ACCOUNT_WRITE_CAP_EXEMPT) - uncapped)

        self.assertEqual(stale, [], 'Tên thừa trong ACCOUNT_WRITE_CAP_EXEMPT.')
        for name, reason in ACCOUNT_WRITE_CAP_EXEMPT.items():
            self.assertTrue(reason.strip(), name)

    def test_high_risk_writes_use_their_dedicated_scope(self):
        counted = {}
        for name, method, _path, view, throttles in _write_routes():
            if name not in HIGH_RISK_WRITE_SCOPES:
                continue
            counted.setdefault(name, (set(), set()))
            if any(isinstance(t, WriteScopedRateThrottle) for t in throttles):
                methods = getattr(view, 'throttle_scope_methods', None)
                if methods is None or method in methods:
                    counted[name][0].add(method)
            counted[name][1].add(getattr(view, 'throttle_scope', None))

        self.assertEqual(sorted(set(HIGH_RISK_WRITE_SCOPES) - set(counted)), [], 'Tên thừa.')
        for name, (scope, methods) in HIGH_RISK_WRITE_SCOPES.items():
            with self.subTest(view=name):
                self.assertEqual(counted[name], (methods, {scope}))

    def test_every_scope_in_use_has_a_configured_rate(self):
        rates = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
        missing = set()
        for view_class, callback, path in _routes():
            for method in _methods(view_class, callback):
                view = _bound_view(view_class, callback, method)
                for throttle in view.get_throttles():
                    for scope in _scopes(view, throttle):
                        if scope not in rates:
                            missing.add(f'{scope} ({view_class.__name__} -> {path})')

        self.assertEqual(sorted(missing), [])


def _scopes(view, throttle):
    if isinstance(throttle, AccountWriteRateThrottle):
        scope = type(throttle).scope
        return [scope, f'{scope}_admin']
    if isinstance(throttle, ScopedRateThrottle):
        scope = getattr(view, 'throttle_scope', None)
        if not scope:
            return []
        if isinstance(throttle, SuffixedScopedRateThrottleMixin):
            return [f'{scope}_{throttle.scope_suffix}']
        return [scope]
    # SimpleRateThrottle khác đã đọc rate ngay khi khởi tạo (thiếu là lỗi luôn).
    return []
