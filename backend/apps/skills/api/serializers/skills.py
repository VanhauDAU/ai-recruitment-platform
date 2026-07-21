from rest_framework import serializers

from ...models import Skill, SkillGroup


class SkillGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillGroup
        fields = ['id', 'name', 'slug', 'parent']


class SkillSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True, default='')

    class Meta:
        model = Skill
        fields = ['id', 'name', 'slug', 'aliases', 'group', 'group_name']
