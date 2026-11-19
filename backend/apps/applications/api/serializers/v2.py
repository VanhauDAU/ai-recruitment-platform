"""V2 application contracts for candidate submission and recruiter snapshot reads."""

from django.urls import reverse
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.cvs.api.serializers import CvVersionSerializer
from apps.cvs.models import CvVersion, UserCv
from apps.cvs.services import application_readiness_issues, is_unsaved_builder_baseline
from apps.jobs.models import Job
from apps.jobs.selectors import publicly_available_job_filter
from apps.locations.models import Location
from common.storage.media import media_url_from_value

from ...models import Application
from ...services import candidate_reminder_available_at, reapplication_error


class RecruiterApplicationSnapshotSerializer(serializers.ModelSerializer):
    application_public_id = serializers.CharField(source='public_id', read_only=True)
    job_public_id = serializers.CharField(source='job.public_id', read_only=True)
    cv = serializers.SerializerMethodField()
    preferred_location_names = serializers.SerializerMethodField()

    def get_preferred_location_names(self, obj) -> list[str]:
        return [location.name for location in obj.preferred_locations.all()]

    @extend_schema_field(CvVersionSerializer)
    def get_cv(self, obj):
        request = self.context.get('request')
        subject = request.user.public_id if request is not None else ''
        return CvVersionSerializer(
            obj.submitted_cv_version,
            context={
                'request': request,
                'asset_token_context': {
                    'audience': 'recruiter_application',
                    'subject': subject,
                    'resource': obj.public_id,
                },
            },
        ).data

    class Meta:
        model = Application
        fields = [
            'application_public_id',
            'job_public_id',
            'status',
            'applied_at',
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


class RecruiterCvExportSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    status = serializers.CharField()
    download_url = serializers.SerializerMethodField()
    queued_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)
    failed_at = serializers.DateTimeField(allow_null=True)

    def get_download_url(self, obj) -> str | None:
        if not self.context.get('download_ready'):
            return None
        url = reverse(
            'recruiter-application-cv-export-download-v2',
            args=[self.context['application_public_id'], obj.public_id],
        )
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url


