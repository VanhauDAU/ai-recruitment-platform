from hashlib import sha256
from io import BytesIO
import json

from django.core import signing
from django.core.files.base import ContentFile
from django.urls import reverse
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError

from common.r2_storage import private_media_storage, public_media_storage

from ..models import CvAsset, CvVersion


MAX_AVATAR_BYTES = 5 * 1024 * 1024
ASSET_TOKEN_MAX_AGE = 300
ASSET_TOKEN_SALT = 'cv-asset-content-v1'
ALLOWED_AVATAR_FORMATS = {
    'JPEG': ('jpg', 'image/jpeg'),
    'PNG': ('png', 'image/png'),
    'WEBP': ('webp', 'image/webp'),
}


def _encode_avatar(upload):
    if upload.size > MAX_AVATAR_BYTES:
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
    if detected_format not in ALLOWED_AVATAR_FORMATS:
        raise ValidationError({'file': 'Only JPEG, PNG, or WebP images are supported.'})
    extension, content_type = ALLOWED_AVATAR_FORMATS[detected_format]
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


def create_background_asset(*, upload, title=''):
    if upload.size > MAX_AVATAR_BYTES:
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
    if detected_format not in ALLOWED_AVATAR_FORMATS:
        raise ValidationError({'file': 'Only JPEG, PNG, or WebP images are supported.'})
    extension, content_type = ALLOWED_AVATAR_FORMATS[detected_format]
    image.thumbnail((2480, 3508), Image.Resampling.LANCZOS)
    if detected_format == 'JPEG' and image.mode not in {'RGB', 'L'}:
        image = image.convert('RGB')
    buffer = BytesIO()
    image.save(buffer, format=detected_format, optimize=True)
    payload = buffer.getvalue()
    checksum = sha256(payload).hexdigest()
    storage_key = public_media_storage().save(
        f'cvs/backgrounds/{checksum}.{extension}',
        ContentFile(payload),
    )
    asset = CvAsset(
        owner=None,
        kind=CvAsset.Kind.BACKGROUND,
        title=title.strip(),
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(payload),
        width=image.width,
        height=image.height,
        checksum_sha256=checksum,
    )
    asset.full_clean()
    asset.save()
    return asset


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


def sign_asset(asset, version=None):
    value = json.dumps(
        {'asset': asset.public_id, 'version': version.public_id if version else None},
        separators=(',', ':'),
    )
    return signing.TimestampSigner(salt=ASSET_TOKEN_SALT).sign(value)


def resolve_asset_token(token):
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
    return asset


def asset_map(*, content_json, style_json, request=None, owner=None, version=None, signed=False):
    requested = document_asset_ids(content_json, style_json)
    assets = CvAsset.objects.filter(public_id__in=requested, is_active=True)
    result = {}
    for asset in assets:
        if asset.kind == CvAsset.Kind.AVATAR and owner is not None and asset.owner_id != owner.pk:
            continue
        path = reverse('cv-v2-asset-content', kwargs={'asset_public_id': asset.public_id})
        if signed:
            path = f'{path}?token={sign_asset(asset, version)}'
        url = request.build_absolute_uri(path) if request else path
        result[asset.public_id] = {
            'url': url,
            'kind': asset.kind,
            'width': asset.width,
            'height': asset.height,
        }
    return result
