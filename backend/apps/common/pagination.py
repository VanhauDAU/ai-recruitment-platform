from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Default pagination that lets clients request a custom page size — e.g. the
    12-per-page homepage "Việc làm tốt nhất" grid — while capping the maximum."""

    page_size_query_param = 'page_size'
    max_page_size = 60
