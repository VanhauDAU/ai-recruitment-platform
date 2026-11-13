from rest_framework.routers import DefaultRouter

from .api.views.admin import AdminUserCvViewSet

router = DefaultRouter()
router.register('admin/user-cvs', AdminUserCvViewSet, basename='admin-user-cv')

urlpatterns = router.urls
