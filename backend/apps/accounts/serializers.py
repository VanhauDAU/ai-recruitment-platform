from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .captcha import verify_recaptcha
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(choices=[User.Role.CANDIDATE, User.Role.EMPLOYER])
    captcha_token = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'role', 'full_name', 'captcha_token']
        extra_kwargs = {'full_name': {'required': False}}

    def validate(self, attrs):
        request = self.context.get('request')
        remote_ip = request.META.get('REMOTE_ADDR') if request else None
        verify_recaptcha(attrs.get('captcha_token'), 'register', remote_ip)
        return attrs

    def create(self, validated_data):
        validated_data.pop('captcha_token', None)
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'public_id', 'email', 'role', 'full_name', 'status', 'date_joined']
        read_only_fields = fields


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role/email claims to the JWT so the frontend can route by role
    without an extra profile lookup."""

    captcha_token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context.get('request')
        remote_ip = request.META.get('REMOTE_ADDR') if request else None
        verify_recaptcha(attrs.get('captcha_token'), 'login', remote_ip)
        attrs.pop('captcha_token', None)
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        return token
