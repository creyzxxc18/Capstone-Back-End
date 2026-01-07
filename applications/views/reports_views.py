from django.views.decorators.cache import never_cache
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from datetime import datetime, timedelta
from ..firebase_service import FirebaseService
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


@never_cache
@login_required
def reports(request):
    today = datetime.today()

    context = {
        "today": today.date(),
        "current_year": today.year,
        "current_month": today.month,
    }

    return render(request, "../template/reports.html", context)


@login_required
def get_attendance_report(request):
    try:
        department = request.GET.get("department", "all")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")

        if not start_date or not end_date:
            return JsonResponse(
                {"success": False, "error": "Start date and end date are required"},
                status=400,
            )

        try:
            datetime.strptime(start_date, "%Y-%m-%d")
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            return JsonResponse(
                {"success": False, "error": "Invalid date format. Use YYYY-MM-DD"},
                status=400,
            )

        if datetime.strptime(start_date, "%Y-%m-%d") > datetime.strptime(
            end_date, "%Y-%m-%d"
        ):
            return JsonResponse(
                {"success": False, "error": "Start date cannot be after end date"},
                status=400,
            )

        logger.info(
            f"Generating report from {start_date} to {end_date} for department: {department}"
        )

        firebase_service = FirebaseService()
        summary = firebase_service.calculate_attendance_summary(
            start_date, end_date, department
        )

        logger.info(f"Report generated successfully with {len(summary)} records")

        return JsonResponse(
            {
                "success": True,
                "data": summary,
                "start_date": start_date,
                "end_date": end_date,
            }
        )

    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def get_professor_attendance_history(request):
    try:
        professor_uid = request.GET.get("professor_uid")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")

        if not professor_uid or not start_date or not end_date:
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()

        attendance_ref = firebase_service.db.collection("attendance")
        all_records = list(attendance_ref.stream())

        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")

        history = []
        matching_count = 0

        for doc in all_records:
            data = doc.to_dict()

            record_teacher_uid = data.get("uid")

            if record_teacher_uid == professor_uid:
                matching_count += 1

                doc_date = data.get("date")
                if not doc_date:
                    continue

                try:
                    if hasattr(doc_date, "strftime"):
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

                    doc_dt = datetime.strptime(doc_date_str, "%Y-%m-%d")
                    if not (start_dt <= doc_dt <= end_dt):
                        continue

                    attendance_status = data.get("status", "pending").lower()

                    if attendance_status in ["holiday", "suspended"]:
                        logger.info(
                            f"Skipping {attendance_status} record for date {doc_date_str}"
                        )
                        continue

                    class_id = data.get("classId")
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
                            else:
                                room = "Deleted Class"
                                logger.info(f"Class {class_id} not found (deleted)")
                        except Exception as e:
                            logger.warning(f"Could not fetch class info: {str(e)}")

                    history.append(
                        {
                            "date": doc_date_str,
                            "time_in": data.get("timeIn", "N/A"),
                            "time_out": data.get("timeOut", "N/A"),
                            "status": attendance_status,
                            "late_reason": data.get("lateReasons", "N/A"),
                            "subject_code": subject_code,
                            "subject_name": subject_name,
                            "room": room,
                        }
                    )

                except Exception as e:
                    logger.warning(f"Error parsing attendance record: {str(e)}")
                    continue

        history.sort(key=lambda x: x["date"], reverse=True)

        return JsonResponse({"success": True, "history": history})

    except Exception as e:
        logger.error(f"Error fetching attendance history: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)
