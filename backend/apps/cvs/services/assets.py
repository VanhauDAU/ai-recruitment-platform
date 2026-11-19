import json
import logging
from hashlib import sha256
from io import BytesIO

from django.core import signing
from django.core.files.base import ContentFile
from django.db import transaction
from django.urls import reverse
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError

from common.db.public_id import generate_public_id
from common.storage.r2 import private_media_storage

from ..domain import CV_IMAGE_FORMATS, MAX_CV_IMAGE_BYTES
from ..models import CvAsset, CvVersion
from .upload_claims import (
    CV_AVATAR_CLAIM_SCOPE,
    claim_candidate_upload,
    open_clean_candidate_upload,
)

ASSET_TOKEN_MAX_AGE = 300
ASSET_TOKEN_SALT = 'cv-asset-content-v1'

logger = logging.getLogger(__name__)


def _encode_avatar(upload):
    if upload.size > MAX_CV_IMAGE_BYTES:
        raise ValidationError({'file': 'Image must be 5 MB or smaller.'})
    try:
        upload.seek(0)
        image = Image.open(upload)
        detected_format = image.format
        image.verify()
        upload.seek(0)
        image = Image.open(upload)
        image = ImageOps.exif_transpose(image)
        image.load()
    except (OSError, ValueError) as error:
        raise ValidationError({'file': 'Invalid image file.'}) from error
    if detected_format not in CV_IMAGE_FORMATS:
        raise ValidationError({'file': 'Only JPEG, PNG, or WebP images are supported.'})
    extension, content_type = CV_IMAGE_FORMATS[detected_format]
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    if detected_format == 'JPEG' and image.mode not in {'RGB', 'L'}:
        image = image.convert('RGB')
    buffer = BytesIO()
    image.save(buffer, format=detected_format, optimize=True)
    payload = buffer.getvalue()
    return payload, extension, content_type, image.width, image.height


def create_avatar_asset(*, actor, upload):
    payload, extension, content_type, width, height = _encode_avatar(upload)
    checksum = sha256(payload).hexdigest()
    storage_key = private_media_storage().save(
        f'cvs/assets/{actor.public_id}/{checksum}.{extension}',
        ContentFile(payload),
    )
    asset = CvAsset(
        owner=actor,
        kind=CvAsset.Kind.AVATAR,
        title='',
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(payload),
        width=width,
        height=height,
        checksum_sha256=checksum,
    )
    asset.full_clean()
    asset.save()
    return asset


def create_avatar_asset_from_session(*, actor, upload_session_public_id):
    """Decode and re-encode an avatar only after a clean scanner verdict."""
    storage_key = ''
    try:
        with transaction.atomic():
            asset_public_id = generate_public_id('cva')
            source_asset = claim_candidate_upload(
                owner=actor,
                session_public_id=upload_session_public_id,
                claim_scope=CV_AVATAR_CLAIM_SCOPE,
                claim_reference=asset_public_id,
            )
            with open_clean_candidate_upload(source_asset) as upload:
                payload, extension, content_type, width, height = _encode_avatar(upload)
            checksum = sha256(payload).hexdigest()
            storage_key = private_media_storage().save(
                f'cvs/assets/{actor.public_id}/{checksum}.{extension}',
                ContentFile(payload),
            )
            asset = CvAsset(
                public_id=asset_public_id,
                owner=actor,
                kind=CvAsset.Kind.AVATAR,
                title='',
                storage_key=storage_key,
                content_type=content_type,
                size_bytes=len(payload),
                width=width,
                height=height,
                checksum_sha256=checksum,
            )
            asset.full_clean()
            asset.save()
            return asset
    except Exception:
        if storage_key:
            try:
                private_media_storage().delete(storage_key)
            except Exception:  # noqa: BLE001 - the original error must surface, not the cleanup's
                # Storage reconciliation removes the orphan later; the log says which one.
                logger.warning(
                    'Could not delete orphaned CV avatar %s.', storage_key, exc_info=True
                )
        raise


def document_asset_ids(content_json, style_json):
    ids = set()
    personal_info = content_json.get('personal_info', {}) if isinstance(content_json, dict) else {}
    avatar_id = personal_info.get('avatar_asset_id') if isinstance(personal_info, dict) else None
    background_id = style_json.get('background_asset_id') if isinstance(style_json, dict) else None
    if avatar_id:
        ids.add(avatar_id)
    if background_id:
        ids.add(background_id)
    return ids


