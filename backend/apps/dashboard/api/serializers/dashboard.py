from rest_framework import serializers


class VerificationProgressSerializer(serializers.Serializer):
    email_verified = serializers.BooleanField()
    registration_completed = serializers.BooleanField()
    consulting_need_completed = serializers.BooleanField()
    phone_verified = serializers.BooleanField()
    company_linked = serializers.BooleanField()
    business_doc_submitted = serializers.BooleanField()
    business_doc_current = serializers.BooleanField()
    business_doc_approved = serializers.BooleanField()
    email_domain_verified = serializers.BooleanField()
    no_report_history = serializers.BooleanField()
    candidate_dpa_submitted = serializers.BooleanField()
    candidate_dpa_approved = serializers.BooleanField()
    dpa_accepted = serializers.BooleanField()
    representative_verified = serializers.BooleanField()
    first_job_posted = serializers.BooleanField()
    account_ready = serializers.BooleanField()
    verification_completed = serializers.BooleanField()
    completed = serializers.BooleanField()


class EmployerDashboardAccountSerializer(serializers.Serializer):
    public_id = serializers.CharField(help_text='Mã tài khoản NTD (8 chữ số).')
    company_public_id = serializers.CharField(allow_null=True)
    company_name = serializers.CharField(allow_blank=True)
    recruiter_verification_status = serializers.CharField()
    company_size = serializers.CharField(allow_blank=True)
    work_location_name = serializers.CharField(allow_blank=True)
    verification = VerificationProgressSerializer()


class EmployerDashboardSummarySerializer(serializers.Serializer):
    jobs_total = serializers.IntegerField()
    jobs_active = serializers.IntegerField()
    jobs_hidden = serializers.IntegerField()
    jobs_draft = serializers.IntegerField()
    job_views = serializers.IntegerField()
    applications_total = serializers.IntegerField()
    applications_new = serializers.IntegerField()
    applications_shortlisted = serializers.IntegerField()
    applications_interviewed = serializers.IntegerField()


class EmployerDashboardFunnelSerializer(serializers.Serializer):
    received = serializers.IntegerField()
    shortlisted = serializers.IntegerField()
    interviewed = serializers.IntegerField()
    accepted = serializers.IntegerField()
    rejected = serializers.IntegerField()


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


class FlashBadgeCriterionSerializer(serializers.Serializer):
    code = serializers.ChoiceField(
        choices=['enough_applications', 'response_rate', 'recent_activity', 'no_overdue']
    )
    met = serializers.BooleanField()
    # Số (hồ sơ, phần trăm) hoặc thời điểm quyết định gần nhất, tùy tiêu chí.
    value = serializers.JSONField(allow_null=True)
    target = serializers.IntegerField()


class FlashBadgeStateSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    qualified = serializers.BooleanField()
    qualified_since = serializers.DateTimeField(allow_null=True)
    response_rate = serializers.IntegerField(allow_null=True)
    avg_response_hours = serializers.FloatField(allow_null=True)
    criteria = FlashBadgeCriterionSerializer(many=True)
    overdue_count = serializers.IntegerField()
    at_risk_count = serializers.IntegerField()
    response_hours = serializers.IntegerField()
    window_days = serializers.IntegerField()
    computed_at = serializers.DateTimeField(allow_null=True)


class EmployerDashboardSerializer(serializers.Serializer):
    account = EmployerDashboardAccountSerializer()
    summary = EmployerDashboardSummarySerializer()
    funnel = EmployerDashboardFunnelSerializer()
    application_activity = ApplicationActivitySerializer(many=True)
    recruitment_need = RecruitmentNeedSummarySerializer(allow_null=True)
    flash_badge = FlashBadgeStateSerializer(allow_null=True)
    recent_jobs = RecentJobSerializer(many=True)
    recent_applications = RecentApplicationSerializer(many=True)


class AdminDashboardPeriodSerializer(serializers.Serializer):
    days = serializers.IntegerField()
    start = serializers.DateField()
    end = serializers.DateField()


class AdminDashboardQueueSerializer(serializers.Serializer):
    key = serializers.CharField()
    count = serializers.IntegerField()
    overdue = serializers.IntegerField()
    oldest_at = serializers.DateTimeField(allow_null=True)
    sla_hours = serializers.IntegerField()


class AdminDashboardComparisonSerializer(serializers.Serializer):
    current = serializers.IntegerField()
    previous = serializers.IntegerField()


