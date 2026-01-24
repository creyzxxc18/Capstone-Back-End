from django.shortcuts import render
from ..firebase_service import FirebaseService
import logging
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


@login_required
@never_cache
def school_year_view(request):
    try:
        all_users = []
        firebase_service = FirebaseService()
        firebase_users = firebase_service.get_all_users()

        for user in firebase_users:

            full_name = ""

            if user.get("midname", "") and user.get("midname", "").strip():
                full_name = f"{user.get('firstName', '')} {user.get('midName', '')[0]}. {user.get('lastName', '')}"
            else:
                full_name = f"{user.get('firstName', '')} {user.get('lastName', '')}"

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

        return render(request, "school-year.html", context)
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        import traceback

        traceback.print_exc()
        return render(
            request,
            "school-year.html",
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
        firebase_service = FirebaseService()
        firebase_service.toggle_user_active_status(user_id, is_active)

        return JsonResponse(
            {
                "success": True,
                "message": f'User access {"activated" if is_active else "archived"} successfully',
            }
        )

    except Exception as e:
        logger.error(f"Error toggling user access: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def get_archived_user_report(request):
    """
    Generate all-time attendance report for an archived user
    Reuses the existing report generation logic from reports_views.py
    """
    try:
        user_id = request.GET.get("user_id")

        if not user_id:
            return JsonResponse(
                {"success": False, "error": "Missing user_id parameter"}, status=400
            )

        logger.info(f"📊 Generating all-time report for archived user: {user_id}")

        firebase_service = FirebaseService()
        user_data = firebase_service.get_user_by_id(user_id)
        if not user_data:
            return JsonResponse(
                {"success": False, "error": "User not found"}, status=404
            )
        attendance_ref = firebase_service.db.collection("attendance")
        all_attendance = list(attendance_ref.stream())
        user_attendance = []
        earliest_date = None
        latest_date = None

        for doc in all_attendance:
            data = doc.to_dict()
            record_teacher_uid = data.get("uid")

            if record_teacher_uid != user_id:
                continue

            doc_date = data.get("date")
            if not doc_date:
                continue

            try:

                if hasattr(doc_date, "date"):
                    local_tz = timezone(timedelta(hours=8))
                    if doc_date.tzinfo:
                        local_dt = doc_date.astimezone(local_tz)
                    else:
                        local_dt = doc_date
                    doc_date_str = local_dt.date().strftime("%Y-%m-%d")
                elif hasattr(doc_date, "strftime"):
                    doc_date_str = doc_date.strftime("%Y-%m-%d")
                elif isinstance(doc_date, str):
                    if "T" in doc_date:
                        doc_date_str = doc_date.split("T")[0]
                    else:
                        doc_date_str = doc_date.split(" ")[0]
                else:
                    continue
                current_date = datetime.strptime(doc_date_str, "%Y-%m-%d")
                if earliest_date is None or current_date < earliest_date:
                    earliest_date = current_date
                if latest_date is None or current_date > latest_date:
                    latest_date = current_date

                user_attendance.append(
                    {
                        "date": doc_date_str,
                        "timeIn": data.get("timeIn"),
                        "timeOut": data.get("timeOut"),
                        "status": data.get("status", "pending"),
                        "classId": data.get("classId"),
                        "lateReasons": data.get("lateReasons"),
                    }
                )

            except Exception as e:
                logger.warning(f"Error parsing attendance record: {str(e)}")
                continue

        if not user_attendance:
            return JsonResponse(
                {"success": False, "error": "No attendance data found for this user"},
                status=404,
            )
        start_date = earliest_date.strftime("%Y-%m-%d")
        end_date = latest_date.strftime("%Y-%m-%d")

        logger.info(f"📅 Date range: {start_date} to {end_date}")
        logger.info(f"📊 Found {len(user_attendance)} attendance records")
        summary = firebase_service.calculate_attendance_summary(
            start_date, end_date, department="all"
        )
        user_summary = [s for s in summary if s.get("uid") == user_id]

        if not user_summary:
            return JsonResponse(
                {"success": False, "error": "Could not generate summary for this user"},
                status=500,
            )
        history = []
        for att in user_attendance:
            class_id = att.get("classId")
            subject_code = "N/A"
            subject_name = "N/A"
            room = "N/A"

            if class_id:
                try:
                    class_doc = (
                        firebase_service.db.collection("classes")
                        .document(class_id)
                        .get()
                    )
                    if class_doc.exists:
                        class_info = class_doc.to_dict()
                        subject_code = class_info.get("subjectCode", "N/A")
                        subject_name = class_info.get("subjectName", "N/A")
                        room = class_info.get("room", "N/A")
                except Exception as e:
                    logger.warning(f"Could not fetch class info: {str(e)}")

            history.append(
                {
                    "date": att["date"],
                    "time_in": att.get("timeIn", "N/A"),
                    "time_out": att.get("timeOut", "N/A"),
                    "status": att.get("status", "pending"),
                    "late_reason": att.get("lateReasons", "N/A"),
                    "subject_code": subject_code,
                    "subject_name": subject_name,
                    "room": room,
                }
            )
        history.sort(key=lambda x: x["date"], reverse=True)

        logger.info(f"✅ Report generated successfully")

        return JsonResponse(
            {
                "success": True,
                "data": user_summary,
                "history": history,
                "start_date": start_date,
                "end_date": end_date,
            }
        )

    except Exception as e:
        logger.error(f"❌ Error generating archived user report: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)
