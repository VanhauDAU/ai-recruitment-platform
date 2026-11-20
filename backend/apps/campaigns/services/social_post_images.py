"""Images attached to a social post: uploads, the company cover and logo.

Uploads are re-encoded (metadata such as GPS is dropped, the long side capped)
and stored in public media, since the post is public on the network anyway. A post
may only reference images uploaded for its own campaign or the company's
current cover and logo.
"""

from hashlib import sha256
from io import BytesIO
from math import ceil
from pathlib import PurePosixPath
from uuid import uuid4

from django.core.files.base import ContentFile
from django.utils.translation import gettext as _
from django.utils.translation import ngettext
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

from common.storage.media import media_public_url, media_storage_path, validate_image_upload
from common.storage.r2 import public_media_storage

from ..domain.social_networks import network_for_channel_kind
from .social import PostImage

MAX_SIDE = 2048
MAX_FIT_WIDTH = 1440  # widest image Instagram keeps without rescaling


def _prefix(campaign):
    return f'campaigns/{campaign.public_id}/social/'


def _ensure_postable(channel, user):
    campaign = channel.campaign
    if campaign.owner.user_id != user.pk:
        raise ValidationError(_('Bạn không có quyền với chiến dịch này.'))
    if campaign.is_terminal:
        raise ValidationError({'detail': _('Chiến dịch đã kết thúc, không đăng thêm được.')})
    if network_for_channel_kind(channel.kind) is None:
        raise ValidationError({'detail': _('Kênh này không tự đăng bài được.')})


def save_post_image(*, channel, user, upload):
    """Validate, re-encode and store one image; returns its storage key and URL."""
    _ensure_postable(channel, user)
    validate_image_upload(upload)
    try:
        with Image.open(upload) as probe:
            probe.verify()
        upload.seek(0)
        image = Image.open(upload)
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValidationError({'file': _('Ảnh bị lỗi hoặc không đọc được.')}) from error
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    has_alpha = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
    buffer = BytesIO()
    if has_alpha:
        image.convert('RGBA').save(buffer, format='PNG', optimize=True)
        extension = 'png'
    else:
        image.convert('RGB').save(buffer, format='JPEG', quality=88, optimize=True)
        extension = 'jpg'
    path = public_media_storage().save(
        f'{_prefix(channel.campaign)}{uuid4().hex}.{extension}', ContentFile(buffer.getvalue())
    )
    return {'path': path, 'url': media_public_url(path)}


def company_post_images(campaign):
    """The company's cover and logo, when stored by ProCV, as ready-made choices."""
    company = campaign.company
    choices = []
    for kind, label, value in (
        ('cover', _('Ảnh bìa công ty'), getattr(company, 'cover_image_url', '')),
        ('logo', _('Logo công ty'), getattr(company, 'logo_url', '')),
    ):
        path = media_storage_path(value)
        if path:
            choices.append(
                {'kind': kind, 'label': label, 'path': path, 'url': media_public_url(path)}
            )
    return choices


def clean_post_images(campaign, images, *, max_images):
    """Keep only images this campaign may post, in order, without duplicates."""
    allowed_company = {item['path'] for item in company_post_images(campaign)}
    cleaned = []
    for value in images or []:
        path = media_storage_path(value)
        if not path or path in cleaned:
            continue
        own = str(PurePosixPath(path)).startswith(_prefix(campaign))
        if not (own or path in allowed_company):
            raise ValidationError({'images': _('Ảnh không thuộc chiến dịch hoặc công ty này.')})
        if not public_media_storage().exists(path):
            raise ValidationError({'images': _('Ảnh đã bị xóa, hãy tải lại.')})
        cleaned.append(path)
    if len(cleaned) > max_images:
        raise ValidationError(
            {
                'images': ngettext(
                    'Mỗi bài tối đa %(count)s ảnh.',
                    'Mỗi bài tối đa %(count)s ảnh.',
                    max_images,
                )
                % {'count': max_images}
            }
        )
    return cleaned


def _fit_ratio(image, image_ratio):
    """Pad ``image`` with white to the nearest allowed width/height ratio, as RGB."""
    narrowest, widest = image_ratio
    if image.mode in ('RGBA', 'LA', 'P'):
        image = image.convert('RGBA')
        flat = Image.new('RGB', image.size, 'white')
        flat.paste(image, mask=image.getchannel('A'))
        image = flat
    else:
        image = image.convert('RGB')
    width, height = image.size
    if width / height < narrowest:
        width = ceil(height * narrowest)
    elif width / height > widest:
        height = ceil(width / widest)
    if (width, height) != image.size:
        canvas = Image.new('RGB', (width, height), 'white')
        canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
        image = canvas
    image.thumbnail((MAX_FIT_WIDTH, MAX_FIT_WIDTH * 2), Image.LANCZOS)
    return image


def _fitted_path(campaign, path, image_ratio):
    """A JPEG of ``path`` within ``image_ratio``, stored once under the campaign."""
    digest = sha256(f'{path}:{image_ratio}'.encode()).hexdigest()[:20]
    fitted = f'{_prefix(campaign)}fit/{digest}.jpg'
    storage = public_media_storage()
    if not storage.exists(fitted):
        with storage.open(path, 'rb') as stored, Image.open(stored) as image:
            buffer = BytesIO()
            _fit_ratio(image, image_ratio).save(buffer, format='JPEG', quality=90, optimize=True)
        storage.save(fitted, ContentFile(buffer.getvalue()))
    return fitted


def read_post_images(post):
    """The post's images for its network, in order; a missing file is skipped.

    A network with an ``image_ratio`` gets a padded JPEG copy, since it only
    accepts that format and those proportions.
    """
    storage = public_media_storage()
    image_ratio = post.connection.spec.capabilities.image_ratio
    images = []
    for path in post.images or []:
        if not storage.exists(path):
            continue
        if image_ratio:
            path = _fitted_path(post.channel.campaign, path, image_ratio)
        with storage.open(path, 'rb') as stored:
            images.append(
                PostImage(
                    name=PurePosixPath(path).name, content=stored.read(), url=media_public_url(path)
                )
            )
    return images
