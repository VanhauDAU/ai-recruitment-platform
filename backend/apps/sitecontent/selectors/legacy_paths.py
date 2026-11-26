"""Path frontend tiếng Anh cũ → path tiếng Việt hiện hành.

Revision thông báo đã xuất bản giữ nguyên prefix admin nhập lúc đó, nên khi so
khớp route phải dịch prefix cũ sang path mới. Bảng cùng nội dung với
`frontend/src/app/router/redirects/legacy-paths.js` (phần không có tham số động).
"""

_MAIN = {
    '/login': '/dang-nhap',
    '/sign-up': '/dang-ky',
    '/register': '/dang-ky',
    '/forgot-password': '/quen-mat-khau',
    '/reset-password': '/dat-lai-mat-khau',
    '/onboard-user': '/hoan-thien-ho-so',
    '/onboard-user-setting': '/hoan-thien-ho-so',
    '/cv/share': '/cv/chia-se',
}

_EMPLOYER = {
    '/login': '/dang-nhap',
    '/register': '/dang-ky',
    '/forgot-password': '/quen-mat-khau',
    '/reset-password': '/dat-lai-mat-khau',
    '/account/verify': '/xac-thuc-email',
    '/account/complete-profile': '/hoan-thien-ho-so',
    '/onboarding': '/hoan-thien-ho-so',
    '/consulting-need': '/khai-bao-nhu-cau',
    '/employer-verify': '/xac-thuc-tai-khoan',
    '/account/phone-verify': '/xac-thuc-so-dien-thoai',
    '/account/settings': '/cai-dat',
    '/account/settings/account-info': '/cai-dat/thong-tin-tai-khoan',
    '/account/settings/password-login': '/cai-dat/mat-khau',
    '/account/settings/company': '/cai-dat/cong-ty',
    '/account/settings/gpkd': '/cai-dat/giay-phep-kinh-doanh',
    '/account/settings/personal-data-protection': '/cai-dat/bao-ve-du-lieu-ca-nhan',
    '/account/settings/recruitment-demand': '/cai-dat/nhu-cau-tuyen-dung',
    '/account/settings/general-setting': '/cai-dat/chung',
    '/account/settings/integrations': '/cai-dat/tich-hop',
    '/dashboard': '/tong-quan',
    '/notifications': '/thong-bao',
    '/activities': '/lich-su-hoat-dong',
    '/company-page': '/trang-cong-ty',
    '/campaigns': '/chien-dich',
    '/campaigns/new': '/chien-dich/tao-moi',
    '/jobs': '/tin-tuyen-dung',
    '/jobs/new': '/tin-tuyen-dung/tao-moi',
    '/applications': '/ho-so-ung-tuyen',
    '/candidate-search': '/tim-ung-vien',
    '/talent-pool': '/kho-ung-vien',
    '/candidate-blocks': '/ung-vien-bi-chan',
    '/connect': '/procv-connect',
}

_ADMIN = {
    '/login': '/dang-nhap',
    '/invitation': '/loi-moi',
    '/reset-password': '/dat-lai-mat-khau',
    '/dashboard': '/tong-quan',
    '/companies': '/cong-ty',
    '/recruiters': '/nha-tuyen-dung',
    '/accounts': '/tai-khoan',
    '/account': '/tai-khoan-cua-toi',
    '/job-moderation': '/duyet-tin',
    '/company-reports': '/bao-cao-cong-ty',
    '/privacy-requests': '/yeu-cau-du-lieu-ca-nhan',
    '/cv/overview': '/cv/tong-quan',
    '/cv/templates': '/cv/mau-cv',
    '/cv/positions': '/cv/vi-tri',
    '/cv/library': '/cv/thu-vien',
    '/cv/user-cvs': '/cv/cv-nguoi-dung',
    '/blog/new': '/blog/tao-moi',
    '/knowledgebase': '/tro-giup',
    '/knowledgebase/new': '/tro-giup/tao-moi',
    '/announcements': '/thong-bao',
    '/catalog': '/danh-muc-du-lieu',
    '/banners': '/banner',
    '/settings': '/cau-hinh',
    '/access-denied': '/khong-co-quyen',
}

# Base path từng cổng: chạy chung domain (/tuyendung/app, /admin/app) hoặc subdomain (/app).
_PORTALS = (
    ('/tuyendung/app', _EMPLOYER),
    ('/admin/app', _ADMIN),
    ('/app', {**_ADMIN, **_EMPLOYER}),
    ('', _MAIN),
)


def _replace_prefix(path, mapping):
    """Thay đoạn đầu dài nhất của `path` khớp trọn segment với một khóa của `mapping`."""
    for old in sorted(mapping, key=len, reverse=True):
        if path == old or path.startswith(f'{old}/'):
            return mapping[old] + path[len(old) :]
    return None


def modernize_path_prefix(prefix):
    """Dịch prefix route cũ sang route hiện hành; prefix không thuộc bảng giữ nguyên."""
    for base, mapping in _PORTALS:
        if base and not prefix.startswith(f'{base}/'):
            continue
        replaced = _replace_prefix(prefix[len(base) :], mapping)
        if replaced is not None:
            return base + replaced
        if base:
            return prefix
    return prefix
