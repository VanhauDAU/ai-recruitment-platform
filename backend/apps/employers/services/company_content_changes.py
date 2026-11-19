"""Page content that publishes at once and is reviewed afterwards (ADR-0017).

A page editor of a company without ``content_review_required`` publishes a
block directly; every publish leaves a ``CompanyContentChange`` with the values
it replaced. Administrators then mark changes reviewed or revert them, and may
send a company back to review-first. Files a change replaced stay on disk until
the change is reviewed, so a revert can put them back.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.services import record_admin_action
from apps.employers.domain.page_content import GALLERY_LIMIT
from common.storage.media import delete_local_media_url

from ..models import (
    Company,
    CompanyContentChange,
    CompanyImage,
    CompanyPageEvent,
    CompanyUpdateRequest,
    EmployerNotification,
)
from ..models.company_update import (
    ACTIVE_COMPANY_UPDATE_STATUSES,
    REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES,
)
from .company_page_content import (
    company_benefit_values,
    company_office_values,
    replace_company_benefits,
    replace_company_offices,
)
from .company_update_review import close_company_update_before_review
from .company_update_revisions import company_update_field_value, snapshot_company_update_request
from .company_update_submission import CompanyUpdateInReview
from .notifications import emit_employer_event

# Media an editor announces with a marker, then uploads against the change.
MEDIA_MARKERS = {'logo_pending': 'logo', 'cover_pending': 'cover', 'gallery_pending': 'gallery'}
MEDIA_FIELDS = {'logo': 'logo_url', 'cover': 'cover_image_url'}
COLUMN_FIELDS = ('headline', 'description', 'culture', 'employee_benefits', 'video_url')
FIELD_LABELS = {
    'headline': 'Khẩu hiệu',
    'description': 'Giới thiệu',
    'culture': 'Văn hoá',
    'employee_benefits': 'Phúc lợi',
    'benefits': 'Phúc lợi',
    'video_url': 'Video',
    'social_links': 'Mạng xã hội',
    'offices': 'Văn phòng',
    'logo_url': 'Logo',
    'cover_image_url': 'Ảnh bìa',
    'gallery_additions': 'Ảnh thư viện mới',
    'gallery_deletions': 'Ảnh thư viện đã xoá',
}
# Request keys a publish of each key supersedes in the editor's own open request.
SUPERSEDED_REQUEST_KEYS = {
    'logo_url': {'logo_url', 'logo_pending', 'has_no_logo'},
    'cover_image_url': {'cover_image_url', 'cover_pending'},
}


def _gallery_rows(images):
    return [
        {
            'id': image.id,
            'image_url': image.image_url,
            'caption': image.caption,
            'sort_order': image.sort_order,
        }
        for image in images
    ]


def _is_published(company, field, value):
    if field == 'gallery_deletions':
        return not value
    return company_update_field_value(company, field) == value


def _apply(company, changes):
    """Write ``changes`` to the locked company; returns the values they replaced."""
    previous = {}
    for field in (*COLUMN_FIELDS, 'social_links'):
        if field in changes:
            previous[field] = getattr(company, field)
            setattr(company, field, changes[field])
    if 'benefits' in changes:
        previous['benefits'] = company_benefit_values(company)
        replace_company_benefits(company, changes['benefits'])
    if 'offices' in changes:
        previous['offices'] = company_office_values(company)
        replace_company_offices(company, changes['offices'])
    if changes.get('gallery_deletions'):
        images = list(company.images.filter(id__in=changes['gallery_deletions']))
        previous['gallery_deletions'] = _gallery_rows(images)
        CompanyImage.objects.filter(id__in=[image.id for image in images]).delete()
    company.save()
    return previous


def _drop_from_request(update_request, *, actor, fields):
    """Remove what was just published from the editor's own open request."""
    changes = dict(update_request.changes)
    dropped = set()
    for field in fields:
        dropped |= SUPERSEDED_REQUEST_KEYS.get(field, {field})
    dropped &= set(changes)
    if not dropped:
        return
    staged = [changes[field] for field in MEDIA_FIELDS.values() if field in dropped]
    remaining = {field: value for field, value in changes.items() if field not in dropped}
    if remaining:
        update_request.changes = remaining
        update_request.base_values = {
            field: value
            for field, value in (update_request.base_values or {}).items()
            if field in remaining
        }
        update_request.save(update_fields=['changes', 'base_values', 'updated_at'])
        snapshot_company_update_request(
            update_request,
            actor=actor,
            payload={'published_directly': sorted(dropped)},
        )
    else:
        close_company_update_before_review(
            update_request,
            actor=actor,
            action=CompanyUpdateRequest.Status.WITHDRAWN,
            reason='',
            lock_version=update_request.lock_version,
        )

    def delete_staged():
        for path in staged:
            if path:
                delete_local_media_url(path)

    transaction.on_commit(delete_staged)


