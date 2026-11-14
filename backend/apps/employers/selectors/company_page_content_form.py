"""The content tab of the page workspace: published values, the caller's
pending request, a status per block and the completeness score."""

from apps.locations.models import Location
from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text

from ..models import CompanyUpdateRequest, RecruiterProfile
from ..models.verification import (
    ACTIVE_COMPANY_UPDATE_STATUSES,
    REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
    company_update_allowed_actions,
)
from ..page_content import SOCIAL_NETWORKS

TEXT_FIELDS = ('headline', 'description', 'culture', 'employee_benefits', 'video_url')
MEDIA_MARKERS = ('logo_pending', 'cover_pending', 'gallery_pending')

# Block of the page -> keys of an update request that change it.
SECTION_REQUEST_KEYS = {
    'hero': {
        'headline',
        'logo_url',
        'logo_pending',
        'has_no_logo',
        'cover_image_url',
        'cover_pending',
    },
    'about': {'description'},
    'benefits': {'benefits', 'employee_benefits'},
    'culture': {'culture'},
    'gallery': {'gallery_additions', 'gallery_deletions', 'gallery_pending'},
    'video': {'video_url'},
    'offices': {'offices'},
    'social_links': {'social_links'},
}

COMPLETENESS_ITEMS = (
    ('logo', 'Logo'),
    ('cover', 'Ảnh bìa'),
    ('headline', 'Khẩu hiệu'),
    ('about', 'Giới thiệu công ty'),
    ('benefits', 'Phúc lợi'),
    ('culture', 'Văn hoá công ty'),
    ('gallery', 'Hình ảnh công ty'),
    ('offices', 'Văn phòng'),
    ('social_links', 'Mạng xã hội'),
    ('video', 'Video giới thiệu'),
)


def _social_links_form(links):
    return {network.key: (links or {}).get(network.key, '') for network in SOCIAL_NETWORKS}


def _published(company, request):
    """``company`` must come from ``company_page_queryset()``."""
    return {
        **{field: getattr(company, field) for field in TEXT_FIELDS},
        'social_links': _social_links_form(company.social_links),
        'benefits': [
            {'benefit_id': item.benefit_id, 'note': item.note}
            for item in company.benefit_items.all()
        ],
        'offices': [
            {
                'label': office.label,
                'address_line': office.address_line,
                'province_id': office.province_id,
                'province_name': office.province.name,
                'is_headquarters': office.is_headquarters,
            }
            for office in company.offices.all()
        ],
        'logo_url': media_url_from_value(company.logo_url, request=request),
        'cover_image_url': media_url_from_value(company.cover_image_url, request=request),
        'gallery': [
            {
                'id': image.id,
                'image_url': media_url_from_value(image.image_url, request=request),
                'caption': image.caption,
            }
            for image in company.images.all()
        ],
    }


def _pending_offices(offices):
    names = dict(
        Location.objects.filter(id__in=[office['province_id'] for office in offices]).values_list(
            'id', 'name'
        )
    )
    return [{**office, 'province_name': names.get(office['province_id'], '')} for office in offices]


def _pending(changes, request):
    """Page content keys of the caller's request, in the published shapes."""
    pending = {field: changes[field] for field in (*TEXT_FIELDS, 'benefits') if field in changes}
    pending.update({marker: True for marker in MEDIA_MARKERS if changes.get(marker)})
    if 'social_links' in changes:
        pending['social_links'] = _social_links_form(changes['social_links'])
    if 'offices' in changes:
        pending['offices'] = _pending_offices(changes['offices'])
    if 'logo_url' in changes or changes.get('has_no_logo'):
        pending['logo_url'] = media_url_from_value(changes.get('logo_url', ''), request=request)
    if 'cover_image_url' in changes:
        pending['cover_image_url'] = media_url_from_value(
            changes['cover_image_url'], request=request
        )
    if 'gallery_additions' in changes:
        pending['gallery_additions'] = [
            {'image_url': media_url_from_value(path, request=request)}
            for path in changes['gallery_additions']
        ]
    if 'gallery_deletions' in changes:
        pending['gallery_deletions'] = list(changes['gallery_deletions'])
    return pending


def _request_summary(update_request, recruiter):
    status = update_request.status
    return {
        'public_id': update_request.public_id,
        # ``pending`` is a pre-V2 alias of ``submitted`` kept for old rows.
        'status': (
            CompanyUpdateRequest.Status.SUBMITTED
            if status == CompanyUpdateRequest.Status.PENDING
            else status
        ),
        'submitted_at': update_request.submitted_at,
        'review_note': update_request.review_note,
        'editable': status in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
        # What the update-request lifecycle endpoints expect back.
        'lock_version': update_request.lock_version,
        'allowed_actions': company_update_allowed_actions(
            update_request,
            user_id=recruiter.user_id,
            is_owner=recruiter.company_role == RecruiterProfile.CompanyRole.OWNER,
        ),
    }


def _has_text(value):
    return bool(rich_text_plain_text(value))


def _published_blocks(company, published):
    """Which blocks and completeness items already have published content."""
    return {
        'logo': bool(company.logo_url),
        'cover': bool(company.cover_image_url),
        'headline': bool(company.headline),
        'about': _has_text(company.description),
        'benefits': bool(published['benefits']) or _has_text(company.employee_benefits),
        'culture': _has_text(company.culture),
        'gallery': bool(published['gallery']),
        'offices': bool(published['offices']),
        'social_links': bool(company.social_links),
        'video': bool(company.video_url),
    }


def _section_status(pending_keys, *, published, waiting):
    if pending_keys:
        return waiting
    return 'published' if published else 'empty'


def company_page_content_form(company, *, recruiter, request=None):
    """Content tab payload: ``(content_form, completeness)``."""
    update_request = CompanyUpdateRequest.objects.filter(
        company_id=company.pk,
        requested_by_id=recruiter.user_id,
        status__in=ACTIVE_COMPANY_UPDATE_STATUSES,
    ).first()
    published = _published(company, request)
    done = _published_blocks(company, published)
    changes = update_request.changes if update_request is not None else {}
    waiting = (
        'changes_requested'
        if update_request is not None
        and update_request.status == CompanyUpdateRequest.Status.CHANGES_REQUESTED
        else 'pending'
    )
    has_content = {**done, 'hero': done['headline'] or done['logo'] or done['cover']}
    section_status = {
        section: _section_status(
            keys & set(changes),
            published=has_content[section],
            waiting=waiting,
        )
        for section, keys in SECTION_REQUEST_KEYS.items()
    }
    content_form = {
        'published': published,
        'pending': _pending(changes, request) if update_request is not None else None,
        'request': (
            _request_summary(update_request, recruiter) if update_request is not None else None
        ),
        'section_status': section_status,
    }
    items = [{'key': key, 'label': label, 'done': done[key]} for key, label in COMPLETENESS_ITEMS]
    completeness = {
        'score': round(100 * sum(item['done'] for item in items) / len(items)),
        'items': items,
    }
    return content_form, completeness
