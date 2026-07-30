"""Employer account registration and first-profile completion."""

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User

from .profiles import get_or_create_recruiter
from .verification import reconcile_recruiter_verification


@transaction.atomic
def complete_registration_profile(user, validated_data):
    if not user.is_employer:
        raise ValidationError({'detail': 'Chỉ tài khoản nhà tuyển dụng được cập nhật hồ sơ này.'})

    recruiter = get_or_create_recruiter(user)
    if recruiter.registration_completed_at is not None:
        raise ValidationError({'detail': 'Thông tin đăng ký nhà tuyển dụng đã được hoàn tất.'})

    now = timezone.now()
    location = validated_data['work_location']
    contact_phone = validated_data['contact_phone']

    user.full_name = validated_data['full_name']
    user.phone = contact_phone
    user.save(update_fields=['full_name', 'phone', 'updated_at'])

    recruiter.gender = validated_data['gender']
    recruiter.contact_phone = contact_phone
    recruiter.work_location = location
    recruiter.registration_completed_at = now
    recruiter.terms_accepted_at = now
    recruiter.terms_policy_version = settings.EMPLOYER_TERMS_POLICY_VERSION
    recruiter.marketing_opt_in = validated_data.get('marketing_opt_in', False)
    recruiter.marketing_decided_at = now
    recruiter.save()
    reconcile_recruiter_verification(recruiter, source='registration_completed')
    return recruiter


def register_employer(validated_data):
    account_data = dict(validated_data)
    email = account_data.pop('email')
    password = account_data.pop('password')
    account_data.pop('captcha_token', None)
    account_data.pop('terms_accepted', None)
    account_data['terms_accepted'] = True

    # `except` phải nằm NGOÀI atomic: bên trong block đang hỏng, mọi truy vấn
    # tiếp theo (kể cả việc dựng response lỗi) đều bị từ chối.
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                role=User.Role.EMPLOYER,
            )
            recruiter = complete_registration_profile(user, account_data)
    except IntegrityError as error:
        # Giữa lúc serializer kiểm tra email trống và lúc ghi vào DB có một cửa
        # sổ: hai đơn đăng ký song song cùng email đều qua được validator rồi
        # mới đụng uniq_users_email_role_lower. Đây vẫn là lỗi nhập liệu của
        # người dùng, không phải sự cố hệ thống.
        raise ValidationError(
            {'email': 'Email này đã được sử dụng cho một tài khoản nhà tuyển dụng.'}
        ) from error
    return user, recruiter
