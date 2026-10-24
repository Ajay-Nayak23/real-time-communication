from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from calls.models import Call
from calls.serializers import CallSerializer


class CallHistoryPagination(PageNumberPagination):
    """
    Page number pagination for call history logs.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CallHistoryListView(generics.ListAPIView):
    """
    List user call history records (audio & video) with participant details,
    duration, and session status.
    GET /api/calls/history/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CallSerializer
    pagination_class = CallHistoryPagination

    def get_queryset(self):
        user = self.request.user
        queryset = Call.objects.filter(
            Q(caller=user) | Q(callee=user)
        ).select_related('caller', 'callee').order_by('-created_at')

        call_type = self.request.query_params.get('call_type')
        if call_type in [Call.CallType.AUDIO, Call.CallType.VIDEO]:
            queryset = queryset.filter(call_type=call_type)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset


class CallDetailView(generics.RetrieveAPIView):
    """
    Retrieve single call record by ID if requesting user was a participant.
    GET /api/calls/<int:pk>/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CallSerializer

    def get_queryset(self):
        user = self.request.user
        return Call.objects.filter(
            Q(caller=user) | Q(callee=user)
        ).select_related('caller', 'callee')
