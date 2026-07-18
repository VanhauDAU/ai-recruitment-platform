from rest_framework import serializers


class VerificationProgressSerializer(serializers.Serializer):
    email_verified = serializers.BooleanField()
    registration_completed = serializers.BooleanField()
    consulting_need_completed = serializers.BooleanField()
    phone_verified = serializers.BooleanField()
    company_linked = serializers.BooleanField()
    membership_approved = serializers.BooleanField()
    business_doc_submitted = serializers.BooleanField()
    business_doc_approved = serializers.BooleanField()
    email_domain_verified = serializers.BooleanField()
    no_report_history = serializers.BooleanField()
    candidate_dpa_submitted = serializers.BooleanField()
    dpa_accepted = serializers.BooleanField()
    first_job_posted = serializers.BooleanField()
    account_ready = serializers.BooleanField()
    completed = serializers.BooleanField()


class EmployerDashboardAccountSerializer(serializers.Serializer):
    recruiter_public_id = serializers.CharField()
    company_public_id = serializers.CharField(allow_null=True)
    company_name = serializers.CharField(allow_blank=True)
    company_verification_status = serializers.CharField()
    company_size = serializers.CharField(allow_blank=True)
    work_location_name = serializers.CharField(allow_blank=True)
    verification = VerificationProgressSerializer()


class EmployerDashboardSummarySerializer(serializers.Serializer):
    jobs_total = serializers.IntegerField()
    jobs_active = serializers.IntegerField()
    jobs_pending = serializers.IntegerField()
    jobs_draft = serializers.IntegerField()
    job_views = serializers.IntegerField()
    applications_total = serializers.IntegerField()
    applications_new = serializers.IntegerField()
    applications_shortlisted = serializers.IntegerField()
    applications_interviewed = serializers.IntegerField()


class ApplicationActivitySerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class RecruitmentNeedSummarySerializer(serializers.Serializer):
    position_category_name = serializers.CharField()
    position_level = serializers.CharField()
    position_level_label = serializers.CharField()
    target_date = serializers.DateField(allow_null=True)
    is_continuous = serializers.BooleanField()
    headcount = serializers.IntegerField()


class RecentJobSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    title = serializers.CharField()
    status = serializers.CharField()
    status_label = serializers.CharField()
    deadline = serializers.DateField(allow_null=True)
    application_count = serializers.IntegerField()
    view_count = serializers.IntegerField()
    published_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()


class RecentApplicationSerializer(serializers.Serializer):
    public_id = serializers.CharField()
    candidate_name = serializers.CharField()
    job_public_id = serializers.CharField()
    job_title = serializers.CharField()
    submitted_cv_title = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    status_label = serializers.CharField()
    applied_at = serializers.DateTimeField()


class EmployerDashboardSerializer(serializers.Serializer):
    account = EmployerDashboardAccountSerializer()
    summary = EmployerDashboardSummarySerializer()
    application_activity = ApplicationActivitySerializer(many=True)
    recruitment_need = RecruitmentNeedSummarySerializer(allow_null=True)
    recent_jobs = RecentJobSerializer(many=True)
    recent_applications = RecentApplicationSerializer(many=True)
