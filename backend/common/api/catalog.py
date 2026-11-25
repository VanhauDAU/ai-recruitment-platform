"""Khung viewset cho các danh mục nhỏ mà trang quản trị sửa trên một màn hình."""

from rest_framework import mixins, status, viewsets
from rest_framework.response import Response


class CatalogEntryViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Danh sách không phân trang (vài chục mục), thêm và sửa một phần.

    Lớp con khai `permission_classes`, `serializer_class`, `get_queryset` và
    `save_entry(actor=, entry=, **changes)` là service ghi của app (kèm audit).
    """

    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    lookup_value_regex = r'\d+'

    def save_entry(self, *, actor, entry, **changes):
        raise NotImplementedError

    def _save(self, request, entry, response_status):
        serializer = self.get_serializer(
            entry if entry.pk else None, data=request.data, partial=entry.pk is not None
        )
        serializer.is_valid(raise_exception=True)
        saved = self.save_entry(actor=request.user, entry=entry, **serializer.validated_data)
        fresh = self.get_queryset().get(pk=saved.pk)
        return Response(self.get_serializer(fresh).data, status=response_status)

    def create(self, request, *args, **kwargs):
        return self._save(request, self.get_queryset().model(), status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        return self._save(request, self.get_object(), status.HTTP_200_OK)
