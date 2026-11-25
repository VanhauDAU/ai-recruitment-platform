from rest_framework.routers import SimpleRouter

from apps.privacy.api.views.data_requests import AdminDataRequestViewSet

router = SimpleRouter()
router.register('requests', AdminDataRequestViewSet, basename='admin-privacy-request')

urlpatterns = router.urls
