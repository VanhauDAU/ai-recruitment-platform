from rest_framework import serializers

from ...models import Benefit, Language


class BenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Benefit
        fields = ['id', 'name', 'slug', 'icon', 'description', 'category']


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'name', 'code', 'slug']