def validate_document_assets(*, owner, content_json, style_json):
    requested = document_asset_ids(content_json, style_json)
    if not requested:
        return
    assets = {asset.public_id: asset for asset in CvAsset.objects.filter(public_id__in=requested)}
    if set(assets) != requested:
        raise ValidationError({'assets': 'Document references an unknown CV asset.'})
    avatar_id = content_json.get('personal_info', {}).get('avatar_asset_id')
    if avatar_id:
        avatar = assets[avatar_id]
        if (
            avatar.kind != CvAsset.Kind.AVATAR
            or avatar.owner_id != owner.pk
            or not avatar.is_active
        ):
            raise ValidationError(
                {'content_json.personal_info.avatar_asset_id': 'Avatar is unavailable.'}
            )
    background_id = style_json.get('background_asset_id')
    if background_id:
        background = assets[background_id]
        if (
            background.kind != CvAsset.Kind.BACKGROUND
            or background.owner_id is not None
            or not background.is_active
        ):
            raise ValidationError({'style_json.background_asset_id': 'Background is unavailable.'})


def sign_asset(asset, version=None, *, audience='', subject='', resource=''):
    payload = {
        'asset': asset.public_id,
        'version': version.public_id if version else None,
    }
    if audience:
        payload.update(
            {
                'audience': audience,
                'subject': subject,
                'resource': resource,
            }
        )
    value = json.dumps(payload, separators=(',', ':'))
    return signing.TimestampSigner(salt=ASSET_TOKEN_SALT).sign(value)


def resolve_asset_token(token, *, include_context=False):
    try:
        value = signing.TimestampSigner(salt=ASSET_TOKEN_SALT).unsign(
            token, max_age=ASSET_TOKEN_MAX_AGE
        )
        payload = json.loads(value)
        asset = CvAsset.objects.get(public_id=payload['asset'], is_active=True)
    except (signing.BadSignature, ValueError, KeyError, CvAsset.DoesNotExist) as error:
        raise CvAsset.DoesNotExist from error
    version_id = payload.get('version')
    if version_id:
        try:
            version = CvVersion.objects.get(public_id=version_id)
        except CvVersion.DoesNotExist as error:
            raise CvAsset.DoesNotExist from error
        if asset.public_id not in document_asset_ids(version.content_json, version.style_json):
            raise CvAsset.DoesNotExist
    if include_context:
        return asset, payload
    return asset


def readable_asset(*, asset_public_id, token, user):
    """Asset người xem được tải: theo token ký, hoặc ảnh nền / avatar của chính mình.

    Token gắn đối tượng nhận `recruiter_application` chỉ hợp lệ với đúng NTD đã
    nhận hồ sơ ứng tuyển chứa phiên bản CV đó. Mọi trường hợp bị từ chối đều là
    `CvAsset.DoesNotExist`, để không lộ asset có tồn tại hay không.
    """
    if not token:
        asset = CvAsset.objects.get(public_id=asset_public_id, is_active=True)
        if asset.kind != CvAsset.Kind.BACKGROUND and (
            not user.is_authenticated or asset.owner_id != user.pk
        ):
            raise CvAsset.DoesNotExist
        return asset
    asset, token_context = resolve_asset_token(token, include_context=True)
    if asset.public_id != asset_public_id:
        raise CvAsset.DoesNotExist
    audience = token_context.get('audience')
    if not audience:
        return asset
    if audience != 'recruiter_application':
        raise CvAsset.DoesNotExist
    if (
        not user.is_authenticated
        or not user.is_employer
        or token_context.get('subject') != user.public_id
    ):
        raise CvAsset.DoesNotExist
    from apps.applications.models import Application
    from apps.employers.services import ensure_recruiter_candidate_data_access

    ensure_recruiter_candidate_data_access(user)
    if not Application.objects.filter(
        public_id=token_context.get('resource'),
        job__posted_by=user,
        submitted_cv_version__public_id=token_context.get('version'),
    ).exists():
        raise CvAsset.DoesNotExist
    return asset


def asset_map(
    *,
    content_json,
    style_json,
    request=None,
    owner=None,
    version=None,
    signed=False,
    token_context=None,
):
    requested = document_asset_ids(content_json, style_json)
    assets = CvAsset.objects.filter(public_id__in=requested, is_active=True)
    result = {}
    for asset in assets:
        if asset.kind == CvAsset.Kind.AVATAR and owner is not None and asset.owner_id != owner.pk:
            continue
        path = reverse('cv-asset-content', kwargs={'asset_public_id': asset.public_id})
        if signed:
            token_context = token_context or {}
            path = f'{path}?token={sign_asset(asset, version, **token_context)}'
        url = request.build_absolute_uri(path) if request else path
        result[asset.public_id] = {
            'url': url,
            'kind': asset.kind,
            'width': asset.width,
            'height': asset.height,
        }
    return result