@transaction.atomic
def publish_company_page_content(*, company_id, actor, validate):
    """Publish a block of page content now and log it for post-moderation.

    ``validate(company, active_request)`` returns the validated data like for
    ``submit_validated_company_update``. Media markers (``logo_pending``…) are
    recorded on the change so the editor can upload those files against it.
    Keys the editor's own open request also carries leave that request; an
    open request already in review keeps them read-only.
    """
    company = Company.objects.select_for_update().get(pk=company_id)
    active_request = (
        CompanyUpdateRequest.objects.select_for_update()
        .filter(company=company, requested_by=actor, status__in=ACTIVE_COMPANY_UPDATE_STATUSES)
        .first()
    )
    incoming = dict(validate(company, active_request)['changes'])
    media = [kind for marker, kind in MEDIA_MARKERS.items() if incoming.pop(marker, False)]
    touched = set(incoming) | {MEDIA_FIELDS[kind] for kind in media if kind in MEDIA_FIELDS}
    if (
        active_request is not None
        and active_request.status == CompanyUpdateRequest.Status.IN_REVIEW
        and touched & set(active_request.changes)
    ):
        raise CompanyUpdateInReview
    changes = {
        field: value
        for field, value in incoming.items()
        if not _is_published(company, field, value)
    }
    if not changes and not media:
        raise ValidationError({'changes': ['Chưa có thay đổi nào so với trang đang công khai.']})
    previous = _apply(company, changes) if changes else {}
    change = CompanyContentChange.objects.create(
        company=company,
        actor=actor,
        changes=changes,
        previous=previous,
        pending_media=media,
    )
    if (
        active_request is not None
        and active_request.status in REQUESTER_EDITABLE_COMPANY_UPDATE_STATUSES
    ):
        _drop_from_request(active_request, actor=actor, fields=set(changes) | touched)
    return change


def publish_content_change_image(change, *, company, kind, path):
    """Publish an uploaded image into ``change``; call under the caller's transaction.

    ``company`` and ``change`` are locked here. A logo or cover keeps the file
    it replaces until the change is reviewed.
    """
    company = Company.objects.select_for_update().get(pk=company.pk)
    change = CompanyContentChange.objects.select_for_update().get(pk=change.pk)
    if change.status != CompanyContentChange.Status.UNREVIEWED or kind not in change.pending_media:
        raise ValidationError({'content_change': 'Thay đổi nội dung này không còn nhận ảnh.'})
    changes, previous = dict(change.changes), dict(change.previous)
    if kind == 'gallery':
        if company.images.count() >= GALLERY_LIMIT:
            raise ValidationError(
                {'file': f'Thư viện công ty chỉ được có tối đa {GALLERY_LIMIT} ảnh.'}
            )
        last = company.images.order_by('-sort_order').values_list('sort_order', flat=True).first()
        image = CompanyImage.objects.create(
            company=company,
            image_url=path,
            sort_order=(last + 1) if last is not None else 0,
        )
        changes['gallery_additions'] = [
            *changes.get('gallery_additions', []),
            {'id': image.id, 'image_url': path},
        ]
    else:
        field = MEDIA_FIELDS[kind]
        if field in changes:
            # A second file for the same slot: the first was never reviewed.
            replaced = changes[field]
            transaction.on_commit(lambda: delete_local_media_url(replaced))
        else:
            previous[field] = getattr(company, field)
            if kind == 'logo':
                previous['has_no_logo'] = company.has_no_logo
        setattr(company, field, path)
        if kind == 'logo':
            company.has_no_logo = False
        company.save()
        changes[field] = path
        change.pending_media = [item for item in change.pending_media if item != kind]
    change.changes, change.previous = changes, previous
    change.save(update_fields=['changes', 'previous', 'pending_media', 'updated_at'])
    return company


