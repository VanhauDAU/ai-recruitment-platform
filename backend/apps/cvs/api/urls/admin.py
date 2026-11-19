from rest_framework.routers import SimpleRouter

from ..views.admin import AdminUserCvViewSet

router = SimpleRouter()
router.register('user-cvs', AdminUserCvViewSet, basename='admin-user-cv')

urlpatterns = router.urls
