import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import EmailValidator, URLValidator
from rest_framework import serializers

from common.media_storage import media_url_from_value
from common.rich_text import rich_text_plain_text, sanitize_rich_text

from ...models import Company, CompanyDocument, CompanyUpdateRequest, Industry
from ...services import SENSITIVE_FIELDS, UPDATABLE_COMPANY_FIELDS


class CompanyDocumentSerializer(serializers.ModelSerializer):
    doc_type_label = serializers.CharField(source='get_doc_type_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    file_url = serializers.SerializerMethodField()
    source_type = serializers.SerializerMethodField()
    update_request = serializers.CharField(source='update_request.public_id', read_only=True)

    class Meta:
        model = CompanyDocument
        fields = [
            'id',
            'public_id',
            'doc_type',
            'doc_type_label',
            'source_type',
            'file_url',
            'file_name',
            'mime_type',
            'file_size',
            'version',
            'is_current',
            'status',
            'status_label',
            'review_note',
            'reviewed_at',
            'update_request',
            'created_at',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        if obj.file_url.startswith(('http://', 'https://')):
            return obj.file_url
        from django.urls import reverse

        path = reverse('employer-company-document-content', kwargs={'pk': obj.pk})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_source_type(self, obj):
        # URL ngoài chỉ được dùng cho bằng chứng tên thương mại. Không cần thêm
        # cột mới: URL lưu trong file_url đã là dữ liệu nguồn của document.
        return (
            'website'
            if obj.doc_type == CompanyDocument.DocType.TRADE_NAME_PROOF
            and obj.file_url.startswith(('http://', 'https://'))
            else 'file'
        )


class CompanyUpdateRequestSerializer(serializers.ModelSerializer):
    documents = CompanyDocumentSerializer(many=True, read_only=True)
    media_previews = serializers.SerializerMethodField()

    class Meta:
        model = CompanyUpdateRequest
        fields = [
            'public_id',
            'changes',
            'is_sensitive',
            'reason',
            'proof_type',
            'status',
            'review_note',
            'documents',
            'media_previews',
            'created_at',
            'updated_at',
            'revision',
            'lock_version',
        ]
        read_only_fields = [
            'public_id',
            'is_sensitive',
            'status',
            'review_note',
            'created_at',
            'updated_at',
            'revision',
            'lock_version',
        ]

    def get_media_previews(self, obj):
        changes = obj.changes or {}
        request = self.context.get('request')
        previews = {
            field: media_url_from_value(changes[field], request=request)
            for field in ('logo_url', 'cover_image_url')
            if changes.get(field)
        }
        previews['gallery_additions'] = [
            media_url_from_value(value, request=request)
            for value in changes.get('gallery_additions', [])
            if value
        ]
        return previews

    def validate_changes(self, value):
        if not isinstance(value, dict) or not value:
            raise serializers.ValidationError('Chưa có thay đổi nào.')
        allowed = UPDATABLE_COMPANY_FIELDS | {
            'industries',
            'primary_industry',
            'gallery_deletions',
            'logo_pending',
            'cover_pending',
            'gallery_pending',
        }
        invalid = set(value) - allowed
        if invalid:
            raise serializers.ValidationError(
                f'Trường không được phép cập nhật: {", ".join(sorted(invalid))}'
            )
        for marker in ('logo_pending', 'cover_pending', 'gallery_pending'):
            if marker in value and value[marker] is not True:
                raise serializers.ValidationError({marker: 'Trạng thái tải ảnh không hợp lệ.'})
        return value

    def validate(self, attrs):
        # Đổi MST/tên công ty phải kèm lý do + loại giấy tờ chứng minh.
        sensitive = bool(SENSITIVE_FIELDS & set(attrs.get('changes', {})))
        if sensitive:
            if not attrs.get('reason', '').strip():
                raise serializers.ValidationError(
                    {'reason': 'Nhập lý do khi thay đổi Mã số thuế hoặc Tên công ty.'}
                )
            if not attrs.get('proof_type'):
                raise serializers.ValidationError(
                    {
                        'proof_type': 'Chọn loại giấy tờ chứng minh khi thay đổi Mã số thuế hoặc Tên công ty.'
                    }
                )
        attrs['changes'] = self._validate_company_changes(attrs['changes'])
        attrs['reason'] = attrs.get('reason', '').strip()
        attrs['is_sensitive'] = sensitive
        return attrs

    def _validate_company_changes(self, changes):
        company = self.context.get('company')
        cleaned = dict(changes)
        required_text = {
            'company_name': 'Tên đăng ký kinh doanh',
            'email': 'Email',
            'phone': 'Số điện thoại',
            'address': 'Địa chỉ',
            'company_size': 'Quy mô công ty',
        }
        for field, label in required_text.items():
            if field in cleaned and not str(cleaned[field] or '').strip():
                raise serializers.ValidationError({field: f'{label} là bắt buộc.'})

        if (
            'business_type' in cleaned
            and cleaned['business_type'] not in Company.BusinessType.values
        ):
            raise serializers.ValidationError(
                {'business_type': 'Loại hình kinh doanh không hợp lệ.'}
            )
        if 'company_size' in cleaned and cleaned['company_size'] not in Company.Size.values:
            raise serializers.ValidationError({'company_size': 'Quy mô công ty không hợp lệ.'})
        if 'email' in cleaned:
            try:
                EmailValidator()(cleaned['email'])
            except DjangoValidationError as error:
                raise serializers.ValidationError(
                    {'email': 'Email công ty không hợp lệ.'}
                ) from error
        if 'phone' in cleaned and not re.fullmatch(r'\+?[0-9 .()\-]{8,20}', cleaned['phone']):
            raise serializers.ValidationError({'phone': 'Số điện thoại không hợp lệ.'})
        if cleaned.get('website_url'):
            try:
                URLValidator(schemes=['http', 'https'])(cleaned['website_url'])
            except DjangoValidationError as error:
                raise serializers.ValidationError(
                    {'website_url': 'URL website không hợp lệ.'}
                ) from error

        if 'tax_code' in cleaned:
            tax_code = re.sub(r'\s+', '', str(cleaned['tax_code'] or ''))
            if not re.fullmatch(r'\d{10}(?:-\d{3})?', tax_code):
                raise serializers.ValidationError(
                    {'tax_code': 'Mã số thuế phải gồm 10 chữ số hoặc có dạng 10 chữ số-3 chữ số.'}
                )
            cleaned['tax_code'] = tax_code

        for field, required, label in (
            ('description', True, 'Mô tả công ty'),
            ('employee_benefits', False, 'Phúc lợi nhân viên'),
        ):
            if field not in cleaned:
                continue
            cleaned[field] = sanitize_rich_text(cleaned[field])
            visible = rich_text_plain_text(cleaned[field])
            if required and not visible:
                raise serializers.ValidationError({field: f'{label} là bắt buộc.'})
            if len(visible) > 10_000:
                raise serializers.ValidationError(
                    {field: f'{label} không được vượt quá 10.000 ký tự.'}
                )

        if 'markets' in cleaned:
            invalid = set(cleaned['markets']) - set(Company.Market.values)
            if invalid:
                raise serializers.ValidationError({'markets': 'Thị trường hoạt động không hợp lệ.'})
        if 'target_customers' in cleaned:
            invalid = set(cleaned['target_customers']) - set(Company.TargetCustomer.values)
            if invalid:
                raise serializers.ValidationError(
                    {'target_customers': 'Khách hàng mục tiêu không hợp lệ.'}
                )

        if 'industries' in cleaned or 'primary_industry' in cleaned:
            industry_ids = cleaned.get(
                'industries',
                list(company.industries.values_list('id', flat=True)) if company else [],
            )
            if not isinstance(industry_ids, list):
                raise serializers.ValidationError(
                    {'industries': 'Danh sách lĩnh vực không hợp lệ.'}
                )
            primary_id = cleaned.get(
                'primary_industry',
                company.company_industries.filter(is_primary=True)
                .values_list('industry_id', flat=True)
                .first()
                if company
                else None,
            )
            found_ids = set(
                Industry.objects.filter(id__in=industry_ids).values_list('id', flat=True)
            )
            if len(found_ids) != len(set(industry_ids)):
                raise serializers.ValidationError({'industries': 'Có lĩnh vực không tồn tại.'})
            if not found_ids:
                raise serializers.ValidationError(
                    {'industries': 'Chọn ít nhất một lĩnh vực hoạt động.'}
                )
            if primary_id not in found_ids:
                raise serializers.ValidationError(
                    {'primary_industry': 'Lĩnh vực chính phải nằm trong các lĩnh vực đã chọn.'}
                )

        if 'gallery_deletions' in cleaned:
            deletion_ids = cleaned['gallery_deletions']
            if not isinstance(deletion_ids, list) or any(
                not isinstance(image_id, int) for image_id in deletion_ids
            ):
                raise serializers.ValidationError(
                    {'gallery_deletions': 'Danh sách ảnh cần xóa không hợp lệ.'}
                )
            existing_ids = set(
                company.images.filter(id__in=deletion_ids).values_list('id', flat=True)
            )
            if len(existing_ids) != len(set(deletion_ids)):
                raise serializers.ValidationError(
                    {'gallery_deletions': 'Có ảnh không thuộc công ty hiện tại.'}
                )

        website = cleaned.get('website_url', getattr(company, 'website_url', ''))
        has_no_website = cleaned.get('has_no_website', getattr(company, 'has_no_website', False))
        if {'website_url', 'has_no_website'} & set(cleaned) and not website and not has_no_website:
            raise serializers.ValidationError(
                {'website_url': 'Nhập URL website hoặc chọn "Tôi không có website".'}
            )

        name = cleaned.get('company_name', getattr(company, 'company_name', ''))
        same_name = cleaned.get(
            'trade_name_same_as_registered',
            getattr(company, 'trade_name_same_as_registered', False),
        )
        if same_name:
            cleaned['trade_name'] = name
        elif {'company_name', 'trade_name', 'trade_name_same_as_registered'} & set(cleaned):
            trade_name = cleaned.get('trade_name', getattr(company, 'trade_name', ''))
            if not str(trade_name or '').strip():
                # Hồ sơ legacy có thể chưa có tên thương mại. Khi đổi tên đăng
                # ký, chuẩn hóa chúng về cùng tên thay vì chặn toàn bộ workflow.
                cleaned['trade_name'] = name
                cleaned['trade_name_same_as_registered'] = True
        return cleaned
