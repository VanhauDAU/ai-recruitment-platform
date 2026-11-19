"""Admin review of staged company-profile changes (company update requests)."""

from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.jobs.models import Benefit
from apps.locations.models import Location
from common.storage.media import media_url_from_value

from ....models import CompanyBenefit, CompanyOffice, CompanyUpdateEvent, CompanyUpdateRequest
from .cases import (
    AdminTaxLookupEvidenceSerializer,
    AdminVerificationDocumentSerializer,
    latest_revision_tax_evidence,
)


def _benefit_previews(items, names):
    return [{'name': names.get(item['benefit_id'], ''), 'note': item['note']} for item in items]


def _office_previews(items, province_names):
    return [
        {
            'label': item['label'],
            'address': item['address_line'],
            'province_name': province_names.get(item['province_id'], ''),
            'is_headquarters': item['is_headquarters'],
        }
        for item in items
    ]


def _published_benefits(company_ids):
    rows = {}
    for item in (
        CompanyBenefit.objects.filter(company_id__in=company_ids)
        .select_related('benefit')
        .order_by('sort_order', 'id')
    ):
        rows.setdefault(item.company_id, []).append({'name': item.benefit.name, 'note': item.note})
    return rows


def _published_offices(company_ids):
    rows = {}
    for office in (
        CompanyOffice.objects.filter(company_id__in=company_ids)
        .select_related('province')
        .order_by('sort_order', 'id')
    ):
        rows.setdefault(office.company_id, []).append(
            {
                'label': office.label,
                'address': office.address_line,
                'province_name': office.province.name,
                'is_headquarters': office.is_headquarters,
            }
        )
    return rows


class AdminCompanyUpdateEventSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source='get_event_type_display', read_only=True)
    actor_email = serializers.EmailField(source='actor.email', read_only=True, allow_null=True)

    class Meta:
        model = CompanyUpdateEvent
        fields = [
            'public_id',
            'event_type',
            'event_type_label',
            'revision_number',
            'actor_email',
            'payload',
            'created_at',
        ]
        read_only_fields = fields


class AdminCompanyUpdateRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    proof_type_label = serializers.CharField(source='get_proof_type_display', read_only=True)
    requested_by_email = serializers.EmailField(source='requested_by.email', read_only=True)
    requested_by_public_id = serializers.CharField(
        source='requested_by.public_id',
        read_only=True,
    )
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)
    company = serializers.SerializerMethodField()
    current_values = serializers.SerializerMethodField()
    industry_labels = serializers.SerializerMethodField()
    media_previews = serializers.SerializerMethodField()
    previews = serializers.SerializerMethodField()
    documents = AdminVerificationDocumentSerializer(many=True, read_only=True)
    tax_lookup_evidence = serializers.SerializerMethodField()
    current_revision_public_id = serializers.CharField(
        source='current_revision.public_id',
        read_only=True,
        allow_null=True,
    )
    events = AdminCompanyUpdateEventSerializer(many=True, read_only=True)

    class Meta:
        model = CompanyUpdateRequest
        fields = [
            'public_id',
            'company',
            'requested_by_email',
            'requested_by_public_id',
            'changes',
            'current_values',
            'industry_labels',
            'media_previews',
            'previews',
            'is_sensitive',
            'reason',
            'proof_type',
            'proof_type_label',
            'status',
            'status_label',
            'reviewed_by_email',
            'reviewed_at',
            'review_note',
            'documents',
            'tax_lookup_evidence',
            'revision',
            'current_revision_public_id',
            'lock_version',
            'base_company_updated_at',
            'events',
            'submitted_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_company(self, obj) -> dict:
        return {
            'public_id': obj.company.public_id,
            'name': obj.company.company_name,
            'tax_code': obj.company.tax_code or '',
        }

    def get_current_values(self, obj) -> dict:
        company = obj.company
        assignments = list(company.company_industries.all())
        primary_assignment = next((item for item in assignments if item.is_primary), None)
        values = {}
        for field in obj.changes or {}:
            if field == 'industries':
                values[field] = [item.industry_id for item in assignments]
            elif field == 'primary_industry':
                values[field] = primary_assignment.industry_id if primary_assignment else None
            elif field in {
                'logo_pending',
                'cover_pending',
                'gallery_pending',
                'gallery_additions',
                'gallery_deletions',
            }:
                values[field] = False if field.endswith('_pending') else []
            elif field == 'benefits':
                values[field] = self._published_lists(
                    obj, 'published_benefits', _published_benefits
                )
            elif field == 'offices':
                values[field] = self._published_lists(obj, 'published_offices', _published_offices)
            elif hasattr(company, field):
                values[field] = getattr(company, field)
        return values

    def get_industry_labels(self, obj) -> dict[str, str]:
        industry_ids = {item.industry_id for item in obj.company.company_industries.all()}
        industry_ids.update(obj.changes.get('industries') or [])
        if obj.changes.get('primary_industry'):
            industry_ids.add(obj.changes['primary_industry'])
        labels = self.context.get('industry_labels', {})
        return {
            str(industry_id): labels.get(industry_id, str(industry_id))
            for industry_id in industry_ids
        }

    def get_media_previews(self, obj) -> dict:
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

    def _labels(self, key, loader):
        """Catalogue names loaded once per response, and only when a row needs them."""
        labels = self.context.get(key)
        if labels is None:
            labels = self.context[key] = dict(loader())
        return labels

    def _published_lists(self, obj, key, load):
        """Published benefits or offices of every company on the page, in one query.

        Loaded only when a row proposes that list, so a queue without page
        content costs nothing extra and a queue with it stays flat.
        """
        rows = self.context.get(key)
        if rows is None or obj.company_id not in rows:
            page = getattr(self.parent, 'instance', None) or [obj]
            company_ids = {row.company_id for row in page} | {obj.company_id}
            rows = self.context[key] = {company_id: [] for company_id in company_ids}
            rows.update(load(company_ids))
        return rows[obj.company_id]

    def get_previews(self, obj) -> dict:
        """Proposed benefits and offices with names an admin can read."""
        changes = obj.changes or {}
        previews = {}
        if 'benefits' in changes:
            names = self._labels(
                'benefit_labels', lambda: Benefit.objects.values_list('id', 'name')
            )
            previews['benefits'] = _benefit_previews(changes['benefits'], names)
        if 'offices' in changes:
            provinces = self._labels(
                'province_labels',
                lambda: Location.objects.filter(level=Location.Level.PROVINCE).values_list(
                    'id', 'name'
                ),
            )
            previews['offices'] = _office_previews(changes['offices'], provinces)
        return previews

    def get_tax_lookup_evidence(self, obj) -> dict | None:
        evidence = latest_revision_tax_evidence(obj)
        if evidence is None:
            return None
        return AdminTaxLookupEvidenceSerializer(evidence, context=self.context).data


class AdminCompanyUpdateReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=[
            CompanyUpdateRequest.Status.APPROVED,
            CompanyUpdateRequest.Status.CHANGES_REQUESTED,
            CompanyUpdateRequest.Status.REJECTED,
        ]
    )
    note = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    lock_version = serializers.IntegerField(min_value=0)
    revision_public_id = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if (
            attrs['decision']
            in {
                CompanyUpdateRequest.Status.CHANGES_REQUESTED,
                CompanyUpdateRequest.Status.REJECTED,
            }
            and not attrs.get('note', '').strip()
        ):
            raise serializers.ValidationError(
                {'note': _('Nhập lý do khi yêu cầu chỉnh sửa hoặc từ chối.')}
            )
        return attrs


class AdminCompanyUpdateStartReviewSerializer(serializers.Serializer):
    lock_version = serializers.IntegerField(min_value=0)
    revision_public_id = serializers.CharField(required=False, allow_blank=True)
