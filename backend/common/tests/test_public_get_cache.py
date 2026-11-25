"""Cache ngắn cho GET công khai (common.api.caching)."""

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings
from rest_framework.response import Response
from rest_framework.views import APIView

from common.api.caching import cache_public_get


@cache_public_get(30, query_params=('level',))
class CountingView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = []
    calls = 0

    def get(self, request):
        type(self).calls += 1
        if request.query_params.get('level') == 'bad':
            return Response({'detail': 'bad'}, status=400)
        return Response({'level': request.query_params.get('level'), 'call': type(self).calls})


@cache_public_get(30)
class PlainView:
    calls = 0

    def get(self, request):
        type(self).calls += 1
        return HttpResponse(f'call {type(self).calls}')


class CachePublicGetTests(SimpleTestCase):
    def setUp(self):
        CountingView.calls = PlainView.calls = 0
        self.factory = RequestFactory()
        self.view = CountingView.as_view()

    def get(self, query='', **extra):
        response = self.view(self.factory.get(f'/api/public/x/{query}', **extra))
        response.render()
        return response

    @override_settings(ALLOWED_HOSTS=['testserver', 'other.test'])
    def test_listed_params_split_the_cache_and_unknown_params_do_not(self):
        first = self.get('?level=province')
        self.assertEqual(first.data, {'level': 'province', 'call': 1})
        self.assertEqual(first['Cache-Control'], 'public, max-age=30')

        self.assertEqual(self.get('?level=province&junk=1').content, first.content)
        self.assertEqual(self.get('?level=ward').data['call'], 2)
        self.assertEqual(self.get('?level=ward', HTTP_HOST='other.test').data['call'], 3)
        self.assertEqual(CountingView.calls, 3)

    def test_errors_are_never_cached(self):
        self.assertEqual(self.get('?level=bad').status_code, 400)
        self.assertEqual(self.get('?level=bad').status_code, 400)
        self.assertEqual(CountingView.calls, 2)

    def test_plain_django_responses_are_cached_too(self):
        view = PlainView()
        request = self.factory.get('/sitemaps/x.xml')
        self.assertEqual(view.get(request).content, b'call 1')
        self.assertEqual(view.get(request).content, b'call 1')