class AdminDashboardKpisSerializer(serializers.Serializer):
    candidates = AdminDashboardComparisonSerializer()
    employers = AdminDashboardComparisonSerializer()
    jobs = AdminDashboardComparisonSerializer()
    applications = AdminDashboardComparisonSerializer()


class AdminDashboardActivitySerializer(serializers.Serializer):
    date = serializers.DateField()
    candidates = serializers.IntegerField()
    employers = serializers.IntegerField()
    jobs = serializers.IntegerField()
    applications = serializers.IntegerField()


class AdminDashboardTotalsSerializer(serializers.Serializer):
    candidates = serializers.IntegerField()
    employers = serializers.IntegerField()
    companies = serializers.IntegerField()
    jobs_active = serializers.IntegerField()


class AdminDashboardJobStatesSerializer(serializers.Serializer):
    draft = serializers.IntegerField()
    active = serializers.IntegerField()
    hidden = serializers.IntegerField()
    expired = serializers.IntegerField()
    closed = serializers.IntegerField()


class AdminDashboardJobsSerializer(serializers.Serializer):
    states = AdminDashboardJobStatesSerializer()
    held = serializers.IntegerField()
    without_applications = serializers.IntegerField()
    expiring_soon = serializers.IntegerField()


class AdminDashboardFunnelSerializer(serializers.Serializer):
    submitted = serializers.IntegerField()
    viewed = serializers.IntegerField()
    shortlisted = serializers.IntegerField()
    interviewed = serializers.IntegerField()
    accepted = serializers.IntegerField()
    rejected = serializers.IntegerField()
    withdrawn = serializers.IntegerField()


class AdminDashboardApplicationsSerializer(serializers.Serializer):
    funnel = AdminDashboardFunnelSerializer()
    avg_first_view_hours = serializers.FloatField(allow_null=True)
    stale_unviewed = serializers.IntegerField()


class AdminDashboardReportStatsSerializer(serializers.Serializer):
    new = serializers.IntegerField()
    upheld = serializers.IntegerField()
    dismissed = serializers.IntegerField()


class AdminDashboardRestrictedSerializer(serializers.Serializer):
    candidates = serializers.IntegerField()
    employers = serializers.IntegerField()


class AdminDashboardTrustSerializer(serializers.Serializer):
    job_reports = AdminDashboardReportStatsSerializer()
    company_reports = AdminDashboardReportStatsSerializer()
    restricted_accounts = AdminDashboardRestrictedSerializer()
    compliance_holds_active = serializers.IntegerField()


class AdminDashboardContentSerializer(serializers.Serializer):
    knowledge_review_overdue = serializers.IntegerField()


class AdminDashboardCategorySerializer(serializers.Serializer):
    public_id = serializers.CharField()
    name = serializers.CharField()
    active_jobs = serializers.IntegerField()
    applications = serializers.IntegerField()


class AdminDashboardMatchSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    succeeded = serializers.IntegerField()
    failed = serializers.IntegerField()


class AdminDashboardGenerationSerializer(serializers.Serializer):
    invocations = serializers.IntegerField()
    failures = serializers.IntegerField()
    total_tokens = serializers.IntegerField()
    cost_usd = serializers.DecimalField(max_digits=18, decimal_places=4, coerce_to_string=False)
    avg_latency_ms = serializers.IntegerField(allow_null=True)


class AdminDashboardAiSerializer(serializers.Serializer):
    match_analyses = AdminDashboardMatchSerializer()
    generation = AdminDashboardGenerationSerializer()


class AdminDashboardSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    period = AdminDashboardPeriodSerializer()
    queues = AdminDashboardQueueSerializer(many=True)
    kpis = AdminDashboardKpisSerializer()
    activity = AdminDashboardActivitySerializer(many=True)
    totals = AdminDashboardTotalsSerializer()
    jobs = AdminDashboardJobsSerializer()
    applications = AdminDashboardApplicationsSerializer()
    trust = AdminDashboardTrustSerializer()
    content = AdminDashboardContentSerializer()
    top_categories = AdminDashboardCategorySerializer(many=True)
    ai = AdminDashboardAiSerializer()


class AdminQueueSummarySerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    queues = AdminDashboardQueueSerializer(many=True)
    knowledge_review_overdue = serializers.IntegerField()
