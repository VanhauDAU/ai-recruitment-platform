from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.accounts.permissions import IsEmployer

from ...selectors import active_skill_groups_queryset, skill_lookup_queryset
from ...services import create_skill
from ..serializers import SkillCreateSerializer, SkillGroupSerializer, SkillSerializer


class SkillGroupListView(generics.ListAPIView):
    serializer_class = SkillGroupSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    queryset = active_skill_groups_queryset()


class SkillListView(generics.ListCreateAPIView):
    serializer_class = SkillSerializer
    pagination_class = None

    def get_permissions(self):
        permission_class = IsEmployer if self.request.method == 'POST' else permissions.AllowAny
        return [permission_class()]

    def get_queryset(self):
        return skill_lookup_queryset(self.request.query_params)

    def create(self, request, *args, **kwargs):
        input_serializer = SkillCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        skill, created = create_skill(input_serializer.validated_data['name'])
        return Response(
            SkillSerializer(skill).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
