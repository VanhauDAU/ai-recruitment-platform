"""V2 application contracts for candidate submission and recruiter snapshot reads."""

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from apps.cvs.api.serializers.v2 import CvVersionSerializer
from apps.cvs.models import CvVersion, UserCv
from apps.jobs.models import Job
from apps.locations.models import Location
from common.media_storage import media_url_from_value

from ...models import Application
from ...services import reapplication_error


class RecruiterApplicationSnapshotSerializer(serializers.ModelSerializer):
    application_public_id = serializers.CharField(source='public_id', read_only=True)
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    cv = CvVersionSerializer(source='submitted_cv_version', read_only=True)
    preferred_location_names = serializers.SerializerMethodField()

    def get_preferred_location_names(self, obj):
        return [location.name for location in obj.preferred_locations.all()]

    class Meta:
        model = Application
        fields = [
            'application_public_id',
            'job_public_id',
            'status',
            'submitted_at',
            'submitted_cv_title',
            'submitted_cv_source',
            'cv',
            'preferred_location_names',
            'allow_ai_analysis',
            'contact_name',
            'contact_email',
            'contact_phone',
        ]
        read_only_fields = fields


class CandidateApplicationV2CreateSerializer(serializers.Serializer):
    job_public_id = serializers.CharField(max_length=50)
    cv_public_id = serializers.CharField(max_length=50)
    version_public_id = serializers.CharField(max_length=50)
    cover_letter = serializers.CharField(required=False, allow_blank=True, max_length=10000)
    preferred_location_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
    preferred_location_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    allow_ai_analysis = serializers.BooleanField(required=False, default=False)
    data_processing_consent = serializers.BooleanField()
    contact_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate(self, attrs):
        candidate = self.context['request'].user
        try:
            job = Job.objects.get(
                Q(public_id=attrs['job_public_id']),
                Q(status=Job.Status.ACTIVE),
                Q(deadline__isnull=True) | Q(deadline__gte=timezone.localdate()),
            )
        except Job.DoesNotExist as error:
            raise serializers.ValidationError(
                {'job_public_id': 'This job is unavailable.'}
            ) from error
        try:
            cv = UserCv.objects.get(
                public_id=attrs['cv_public_id'],
                user=candidate,
                is_deleted=False,
            )
        except UserCv.DoesNotExist as error:
            raise serializers.ValidationError(
                {'cv_public_id': 'Select one of your active CVs.'}
            ) from error
        try:
            version = CvVersion.objects.get(
                public_id=attrs['version_public_id'],
                cv=cv,
            )
        except CvVersion.DoesNotExist as error:
            raise serializers.ValidationError(
                {'version_public_id': 'Select an immutable version of this CV.'}
            ) from error
        if version.version_kind == CvVersion.VersionKind.APPLICATION_SNAPSHOT:
            raise serializers.ValidationError(
                {'version_public_id': 'Application snapshots cannot be submitted again.'}
            )
        application_error = reapplication_error(candidate, job)
        if application_error:
            raise serializers.ValidationError({'job_public_id': application_error})
        province_ids = {
            item.location.parent_id or item.location_id
            for item in job.job_locations.select_related('location__parent').all()
        }
        selected_ids = list(dict.fromkeys(attrs.pop('preferred_location_ids', [])))
        legacy_id = attrs.pop('preferred_location_id', None)
        if legacy_id is not None and not selected_ids:
            selected_ids = [legacy_id]
        if province_ids and not selected_ids:
            raise serializers.ValidationError(
                {
                    'preferred_location_ids': 'Select at least one preferred workplace.',
                }
            )
        if any(location_id not in province_ids for location_id in selected_ids):
            raise serializers.ValidationError(
                {
                    'preferred_location_ids': 'Select only workplaces offered by this job.',
                }
            )
        if attrs.get('data_processing_consent') is not True:
            raise serializers.ValidationError(
                {
                    'data_processing_consent': 'Consent is required before submitting an application.',
                }
            )
        attrs['preferred_locations'] = list(
            Location.objects.filter(pk__in=selected_ids).order_by('pk'),
        )
        attrs['contact_name'] = attrs.get('contact_name', '').strip() or candidate.full_name
        attrs['contact_email'] = attrs.get('contact_email', '').strip() or candidate.email
        attrs['contact_phone'] = attrs.get('contact_phone', '').strip() or candidate.phone
        attrs['job'] = job
        attrs['cv'] = cv
        attrs['version'] = version
        return attrs


class CandidateApplicationV2Serializer(serializers.ModelSerializer):
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    job_slug = serializers.CharField(source='job.slug', read_only=True)
    company_name = serializers.CharField(source='job.company.company_name', read_only=True)
    company_logo_url = serializers.SerializerMethodField()
    cv_public_id = serializers.SerializerMethodField()
    submitted_cv_version_public_id = serializers.CharField(
        source='submitted_cv_version.public_id', read_only=True
    )
    preferred_location_ids = serializers.SerializerMethodField()
    preferred_location_names = serializers.SerializerMethodField()
    candidate_status = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()

    CANDIDATE_STATUS = {
        Application.Status.SUBMITTED: 'Tiếp nhận',
        Application.Status.VIEWED: 'Nhà tuyển dụng đã xem hồ sơ',
        Application.Status.CONSIDERING: 'Hồ sơ đang được xem xét',
        Application.Status.SHORTLISTED: 'Hồ sơ đang được xem xét',
        Application.Status.INTERVIEWED: 'Phỏng vấn',
        Application.Status.ACCEPTED: 'Đã nhận offer',
        Application.Status.REJECTED: 'Chưa phù hợp',
    }

    def get_company_logo_url(self, obj):
        return media_url_from_value(obj.job.company.logo_url, request=self.context.get('request'))

    def get_cv_public_id(self, obj):
        return obj.cv.public_id if obj.cv_id else None

    def get_preferred_location_ids(self, obj):
        return [location.pk for location in obj.preferred_locations.all()]

    def get_preferred_location_names(self, obj):
        return [location.name for location in obj.preferred_locations.all()]

    def get_candidate_status(self, obj):
        return self.CANDIDATE_STATUS[obj.status]

    def get_timeline(self, obj):
        """Mốc mới nhất đứng đầu — trang 'Việc làm đã ứng tuyển' đọc từ trên xuống theo thời gian lùi."""
        return [
            {
                'status': item.to_status,
                'label': self.CANDIDATE_STATUS.get(item.to_status, item.to_status),
                'occurred_at': item.created_at,
            }
            for item in reversed(list(obj.status_history.all()))
        ]

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job_public_id',
            'job_title',
            'job_slug',
            'company_name',
            'company_logo_url',
            'cv_public_id',
            'submitted_cv_version_public_id',
            'submitted_cv_title',
            'submitted_cv_source',
            'submitted_at',
            'cover_letter',
            'status',
            'candidate_status',
            'timeline',
            'preferred_location_ids',
            'preferred_location_names',
            'allow_ai_analysis',
            'data_processing_consent',
            'contact_name',
            'contact_email',
            'contact_phone',
            'applied_at',
            'updated_at',
        ]
        read_only_fields = fields