def _company_media_paths(company):
    return {
        company.logo_url,
        company.cover_image_url,
        *company.images.values_list('image_url', flat=True),
    }


def _replaced_paths(change):
    previous = change.previous or {}
    return [
        *(previous.get(field) for field in MEDIA_FIELDS.values()),
        *(row['image_url'] for row in previous.get('gallery_deletions', [])),
    ]


@transaction.atomic
def mark_company_content_changes_reviewed(*, actor, public_ids):
    """Close unreviewed changes as seen and drop the files they replaced."""
    changes = list(
        CompanyContentChange.objects.select_for_update()
        .select_related('company')
        .filter(public_id__in=public_ids, status=CompanyContentChange.Status.UNREVIEWED)
    )
    now = timezone.now()
    paths = []
    for change in changes:
        in_use = _company_media_paths(change.company)
        paths.extend(path for path in _replaced_paths(change) if path and path not in in_use)
        change.status = CompanyContentChange.Status.REVIEWED
        change.reviewed_by = actor
        change.reviewed_at = now
        change.updated_at = now
    CompanyContentChange.objects.bulk_update(
        changes, ['status', 'reviewed_by', 'reviewed_at', 'updated_at']
    )
    if changes:
        record_admin_action(
            actor=actor,
            action='review_company_content_changes',
            target_type='company_content_change',
            target_public_id=changes[0].public_id,
            payload={'content_change_public_ids': [change.public_id for change in changes]},
        )

    def delete_replaced():
        for path in paths:
            delete_local_media_url(path)

    transaction.on_commit(delete_replaced)
    return len(changes)


def _still_published(company, field, value):
    if field == 'gallery_deletions':
        return True
    if field == 'gallery_additions':
        ids = {row['id'] for row in value}
        return company.images.filter(id__in=ids).count() == len(ids)
    return company_update_field_value(company, field) == value


def _restore(company, change):
    """Put the values ``change`` replaced back; returns files to delete."""
    previous = change.previous or {}
    changes = change.changes or {}
    discarded = []
    for field in (*COLUMN_FIELDS, 'social_links'):
        if field in changes:
            setattr(company, field, previous[field])
    if 'benefits' in changes:
        replace_company_benefits(company, previous['benefits'])
    if 'offices' in changes:
        replace_company_offices(company, previous['offices'])
    for field in MEDIA_FIELDS.values():
        if field in changes:
            discarded.append(changes[field])
            setattr(company, field, previous[field])
    if 'logo_url' in changes:
        company.has_no_logo = previous['has_no_logo']
    if changes.get('gallery_additions'):
        ids = [row['id'] for row in changes['gallery_additions']]
        discarded.extend(row['image_url'] for row in changes['gallery_additions'])
        CompanyImage.objects.filter(company=company, id__in=ids).delete()
    restored = previous.get('gallery_deletions', [])
    if restored:
        if company.images.count() + len(restored) > GALLERY_LIMIT:
            raise ValidationError(
                {
                    'detail': (
                        f'Không thể khôi phục ảnh đã xoá: thư viện sẽ vượt quá {GALLERY_LIMIT} ảnh.'
                    )
                }
            )
        CompanyImage.objects.bulk_create(
            CompanyImage(
                company=company,
                image_url=row['image_url'],
                caption=row['caption'],
                sort_order=row['sort_order'],
            )
            for row in restored
        )
    company.save()
    return discarded


