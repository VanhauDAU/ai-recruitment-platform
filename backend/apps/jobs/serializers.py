from rest_framework import serializers

from apps.locations.models import Location

from .models import Job, JobCategory, JobSkill


class JobCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCategory
        fields = ['id', 'name', 'slug', 'description', 'parent']


class JobSkillSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = JobSkill
        fields = ['id', 'skill', 'skill_name', 'importance', 'weight', 'min_level', 'min_years_experience']


class LocationBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'level']


class JobSerializer(serializers.ModelSerializer):
    job_skills = JobSkillSerializer(many=True, required=False)
    company_name = serializers.CharField(source='employer_profile.company_name', read_only=True)
    # write: list of location ids; read: expanded objects.
    locations = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Location.objects.all(),
    )
    locations_detail = LocationBriefSerializer(source='locations', many=True, read_only=True)

    class Meta:
        model = Job
        fields = [
            'public_id', 'slug', 'title', 'company_name', 'category',
            'locations', 'locations_detail', 'short_description', 'description',
            'responsibilities', 'requirements', 'nice_to_have', 'benefits', 'address',
            'work_type', 'employment_type', 'experience_level', 'education_level',
            'number_of_vacancies', 'salary_min', 'salary_max', 'currency',
            'is_salary_visible', 'deadline', 'status', 'view_count',
            'application_count', 'job_skills', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'public_id', 'slug', 'company_name', 'status',
            'view_count', 'application_count', 'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        job_skills_data = validated_data.pop('job_skills', [])
        locations = validated_data.pop('locations', [])
        job = Job.objects.create(**validated_data)
        job.locations.set(locations)
        self._sync_job_skills(job, job_skills_data)
        return job

    def update(self, instance, validated_data):
        job_skills_data = validated_data.pop('job_skills', None)
        locations = validated_data.pop('locations', None)
        job = super().update(instance, validated_data)
        if locations is not None:
            job.locations.set(locations)
        if job_skills_data is not None:
            job.job_skills.all().delete()
            self._sync_job_skills(job, job_skills_data)
        return job

    def _sync_job_skills(self, job, job_skills_data):
        JobSkill.objects.bulk_create([JobSkill(job=job, **item) for item in job_skills_data])
