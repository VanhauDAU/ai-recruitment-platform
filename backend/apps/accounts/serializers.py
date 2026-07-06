from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=[User.Role.CANDIDATE, User.Role.EMPLOYER])

    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'role', 'full_name']
        extra_kwargs = {'full_name': {'required': False}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'public_id', 'email', 'role', 'full_name', 'status', 'date_joined']
        read_only_fields = fields


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role/email claims to the JWT so the frontend can route by role
    without an extra profile lookup."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        return token