@transaction.atomic
def revert_company_content_change(*, actor, public_id, reason, require_review=False):
    """Undo one unreviewed change, tell its editor why, optionally require review."""
    found = CompanyContentChange.objects.filter(public_id=public_id).only('company_id').first()
    if found is None:
        raise ValidationError({'detail': 'Không tìm thấy thay đổi nội dung.'})
    company = Company.objects.select_for_update().get(pk=found.company_id)
    change = CompanyContentChange.objects.select_for_update().get(pk=found.pk)
    if change.status != CompanyContentChange.Status.UNREVIEWED:
        raise ValidationError({'detail': 'Chỉ hoàn tác được thay đổi chưa xem.'})
    if change.pending_media and not change.changes:
        raise ValidationError({'detail': 'Thay đổi này chưa có nội dung để hoàn tác.'})
    conflicts = [
        field
        for field, value in change.changes.items()
        if not _still_published(company, field, value)
    ]
    if conflicts:
        labels = ', '.join(dict.fromkeys(FIELD_LABELS.get(field, field) for field in conflicts))
        raise ValidationError(
            {
                'detail': f'Đã có thay đổi mới hơn ở: {labels}. Hoàn tác thay đổi mới hơn trước.',
                'fields': conflicts,
            }
        )
    discarded = _restore(company, change)
    change.status = CompanyContentChange.Status.REVERTED
    change.reviewed_by = actor
    change.reviewed_at = timezone.now()
    change.review_note = reason
    change.pending_media = []
    change.save(
        update_fields=[
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_note',
            'pending_media',
            'updated_at',
        ]
    )
    record_admin_action(
        actor=actor,
        action='revert_company_content_change',
        target_type='company_content_change',
        target_public_id=change.public_id,
        payload={
            'company_public_id': company.public_id,
            'fields': sorted(change.changes),
            'reason': reason,
        },
    )
    emit_employer_event(
        recipient=change.actor,
        actor=actor,
        event_type=EmployerNotification.EventType.COMPANY_CONTENT_REVERTED,
        dedupe_key=f'company-content-revert:{change.public_id}',
        message=reason,
        subject_public_id=company.public_id,
        metadata={'company_public_id': company.public_id},
    )
    if require_review and not company.content_review_required:
        set_company_content_review(company, actor=actor, required=True, reason=reason)

    def delete_discarded():
        for path in discarded:
            if path:
                delete_local_media_url(path)

    transaction.on_commit(delete_discarded)
    return change


@transaction.atomic
def set_company_content_review(company, *, actor, required, reason):
    """Send a company's page content back through review, or release it."""
    # QuerySet.update() like the policy hold: it must not move updated_at.
    changed = Company.objects.filter(pk=company.pk, content_review_required=not required).update(
        content_review_required=required
    )
    if not changed:
        raise ValidationError(
            {
                'detail': (
                    'Công ty đang được duyệt trước nội dung.'
                    if required
                    else 'Công ty hiện không bị duyệt trước nội dung.'
                )
            }
        )
    company.content_review_required = required
    CompanyPageEvent.objects.create(
        company=company,
        actor=actor,
        event_type=(
            CompanyPageEvent.EventType.CONTENT_REVIEW_REQUIRED
            if required
            else CompanyPageEvent.EventType.CONTENT_REVIEW_RELEASED
        ),
        payload={'reason': reason},
    )
    record_admin_action(
        actor=actor,
        action=('require_company_content_review' if required else 'release_company_content_review'),
        target_type='company',
        target_public_id=company.public_id,
        payload={'reason': reason},
    )
    return company
