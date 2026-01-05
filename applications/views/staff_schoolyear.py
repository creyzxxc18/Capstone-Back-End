from django.shortcuts import render
from ..firebase_service import FirebaseService
import logging
import json
import logging
from django.http import JsonResponse
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache

logger = logging.getLogger(__name__)


@login_required
@never_cache
def staff_school_year_view(request):
    try:
        all_users = []
        firebase_service = FirebaseService()
        firebase_users = firebase_service.get_all_users()

        for user in firebase_users:

            full_name = ""

            if user.get("midname", "") and user.get("midname", "").strip():
                full_name = f"{user.get("firstName", "")} {user.get("midName", "")[0]}. {user.get("lastName", "")}"
            else:
                full_name = f"{user.get("firstName", "")} {user.get("lastName", "")}"

            all_users.append(
                {
                    "id": user.get("uid") or user.get("id"),
                    "full_name": full_name,
                    "email": user.get("email", ""),
                    "phoneNymber": user.get("phoneNumber", ""),
                    "department": user.get("department", ""),
                    "employmentStatus": user.get("employmentStatus", ""),
                    "employID": user.get("employID", ""),
                    "isActive": user.get("isActive", ""),
                }
            )
        context = {"users": all_users}

        return render(request, "staff/staff_schoolyear.html", context)
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        import traceback

        traceback.print_exc()
        return render(
            request,
            "staff/staff_schoolyear.html",
            {
                "users": [],
            },
        )


@csrf_exempt
@require_http_methods(["POST"])
def toggle_user_access(request):
    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        is_active = data.get("is_active")

        if not user_id or is_active is None:
            return JsonResponse(
                {"success": False, "error": "Missing user_id or is_active"}, status=400
            )

        # Initialize Firebase service
        firebase_service = FirebaseService()

        # Toggle the status
        firebase_service.toggle_user_active_status(user_id, is_active)

        return JsonResponse(
            {
                "success": True,
                "message": f'User access {"enabled" if is_active else "disabled"} successfully',
            }
        )

    except Exception as e:
        logger.error(f"Error toggling user access: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)