def validated_cv_selection(candidate, attrs):
    """The candidate's own CV and immutable version, ready to submit."""
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
    if is_unsaved_builder_baseline(cv, version):
        raise serializers.ValidationError(
            {'cv_public_id': 'CV chưa được lưu lần nào. Hãy mở CV và bấm Lưu trước khi nộp.'}
        )
    if cv.processing_status in {
        UserCv.ProcessingStatus.QUEUED,
        UserCv.ProcessingStatus.PROCESSING,
    }:
        raise serializers.ValidationError(
            {'cv_public_id': 'CV đang được phân tích, vui lòng chờ trong giây lát.'}
        )
    if issues := application_readiness_issues(cv, version):
        raise serializers.ValidationError(
            {
                'cv_public_id': (
                    f'CV chưa đủ thông tin để ứng tuyển: thiếu {", ".join(issues)}. '
                    'Hãy cập nhật CV trước khi nộp.'
                )
            }
        )
    return cv, version


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
    # Signed reference from a campaign channel link; invalid values count as organic.
    campaign_ref = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate(self, attrs):
        candidate = self.context['request'].user
        try:
            job = Job.objects.get(
                publicly_available_job_filter(),
                public_id=attrs['job_public_id'],
            )
        except Job.DoesNotExist as error:
            raise serializers.ValidationError(
                {'job_public_id': 'This job is unavailable.'}
            ) from error
        cv, version = validated_cv_selection(candidate, attrs)
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
        if cv.cv_type == UserCv.CvType.UPLOADED:
            # The file is sent as is, so these fields are the only contact
            # details the recruiter gets in structured form.
            missing = {
                field: 'Vui lòng nhập thông tin này để nhà tuyển dụng liên hệ.'
                for field in ('contact_name', 'contact_email', 'contact_phone')
                if not attrs[field]
            }
            if missing:
                raise serializers.ValidationError(missing)
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
    # When the employer stopped recruiting (closed or past its dates); null while open.
    job_stopped_at = serializers.DateTimeField(source='job.stopped_at', read_only=True)
    cv_public_id = serializers.SerializerMethodField()
    submitted_cv_version_public_id = serializers.CharField(
        source='submitted_cv_version.public_id', read_only=True
    )
    preferred_location_ids = serializers.SerializerMethodField()
    preferred_location_names = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    candidate_status = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    CANDIDATE_STATUS = {
        Application.Status.SUBMITTED: 'Đã nộp hồ sơ',
        Application.Status.VIEWED: 'Nhà tuyển dụng đã xem hồ sơ',
        Application.Status.SHORTLISTED: 'Hồ sơ phù hợp',
        Application.Status.INTERVIEWED: 'Mời phỏng vấn',
        Application.Status.ACCEPTED: 'Trúng tuyển',
        Application.Status.REJECTED: 'Chưa phù hợp',
        Application.Status.WITHDRAWN: 'Bạn đã rút hồ sơ',
    }

    def get_company_logo_url(self, obj) -> str | None:
        return media_url_from_value(obj.job.company.logo_url, request=self.context.get('request'))

    def get_cv_public_id(self, obj) -> str | None:
        return obj.cv.public_id if obj.cv_id else None

    def get_preferred_location_ids(self, obj) -> list[int]:
        return [location.pk for location in obj.preferred_locations.all()]

    def get_preferred_location_names(self, obj) -> list[str]:
        return [location.name for location in obj.preferred_locations.all()]

    def get_status(self, obj) -> str:
        """The status the candidate has been told, not the live one: a decision
        stays private during the recruiter's undo window (the history prefetch
        only holds published rows)."""
        return obj.candidate_visible_status(obj.status_history.all())

    def get_candidate_status(self, obj) -> str:
        return self.CANDIDATE_STATUS[self.get_status(obj)]

    @extend_schema_field(
        {
            'type': 'object',
            'properties': {
                'withdraw': {'type': 'boolean'},
                'reapply': {'type': 'boolean'},
                'remind': {'type': 'boolean'},
                'remind_available_at': {'type': 'string', 'format': 'date-time', 'nullable': True},
            },
        }
    )
    def get_actions(self, obj):
        """What the candidate may do with this submission now (cap and cooldown
        of a resubmission are checked when it is sent)."""
        # Everything reads the status the candidate was told, so no button
        # reveals a decision still inside its undo window. Withdrawing stays
        # possible after the job stopped (an interview may still be running).
        visible = self.get_status(obj)
        recruiting = obj.job.stopped_at is None
        remind_at = candidate_reminder_available_at(obj, visible_status=visible)
        return {
            'withdraw': obj.is_current and visible not in Application.TERMINAL_STATUSES,
            'reapply': obj.is_current
            and recruiting
            and visible in Application.REAPPLY_ALLOWED_STATUSES,
            'remind': bool(remind_at and remind_at <= timezone.now()),
            'remind_available_at': remind_at,
        }

    def get_timeline(self, obj) -> list[dict]:
        """Mốc mới nhất đứng đầu — trang 'Việc làm đã ứng tuyển' đọc từ trên xuống theo thời gian lùi.

        Mỗi lần ProCV nhắc nhà tuyển dụng cũng là một mốc của hồ sơ.
        """
        statuses = [
            {
                'status': item.to_status,
                'label': self.CANDIDATE_STATUS.get(item.to_status, item.to_status),
                'occurred_at': item.created_at,
            }
            for item in obj.status_history.all()
        ]
        reminders = [
            {
                'status': 'reminder',
                'label': 'ProCV đã nhắc nhà tuyển dụng phản hồi CV của bạn',
                'occurred_at': item.created_at,
            }
            for item in obj.reminders.all()
        ]
        return sorted(statuses + reminders, key=lambda item: item['occurred_at'], reverse=True)

    class Meta:
        model = Application
        fields = [
            'public_id',
            'job_public_id',
            'job_title',
            'job_slug',
            'company_name',
            'company_logo_url',
            'job_stopped_at',
            'cv_public_id',
            'submitted_cv_version_public_id',
            'submitted_cv_title',
            'submitted_cv_source',
            'cover_letter',
            'status',
            'candidate_status',
            'timeline',
            'is_current',
            'withdrawn_at',
            'actions',
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
