from rest_framework.routers import SimpleRouter

from ..views import AdminSkillGroupViewSet, AdminSkillViewSet

router = SimpleRouter()
router.register('groups', AdminSkillGroupViewSet, basename='admin-skill-group')
router.register('', AdminSkillViewSet, basename='admin-skill')

urlpatterns = router.urls
