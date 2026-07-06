from rest_framework import serializers

from .models import CandidateProfile


class CandidateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateProfile
        fields = [
            'id', 'date_of_birth', 'gender', 'address', 'current_position',
            'desired_position', 'experience_years', 'education_level',
            'expected_salary_min', 'expected_salary_max', 'preferred_location',
            'preferred_work_type', 'job_search_status', 'portfolio_url',
            'github_url', 'linkedin_url', 'headline', 'bio', 'career_objective',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
