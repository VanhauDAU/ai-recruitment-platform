from rest_framework import generics, permissions

from ...selectors import active_skill_groups_queryset, skill_lookup_queryset
from ..serializers import SkillGroupSerializer, SkillSerializer


class SkillGroupListView(generics.ListAPIView):
    serializer_class = SkillGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = active_skill_groups_queryset()


class SkillListView(generics.ListAPIView):
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return skill_lookup_queryset(self.request.query_params)
