"""Admin endpoints for knowledgebase categories."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.api.permissions import AdminPortalPermission

from ...selectors import (
    admin_categories_queryset,
)
from ...services import (
    create_category,
    reorder_categories,
    set_category_active,
    update_category,
)
from ..serializers import (
    AdminCategorySerializer,
    CategoryWriteSerializer,
    ReorderSerializer,
    TokenActionSerializer,
)
from .admin_shared import (
    ERROR_RESPONSES,
    PrivateNoStoreMixin,
    category_or_404,
    category_response,
)


@extend_schema(tags=['knowledgebase-admin'])
class AdminCategoryListCreateView(PrivateNoStoreMixin, generics.ListAPIView):
    permission_classes = [AdminPortalPermission]
    pagination_class = None
    serializer_class = AdminCategorySerializer
    queryset = admin_categories_queryset()

    @extend_schema(
        request=CategoryWriteSerializer, responses={201: AdminCategorySerializer, **ERROR_RESPONSES}
    )
    def post(self, request):
        serializer = CategoryWriteSerializer(data=request.data, context={'creating': True})
        serializer.is_valid(raise_exception=True)
        category = create_category(actor=request.user, **serializer.validated_data)
        return category_response(request, category, response_status=status.HTTP_201_CREATED)


@extend_schema(tags=['knowledgebase-admin'])
class AdminCategoryDetailView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(responses={200: AdminCategorySerializer, **ERROR_RESPONSES})
    def get(self, request, public_id):
        return category_response(request, category_or_404(public_id))

    @extend_schema(
        request=CategoryWriteSerializer, responses={200: AdminCategorySerializer, **ERROR_RESPONSES}
    )
    def patch(self, request, public_id):
        serializer = CategoryWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        expected = data.pop('revision_token')
        result = update_category(
            category=category_or_404(public_id),
            actor=request.user,
            expected_revision_token=expected,
            **data,
        )
        return category_response(request, result)


class AdminCategoryReorderView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]

    @extend_schema(
        request=ReorderSerializer,
        responses={200: AdminCategorySerializer(many=True), **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reorder_categories(
            categories=list(admin_categories_queryset()),
            ordered_public_ids=serializer.validated_data['public_ids'],
            actor=request.user,
        )
        return Response(AdminCategorySerializer(admin_categories_queryset(), many=True).data)


class AdminCategoryLifecycleView(PrivateNoStoreMixin, APIView):
    permission_classes = [AdminPortalPermission]
    is_active = None

    @extend_schema(
        request=TokenActionSerializer,
        responses={200: AdminCategorySerializer, **ERROR_RESPONSES},
        tags=['knowledgebase-admin'],
    )
    def post(self, request, public_id):
        serializer = TokenActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = set_category_active(
            category=category_or_404(public_id),
            actor=request.user,
            is_active=self.is_active,
            expected_revision_token=serializer.validated_data['revision_token'],
        )
        return category_response(request, result)


class AdminCategoryActivateView(AdminCategoryLifecycleView):
    is_active = True


class AdminCategoryDeactivateView(AdminCategoryLifecycleView):
    is_active = False
