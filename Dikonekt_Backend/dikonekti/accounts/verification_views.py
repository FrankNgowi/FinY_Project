"""Doctor certificate verification: the doctor's upload and status, and the admin review."""
import logging

from django.http import FileResponse, Http404
from rest_framework import generics, permissions
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import files
from .models import DoctorVerification, InvalidTransition
from .permissions import IsAdmin, IsDoctor
from .serializers import (
    AdminVerificationSerializer, DocumentUploadSerializer, RejectSerializer,
    VerificationStatusSerializer,
)
from .throttles import VerificationUploadThrottle

Status = DoctorVerification.Status
logger = logging.getLogger(__name__)


class PayloadTooLarge(APIException):
    status_code = 413
    default_detail = 'File too large (max 5 MB).'
    default_code = 'payload_too_large'


class StorageUnavailable(APIException):
    status_code = 503
    default_detail = 'Your document could not be saved right now. Please try again later.'
    default_code = 'storage_unavailable'


class Conflict(APIException):
    status_code = 409
    default_code = 'conflict'


class MyVerificationView(APIView):
    """GET /api/me/verification/ — the doctor's own status.
    POST /api/me/verification/ — upload the certificate (multipart field `document`).

    Open to a doctor in any status: this is the one thing an unverified doctor can do."""

    permission_classes = [permissions.IsAuthenticated, IsDoctor]
    throttle_classes = [VerificationUploadThrottle]
    parser_classes = [MultiPartParser]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method == 'POST':
            # Refuse an oversized request from its header, before any of the body is read.
            try:
                declared = int(request.META.get('CONTENT_LENGTH') or 0)
            except ValueError:
                declared = 0
            if declared > files.MAX_BODY_BYTES:
                raise PayloadTooLarge()

    def get(self, request):
        record = DoctorVerification.for_user(request.user)
        return Response(VerificationStatusSerializer(record).data)

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = DoctorVerification.for_user(request.user)
        try:
            record.submit(serializer.validated_data['document'], serializer.kind)
        except InvalidTransition:
            raise Conflict('Your document was already submitted.')
        except OSError:
            # Disk full, folder permissions changed, and so on. Nothing was saved (the change is
            # rolled back), so the doctor can simply try again once it is fixed.
            logger.exception('Could not store a certificate for user %s; check DJANGO_MEDIA_ROOT.', request.user.pk)
            raise StorageUnavailable()
        return Response(VerificationStatusSerializer(record).data)


class AdminOnly:
    permission_classes = [permissions.IsAuthenticated, IsAdmin]


class AdminVerificationListView(AdminOnly, generics.ListAPIView):
    """GET /api/admin/verifications/?status=pending|approved|rejected|all (default pending),
    oldest submission first."""

    serializer_class = AdminVerificationSerializer
    pagination_class = None

    def get_queryset(self):
        wanted = self.request.query_params.get('status', Status.PENDING)
        queryset = DoctorVerification.objects.select_related('user')
        if wanted == 'all':
            return queryset
        if wanted not in (Status.PENDING, Status.APPROVED, Status.REJECTED):
            raise ValidationError({'status': ['Use pending, approved, rejected or all.']})
        return queryset.filter(status=wanted)


class AdminVerificationDocumentView(AdminOnly, APIView):
    """GET /api/admin/verifications/<id>/document/ — the uploaded file, to an admin only.

    The name shown is fixed and the type comes from the stored bytes, so nothing the doctor
    chose reaches a header. `sandbox` stops the browser running anything inside the file."""

    def get(self, request, pk):
        record = generics.get_object_or_404(DoctorVerification, pk=pk)
        if not record.document:
            raise Http404
        try:
            kind = files.kind_of_stored_file(record.document.name)
            handle = files.private_storage().open(record.document.name, 'rb')
        except (FileNotFoundError, OSError):
            raise Http404
        if kind is None:
            handle.close()
            raise Http404
        response = FileResponse(
            handle, content_type=files.content_type_for(kind), as_attachment=False, filename='certificate',
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = 'sandbox'
        return response


class AdminVerificationApproveView(AdminOnly, APIView):
    """POST /api/admin/verifications/<id>/approve/"""

    def post(self, request, pk):
        record = generics.get_object_or_404(DoctorVerification, pk=pk)
        try:
            record.approve(request.user)
        except InvalidTransition:
            raise Conflict('This request was already decided or is not waiting for review.')
        return Response(AdminVerificationSerializer(record).data)


class AdminVerificationRejectView(AdminOnly, APIView):
    """POST /api/admin/verifications/<id>/reject/ with {"reason": "..."}.
    From an approved record this is a revocation."""

    def post(self, request, pk):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = generics.get_object_or_404(DoctorVerification, pk=pk)
        try:
            record.reject(request.user, serializer.validated_data['reason'])
        except InvalidTransition:
            raise Conflict('This request was already rejected or has not been submitted.')
        return Response(AdminVerificationSerializer(record).data)
