"""The mutable autosave draft: read/write, template switch/preview and sample content.

Every write carries ``If-Match: "lock-version-N"`` so two editor sessions cannot
silently overwrite each other; a stale lock answers 409 with the current version.
"""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, inline_serializer
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cv_templates.selectors import preview_template
from apps.cv_templates.services import CvCompositionError, compose_cv_document
from apps.cvs.api.serializers import (
    CvApplySampleSerializer,
    CvDraftSerializer,
    CvDraftWriteSerializer,
    CvSerializer,
    CvTemplateSwitchSerializer,
)
from apps.cvs.selectors import cv_draft
from apps.cvs.services import (
    CvLifecyclePolicyError,
    StaleDraftError,
    apply_sample_to_draft,
    switch_draft_template,
    update_draft,
)

from .base import (
    CandidateCvMixin,
    draft_conflict_response,
    draft_headers,
    expected_lock_version,
    validation_detail,
)


class CvDraftView(CandidateCvMixin, APIView):
    @extend_schema(
        summary='Đọc bản nháp đang soạn', responses={200: CvDraftSerializer}, tags=['cvs']
    )
    def get(self, request, public_id):
        draft = cv_draft(self.get_cv())
        if draft is None:
            raise Http404
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers=draft_headers(draft),
        )

    @extend_schema(
        summary='Lưu bản nháp (autosave, cần header If-Match: "lock-version-N")',
        request=CvDraftWriteSerializer,
        responses={200: CvDraftSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs'],
    )
    def put(self, request, public_id):
        cv = self.get_cv()
        serializer = CvDraftWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            draft = update_draft(
                cv=cv,
                actor=request.user,
                content_json=serializer.validated_data['content_json'],
                layout_json=serializer.validated_data['layout_json'],
                style_json=serializer.validated_data['style_json'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except CvLifecyclePolicyError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers=draft_headers(draft),
        )


class CvTemplateSwitchView(CandidateCvMixin, APIView):
    """Switch presentation contract while keeping the canonical content immutable."""

    @extend_schema(
        summary='Đổi mẫu CV, giữ nguyên nội dung canonical',
        request=CvTemplateSwitchSerializer,
        responses={
            200: inline_serializer(
                'CvTemplateSwitched',
                {
                    'cv': CvSerializer(),
                    'draft': CvDraftSerializer(),
                },
            ),
            409: OpenApiTypes.OBJECT,
        },
        tags=['cvs'],
    )
    def put(self, request, public_id):
        cv = self.get_cv()
        serializer = CvTemplateSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            switched_cv, draft = switch_draft_template(
                cv=cv,
                actor=request.user,
                template_public_id=serializer.validated_data['template_public_id'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
                theme_color=serializer.validated_data.get('theme_color'),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except (CvLifecyclePolicyError, DjangoValidationError) as error:
            raise ValidationError(validation_detail(error)) from error
        return Response(
            {
                'cv': CvSerializer(switched_cv).data,
                'draft': CvDraftSerializer(draft, context={'request': request}).data,
            },
            headers=draft_headers(draft),
        )


class CvTemplatePreviewView(CandidateCvMixin, APIView):
    """Project one owned draft onto a template without mutating either aggregate."""

    @extend_schema(
        summary='Xem trước bản nháp trên một mẫu khác (không ghi dữ liệu)',
        parameters=[
            OpenApiParameter('template_public_id', str, required=True),
            OpenApiParameter('theme_color', str, description='Hex 6 ký tự, ví dụ #1A73E8'),
        ],
        responses={200: OpenApiTypes.OBJECT},
        tags=['cvs'],
    )
    def get(self, request, public_id):
        cv = self.get_cv()
        template_public_id = request.query_params.get('template_public_id', '').strip()
        theme_color = request.query_params.get('theme_color', '').strip().upper()
        if not template_public_id:
            raise ValidationError({'template_public_id': 'This query parameter is required.'})
        if theme_color and re.fullmatch(r'#[0-9A-F]{6}', theme_color) is None:
            raise ValidationError({'theme_color': 'Use a six-digit hex color.'})
        template = preview_template(template_public_id)
        if template is None:
            raise Http404
        if theme_color and not template.offers_color(theme_color):
            raise ValidationError({'theme_color': 'Color is not available for this template.'})
        draft = cv_draft(cv)
        if draft is None:
            raise Http404
        try:
            document = compose_cv_document(
                template=template,
                content_json=draft.content_json,
                theme_color=theme_color or None,
            )
        except (CvCompositionError, DjangoValidationError) as error:
            raise ValidationError({'template_public_id': str(error)}) from error
        version = template.current_published_version
        return Response(
            {
                'document': document,
                'renderer': {
                    'key': version.renderer_key,
                    'version': version.renderer_version,
                    'schema_version': version.schema_version,
                    'capabilities': version.capabilities,
                },
                'source_cv_public_id': cv.public_id,
                'lock_version': draft.lock_version,
                'assets': CvDraftSerializer(draft, context={'request': request}).data['assets'],
            }
        )


class CvApplySampleView(CandidateCvMixin, APIView):
    @extend_schema(
        summary='Áp nội dung mẫu vào bản nháp',
        request=CvApplySampleSerializer,
        responses={200: CvDraftSerializer, 409: OpenApiTypes.OBJECT},
        tags=['cvs'],
    )
    def post(self, request, public_id):
        cv = self.get_cv()
        serializer = CvApplySampleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            draft = apply_sample_to_draft(
                cv=cv,
                actor=request.user,
                sample_public_id=serializer.validated_data['sample_content_public_id'],
                expected_lock_version=expected_lock_version(request),
                client_session_id=serializer.validated_data.get('client_session_id', ''),
            )
        except StaleDraftError:
            return draft_conflict_response(cv)
        except (CvLifecyclePolicyError, DjangoValidationError) as error:
            raise ValidationError(validation_detail(error)) from error
        return Response(
            CvDraftSerializer(draft, context={'request': request}).data,
            headers=draft_headers(draft),
        )
