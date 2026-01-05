import logging, calendar as cal_module
import json
from datetime import date, datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST, require_GET
from django.utils.safestring import mark_safe

from applications.admin import User
from ..firebase_service import FirebaseService
from ..utils import Calendar

logger = logging.getLogger(__name__)


@never_cache
@login_required
def staff_scheduling(request):
    today = datetime.today()

    year = int(request.GET.get("year", today.year))
    month = int(request.GET.get("month", today.month))

    cal = Calendar(year, month)
    html_calendar = cal.formatmonth(withyear=True)

    def add_data_dates(html_calendar, year, month):
        today_date = date.today()
        for day in range(1, 32):
            try:
                current_date = date(year, month, day)
            except ValueError:
                continue  # skip invalid days

            # Determine class
            if current_date < today_date:
                css_class = "past"
            elif current_date == today_date:
                css_class = "today"
            else:
                css_class = "future"

            date_str = current_date.isoformat()
            html_calendar = html_calendar.replace(
                f">{day}<", f' data-date="{date_str}" class="day {css_class}">{day}<'
            )
        return html_calendar

    html_calendar = add_data_dates(html_calendar, year, month)
    html_calendar = mark_safe(html_calendar)

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1

    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1

    users = User.objects.filter(is_active=True).order_by(
        "first_name", "last_name", "username"
    )

    context = {
        "users": users,
        "calendar": html_calendar,
        "prev_month": prev_month,
        "prev_year": prev_year,
        "next_month": next_month,
        "next_year": next_year,
        "current_year": year,
        "current_month": cal_module.month_name[month],
        "current_month_number": month,
    }

    return render(request, "staff/staff_scheduling.html", context)


