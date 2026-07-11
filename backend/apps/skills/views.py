from rest_framework import generics, permissions

from .models import Skill, SkillGroup
from .serializers import SkillGroupSerializer, SkillSerializer


class SkillGroupListView(generics.ListAPIView):
    serializer_class = SkillGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = SkillGroup.objects.filter(is_active=True).select_related('parent')


class SkillListView(generics.ListAPIView):
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        queryset = Skill.objects.filter(is_active=True).select_related('group')
        if group := self.request.query_params.get('group'):
            queryset = queryset.filter(group_id=group)
        if search := self.request.query_params.get('search'):
            queryset = queryset.filter(name__icontains=search)
        return queryset[:100]