@login_required
def get_schedules_by_month(request):
    try:
        department = request.GET.get("department", "all")
        year = int(request.GET.get("year"))
        month = int(request.GET.get("month"))

        firebase_service = FirebaseService()

        
        classes = firebase_service.get_classes(teacherUid=None, department=department)

        
        day_mapping = {
            "Monday": 0,
            "Tuesday": 1,
            "Wednesday": 2,
            "Thursday": 3,
            "Friday": 4,
            "Saturday": 5,
            "Sunday": 6,
            "Mon": 0,
            "Tue": 1,
            "Wed": 2,
            "Thu": 3,
            "Fri": 4,
            "Sat": 5,
            "Sun": 6,
        }

        num_days = cal_module.monthrange(year, month)[1]
        schedule_map = {}

        for day in range(1, num_days + 1):
            date_obj = datetime(year, month, day)
            date_str = date_obj.strftime("%Y-%m-%d")
            weekday = date_obj.weekday()

            
            teachers_today = {}

            for cls in classes:
                class_day = cls.get("day", "").strip()
                if class_day in day_mapping and day_mapping[class_day] == weekday:
                    teacher_name = cls.get("teacher_name", "Unknown")
                    teacherUid = cls.get("teacherUid", None)

                    if teacherUid not in teachers_today:
                        teachers_today[teacherUid] = {
                            "teacherUid": teacherUid,
                            "teacher_name": teacher_name,
                            "classes": [],
                        }

                    teachers_today[teacherUid]["classes"].append(
                        {
                            "subjectCode": cls.get("subjectCode", ""),
                            "subjectName": cls.get("subjectName", ""),
                            "startTime": cls.get("startTime", ""),
                            "endTime": cls.get("endTime", ""),
                            "room": cls.get("room", ""),
                            "day": class_day,
                        }
                    )

            if teachers_today:
                schedule_map[date_str] = list(teachers_today.values())

        return JsonResponse({"success": True, "schedule": schedule_map})

    except Exception as e:
        logger.error(f"Error fetching monthly schedules: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def get_schedules_by_date(request):
    try:
        department = request.GET.get("department", "all")
        date_str = request.GET.get("date")  

        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        weekday = date_obj.weekday()

        day_names = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        day_name = day_names[weekday]

        firebase_service = FirebaseService()
        classes = firebase_service.get_classes(teacherUid=None, department=department)

        teachers = {}

        for cls in classes:
            class_day = cls.get("day", "").strip()

            if class_day == day_name or class_day == day_name[:3]:
                teacher_name = cls.get("teacher_name", "Unknown")
                teacherUid = cls.get("teacherUid", None)

                if teacherUid not in teachers:
                    teachers[teacherUid] = {
                        "teacherUid": teacherUid,
                        "teacher_name": teacher_name,
                        "classes": [],
                    }

                teachers[teacherUid]["classes"].append(
                    {
                        "subjectCode": cls.get("subjectCode", ""),
                        "subjectName": cls.get("subjectName", ""),
                        "startTime": cls.get("startTime", ""),
                        "endTime": cls.get("endTime", ""),
                        "room": cls.get("room", ""),
                        "day": class_day,
                    }
                )

        return JsonResponse({"success": True, "schedules": list(teachers.values())})

    except Exception as e:
        logger.error(f"Error fetching date schedules: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)

@login_required
@require_GET
def get_attendance_by_class(request):
    try:
        class_id = request.GET.get("classId")
        date = request.GET.get("date")  
        teacher_uid = request.GET.get("teacherUid")

        logger.info("=" * 80)
        logger.info("🔍 FETCHING ATTENDANCE")
        logger.info(f"ClassID: {class_id}")
        logger.info(f"Date: {date}")
        logger.info(f"TeacherUID: {teacher_uid}")

        if not all([class_id, date, teacher_uid]):
            logger.error("❌ Missing required parameters")
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()
        attendance = firebase_service.get_attendance(class_id, date, teacher_uid)

        if attendance:
            logger.info(f"✅ Found attendance record: {attendance.get('id')}")
            logger.info(f"   - Time In: {attendance.get('timeInActual')}")
            logger.info(f"   - Time Out: {attendance.get('timeOutActual')}")
            logger.info(
                f"   - Time In Image: {attendance.get('timeInImageUrl')[:50] if attendance.get('timeInImageUrl') else 'None'}..."
            )
            logger.info(
                f"   - Time Out Image: {attendance.get('timeOutImageUrl')[:50] if attendance.get('timeOutImageUrl') else 'None'}..."
            )
            logger.info(f"   - Status: {attendance.get('status')}")
        else:
            logger.warning("⚠️ No attendance record found")

        logger.info("=" * 80)

        return JsonResponse({"success": True, "attendance": attendance})

    except Exception as e:
        logger.error(f"❌ Error fetching attendance: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def validate_attendance(request):
    try:
        data = json.loads(request.body)

        attendance_id = data.get("attendanceId")
        is_approved = data.get("isApproved")

        logger.info(
            f"🔍 Validation request for attendance {attendance_id}: {is_approved}"
        )

        validator_uid = getattr(request.user, "uid", "admin")

        if not all([attendance_id, is_approved is not None]):
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()

        
        attendance_ref = firebase_service.db.collection("attendance").document(
            attendance_id
        )
        doc = attendance_ref.get()

        if not doc.exists:
            return JsonResponse(
                {"success": False, "error": "Attendance record not found"}, status=404
            )

        original_data = doc.to_dict()
        original_status = original_data.get("status", "pending")

        logger.info(f"   Original status before validation: {original_status}")

        
        result = firebase_service.validate_attendance(
            attendance_id=attendance_id,
            is_approved=is_approved,
            validator_uid=validator_uid,
        )

        logger.info(f"   Status after validation: {result.get('attendance_status')}")

        
        return JsonResponse(
            {
                "success": True,
                "message": f'Attendance {"approved" if is_approved else "declined"}',
            }
        )

    except Exception as e:
        logger.error(f"Error validating attendance: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_GET
def get_daily_attendance_summary(request):
    try:
        date = request.GET.get("date")
        department = request.GET.get("department", "all")

        if not date:
            return JsonResponse(
                {"success": False, "error": "Date is required"}, status=400
            )

        firebase_service = FirebaseService()
        attendance_records = firebase_service.get_daily_attendance(date, department)

        return JsonResponse(
            {
                "success": True,
                "attendance": attendance_records,
                "summary": {
                    "total": len(attendance_records),
                    "pending": len(
                        [a for a in attendance_records if a.get("status") == "pending"]
                    ),
                    "approved": len(
                        [a for a in attendance_records if a.get("status") == "approved"]
                    ),
                    "rejected": len(
                        [a for a in attendance_records if a.get("status") == "rejected"]
                    ),
                },
            }
        )

    except Exception as e:
        logger.error(f"Error fetching daily attendance: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def create_attendance(request):
    try:
        data = json.loads(request.body)

        
        logger.info(f"📥 Received attendance data: {data}")

        firebase_service = FirebaseService()
        result = firebase_service.create_attendance_record(data)

        logger.info(f"✅ Attendance created successfully: {result['attendanceId']}")

        return JsonResponse(
            {
                "success": True,
                "message": "Attendance record created",
                "attendanceId": result["attendanceId"],
                "data": result.get("data"),
            }
        )

    except Exception as e:
        logger.error(f"❌ Error creating attendance: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_GET
def debug_attendance(request):
    try:
        class_id = request.GET.get("classId")
        teacher_uid = request.GET.get("teacherUid")
        date = request.GET.get("date")

        firebase_service = FirebaseService()

        
        all_attendance = firebase_service.db.collection("attendance").stream()

        records = []
        for doc in all_attendance:
            data = doc.to_dict()
            data["id"] = doc.id
            records.append(data)

        logger.info(f"📊 Total attendance records: {len(records)}")

        
        filtered_records = records
        if class_id:
            filtered_records = [
                r for r in filtered_records if r.get("classId") == class_id
            ]
            logger.info(f"   After classId filter: {len(filtered_records)}")
        if teacher_uid:
            filtered_records = [
                r
                for r in filtered_records
                if (r.get("teacherUid") == teacher_uid or r.get("uid") == teacher_uid)
            ]
            logger.info(f"   After teacherUid filter: {len(filtered_records)}")
        if date:
            filtered_records = [
                r for r in filtered_records if date in str(r.get("date", ""))
            ]
            logger.info(f"   After date filter: {len(filtered_records)}")

        
        classes = firebase_service.get_classes()
        class_info = []
        for cls in classes[:10]:  
            class_info.append(
                {
                    "id": cls.get("id"),
                    "subjectCode": cls.get("subjectCode"),
                    "teacherUid": cls.get("teacherUid"),
                }
            )

        return JsonResponse(
            {
                "success": True,
                "total_records": len(records),
                "filtered_records": len(filtered_records),
                "records": filtered_records,
                "all_records": records,  
                "sample_classes": class_info,  
                "filters": {
                    "classId": class_id,
                    "teacherUid": teacher_uid,
                    "date": date,
                },
                "debug_info": {
                    "attendance_classIds": list(
                        set([r.get("classId") for r in records])
                    ),
                    "attendance_teacherUids": list(
                        set([r.get("teacherUid") or r.get("uid") for r in records])
                    ),
                    "classes_classIds": [c["id"] for c in class_info],
                    "classes_teacherUids": list(
                        set([c["teacherUid"] for c in class_info])
                    ),
                },
            }
        )

    except Exception as e:
        logger.error(f"❌ Error in debug: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_POST
def test_create_attendance(request):
    try:
        data = json.loads(request.body)

        logger.info("=" * 80)
        logger.info("🧪 TEST ATTENDANCE CREATION")
        logger.info(f"Received data: {json.dumps(data, indent=2)}")

        required_fields = ["classId", "teacherUid", "date"]
        missing = [f for f in required_fields if not data.get(f)]

        if missing:
            logger.error(f"❌ Missing required fields: {missing}")
            return JsonResponse(
                {"success": False, "error": f"Missing required fields: {missing}"},
                status=400,
            )

        firebase_service = FirebaseService()
        result = firebase_service.create_attendance_record(data)

        logger.info(f"✅ Test attendance created: {result['attendanceId']}")
        logger.info("=" * 80)

        return JsonResponse(
            {
                "success": True,
                "message": "Test attendance created",
                "attendanceId": result["attendanceId"],
                "data": result.get("data"),
            }
        )

    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def set_day_status(request):
    try:
        data = json.loads(request.body)

        date = data.get("date")
        status = data.get("status")
        reason = data.get("reason", "")

        if not date or not status:
            return JsonResponse(
                {"success": False, "error": "Date and status are required"}, status=400
            )

        if status not in ["holiday", "suspended"]:
            return JsonResponse(
                {"success": False, "error": "Invalid status"}, status=400
            )

        firebase_service = FirebaseService()
        result = firebase_service.set_day_status(date, status, reason)

        return JsonResponse(
            {
                "success": True,
                "message": f"Day marked as {status}",
                "data": {"date": date, "status": status, "reason": reason},
            }
        )

    except Exception as e:
        logger.error(f"Error setting day status: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)

@login_required
@require_GET
def get_day_status(request):
    try:
        date = request.GET.get("date")

        if not date:
            return JsonResponse(
                {"success": False, "error": "Date is required"}, status=400
            )

        firebase_service = FirebaseService()
        status_data = firebase_service.get_day_status(date)

        return JsonResponse({"success": True, "status": status_data})

    except Exception as e:
        logger.error(f"Error getting day status: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_GET
def get_month_statuses(request):
    try:
        year = int(request.GET.get("year"))
        month = int(request.GET.get("month"))

        firebase_service = FirebaseService()
        statuses = firebase_service.get_month_statuses(year, month)

        return JsonResponse({"success": True, "statuses": statuses})

    except Exception as e:
        logger.error(f"Error getting month statuses: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def remove_day_status(request):
    try:
        data = json.loads(request.body)
        date = data.get("date")

        if not date:
            return JsonResponse(
                {"success": False, "error": "Date is required"}, status=400
            )

        firebase_service = FirebaseService()
        firebase_service.remove_day_status(date)

        return JsonResponse({"success": True, "message": "Day status removed"})

    except Exception as e:
        logger.error(f"Error removing day status: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def mark_teacher_leave(request):
    try:
        data = json.loads(request.body)

        attendance_id = data.get("attendanceId")
        late_reasons = data.get("lateReasons")

        if not attendance_id or not late_reasons:
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()
        result = firebase_service.mark_teacher_leave(attendance_id, late_reasons)

        return JsonResponse(
            {
                "success": True,
                "message": f"Teacher marked as {late_reasons}",
                "data": result,
            }
        )

    except Exception as e:
        logger.error(f"Error marking teacher leave: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def mark_all_classes_leave(request):
    try:
        data = json.loads(request.body)

        teacher_uid = data.get("teacherUid")
        date = data.get("date")
        late_reasons = data.get("lateReasons")

        if not all([teacher_uid, date, late_reasons]):
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()
        result = firebase_service.mark_all_classes_leave(
            teacher_uid, date, late_reasons
        )

        return JsonResponse(
            {
                "success": True,
                "message": f"All classes marked as {late_reasons}",
                "updatedCount": result["updated_count"],
                "createdCount": result["created_count"],
            }
        )

    except Exception as e:
        logger.error(f"Error marking all classes leave: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def clear_teacher_leave(request):
    try:
        data = json.loads(request.body)

        attendance_id = data.get("attendanceId")

        if not attendance_id:
            return JsonResponse(
                {"success": False, "error": "Attendance ID required"}, status=400
            )

        firebase_service = FirebaseService()
        result = firebase_service.clear_teacher_leave(attendance_id)

        return JsonResponse(
            {"success": True, "message": "Leave status cleared", "data": result}
        )

    except Exception as e:
        logger.error(f"Error clearing teacher leave: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)

@login_required
@require_POST
def clear_all_classes_leave(request):
    try:
        data = json.loads(request.body)

        teacher_uid = data.get("teacherUid")
        date = data.get("date")

        if not all([teacher_uid, date]):
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"},
                status=400
            )

        firebase_service = FirebaseService()
        result = firebase_service.clear_all_classes_leave(teacher_uid, date)

        return JsonResponse({
            "success": True,
            "message": "All leave statuses cleared",
            "clearedCount": result["cleared_count"]
        })

    except Exception as e:
        logger.error(f"Error clearing all classes leave: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def fix_attendance_records(request):
    try:
        if not request.user.is_superuser:
            return JsonResponse({"success": False, "error": "Admin only"}, status=403)

        firebase_service = FirebaseService()
        fixed_count = firebase_service.fix_corrupted_attendance_records()

        return JsonResponse(
            {
                "success": True,
                "message": f"Fixed {fixed_count} corrupted records",
                "fixed_count": fixed_count,
            }
        )

    except Exception as e:
        logger.error(f"Error in fix_attendance_records: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
@require_POST
def mark_compensated(request):
    try:
        data = json.loads(request.body)

        attendance_id = data.get("attendanceId")
        is_compensated = data.get("isCompensated")
        compensation_note = data.get("note", "")

        if not attendance_id or is_compensated is None:
            return JsonResponse(
                {"success": False, "error": "Missing required parameters"}, status=400
            )

        firebase_service = FirebaseService()

        # Get user ID safely
        validator_uid = "admin"
        if hasattr(request.user, "firebase_uid") and request.user.firebase_uid:
            validator_uid = request.user.firebase_uid
        elif request.user.is_authenticated:
            validator_uid = str(request.user.id)

        result = firebase_service.mark_attendance_compensated(
            attendance_id, is_compensated, validator_uid, compensation_note
        )

        return JsonResponse(
            {
                "success": True,
                "message": f"Attendance {'marked as compensated' if is_compensated else 'compensation removed'}",
            }
        )

    except Exception as e:
        logger.error(f"Error marking compensated: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)
