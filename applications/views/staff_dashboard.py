from django.shortcuts import render
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from firebase_admin import firestore
from datetime import datetime, timedelta
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from collections import defaultdict
import pytz


@never_cache
@login_required
def staff_dashboard_view(request):
    profile = request.user.profile
    db = firestore.client()

    start_date = datetime.now() - timedelta(weeks=16)

    attendance_ref = db.collection("attendance")
    query = attendance_ref.where("date", ">=", start_date).stream()

    present_count, late_count, absent_count = get_weekly_status()
    performers = get_monthly_performers()
    department_performers = get_department_analysis()
    attendance_logs = get_attendance_logs()
    print(attendance_logs)

    ticks = range(0, 101, 10)

    weekly_data = {}
    for doc in query:
        data = doc.to_dict()
        date = data["date"]

        if hasattr(date, "timestamp"):
            date = datetime.fromtimestamp(date.timestamp())

        status = data["status"]

        week = date.isocalendar()[1]
        if week not in weekly_data:
            weekly_data[week] = {"present": 0, "absent": 0, "late": 0}

        if status == "present":
            weekly_data[week]["present"] += 1
        elif status == "absent":
            weekly_data[week]["absent"] += 1
        elif status == "late":
            weekly_data[week]["late"] += 1

    weeks = sorted(weekly_data.keys())
    present_counts = [weekly_data[w]["present"] for w in weeks]

    if len(present_counts) < 8:
        fallback_data = [
            {"date": "2025-03-17", "present": 181},
            {"date": "2025-03-24", "present": 171},
            {"date": "2025-03-31", "present": 138},
            {"date": "2025-04-07", "present": 148},
            {"date": "2025-04-14", "present": 0},
            {"date": "2025-04-21", "present": 146},
            {"date": "2025-04-28", "present": 138},
            {"date": "2025-05-05", "present": 183},
            {"date": "2025-05-12", "present": 171},
            {"date": "2025-05-19", "present": 147},
            {"date": "2025-05-26", "present": 177},
            {"date": "2025-06-02", "present": 182},
        ]

        weeks = [item["date"] for item in fallback_data]
        present_counts = [item["present"] for item in fallback_data]

    model = ExponentialSmoothing(
        present_counts, trend="add", seasonal="add", seasonal_periods=4
    )

    fitted = model.fit(optimized=True)

    smoothed = fitted.fittedvalues.tolist()
    forecast = fitted.forecast(4).tolist()
    forecast = [max(0, x) for x in forecast]

    context = {
        "original": present_counts,
        "smoothed": smoothed,
        "forecast": forecast,
        "weeks": weeks,
        "profile": profile,
        "ticks": ticks,
        # weekly count
        "present_count": present_count,
        "late_count": late_count,
        "absent_count": absent_count,
        # performers
        "top_performer": performers["top_performer"],
        "top_runners_up": performers["top_runners_up"],
        "poor_performer": performers["poor_performer"],
        "poor_runners_up": performers["poor_runners_up"],
        # department
        "department": department_performers["all_departments"],
        # attendance logs
        "attendance": attendance_logs,
    }

    print("Dashboard context prepared:", context)

    return render(request, "../template/staff/staff_dashboard.html", context)


def get_weekly_status():
    db = firestore.client()

    query = (
        db.collection("attendance")
        .where("date", ">=", (datetime.now() - timedelta(weeks=1)))
        .stream()
    )

    present_count = 0
    late_count = 0
    absent_count = 0

    for doc in query:
        data = doc.to_dict()
        status = data.get("status", "").lower()

        if status == "present":
            present_count += 1
        elif status == "late":
            late_count += 1
        elif status == "absent":
            absent_count += 1

    return (present_count, late_count, absent_count)


def get_monthly_performers():

    db = firestore.client()

    users_dict = {}
    users_query = db.collection("users").stream()

    for user_doc in users_query:
        user_data = user_doc.to_dict()
        uid = user_data.get("uid")
        if uid:
            users_dict[uid] = {
                "name": f"{user_data.get('firstName', '')} {user_data.get('lastName', '')}".strip(),
                "department": user_data.get("department", "Unknown Department"),
                "profileImageUrl": user_data.get("profileImageUrl", None),
            }

    # attendance 30 days (1 month)
    start_date = datetime.now() - timedelta(days=30)
    query = db.collection("attendance").where("date", ">=", start_date).stream()

    # Store attendance
    user_stats = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0, "total": 0})

    for doc in query:
        data = doc.to_dict()
        uid = data.get("uid", "unknown")
        status = data.get("status", "").lower()

        # Count
        user_stats[uid]["total"] += 1

        if status == "present":
            user_stats[uid]["present"] += 1
        elif status == "absent":
            user_stats[uid]["absent"] += 1
        elif status == "late":
            user_stats[uid]["late"] += 1

    # Calculate
    user_rates = []

    for uid, stats in user_stats.items():
        total = stats["total"]
        if total > 0:
            attendance_rate = (stats["present"] / total) * 100

            user_info = users_dict.get(
                uid,
                {
                    "name": "Unknown User",
                    "department": "Unknown Department",
                    "profileImageUrl": None,
                },
            )

            user_rates.append(
                {
                    "uid": uid,
                    "name": user_info["name"] or "Unknown User",
                    "department": user_info["department"] or "Unknown Department",
                    "present": stats["present"],
                    "absent": stats["absent"],
                    "late": stats["late"],
                    "total": total,
                    "rate": round(attendance_rate, 2),
                    "profile_image": user_info["profileImageUrl"] or None,
                }
            )

    # Sort
    user_rates.sort(key=lambda x: x["rate"], reverse=True)

    # Get top and poor performers
    if len(user_rates) == 0:
        return {
            "top_performer": None,
            "top_runners_up": [],
            "poor_performer": None,
            "poor_runners_up": [],
        }

    top_performer = user_rates[0] if len(user_rates) > 0 else None
    top_runners_up = user_rates[1:3] if len(user_rates) > 1 else []

    poor_performer = user_rates[-1] if len(user_rates) > 0 else None
    poor_runners_up = user_rates[-3:-1] if len(user_rates) > 2 else []
    poor_runners_up.reverse()

    return {
        "top_performer": top_performer,
        "top_runners_up": top_runners_up,
        "poor_performer": poor_performer,
        "poor_runners_up": poor_runners_up,
    }


def get_department_analysis():
    db = firestore.client()

    users_dict = {}
    users_query = db.collection("users").stream()

    for user_doc in users_query:
        user_data = user_doc.to_dict()
        uid = user_data.get("uid")
        if uid:
            users_dict[uid] = {"department": user_data.get("department", "Unknown")}

    start_date = datetime.now() - timedelta(days=30)
    query = db.collection("attendance").where("date", ">=", start_date).stream()

    dept_stats = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0, "total": 0})

    for doc in query:
        data = doc.to_dict()
        uid = data.get("uid", "unknown")
        status = data.get("status", "").lower()

        user_info = users_dict.get(uid)
        if user_info:
            dept = user_info["department"]

            dept_stats[dept]["total"] += 1

            if status == "present":
                dept_stats[dept]["present"] += 1
            elif status == "absent":
                dept_stats[dept]["absent"] += 1
            elif status == "late":
                dept_stats[dept]["late"] += 1

    department_map = {
        "Business Administration": {
            "name": "Business Administration",
            "class": "bsba",
            "color": "#DFEA7A",
        },
        "Information Technology": {
            "name": "Information Technology",
            "class": "bsit",
            "color": "#924FD1",
        },
        "Tourism Management": {
            "name": "Tourism Management",
            "class": "bstm",
            "color": "#FC81EC",
        },
        "Basic Education": {
            "name": "Basic Education",
            "class": "educ",
            "color": "#7AB4EA",
        },
        "Criminology": {"name": "Criminology", "class": "bscrim", "color": "#7A7CEA"},
    }

    dept_rates = {}

    for dept_code, stats in dept_stats.items():
        total = stats["total"]
        if total > 0:
            rate = (stats["present"] / total) * 100

            dept_info = department_map.get(
                dept_code, {"name": dept_code, "class": "gen-ed", "color": "#7AEA80"}
            )

            dept_rates[dept_code] = {
                "code": dept_code,
                "name": dept_info["name"],
                "class": dept_info["class"],
                "color": dept_info["color"],
                "rate": round(rate, 2),
                "present": stats["present"],
                "total": total,
                "height": int(rate),
            }

    # Separate top and poor performers
    sorted_depts = sorted(dept_rates.values(), key=lambda x: x["rate"], reverse=True)

    return {"all_departments": sorted_depts}


from datetime import datetime
import pytz


def get_attendance_logs():
    db = firestore.client()

    attendance_list = []
    class_dict = {}
    users_dict = {}

    # Use Philippine timezone
    philippine_tz = pytz.timezone("Asia/Manila")
    now = datetime.now(philippine_tz)
    today = now.date()

    print(f"Looking for records on: {today}")

    # Fetch all collections
    attendance_query = db.collection("attendance").stream()
    classes_query = db.collection("classes").stream()
    users_query = db.collection("users").stream()

    for teacher_class in classes_query:
        data = teacher_class.to_dict()
        classId = teacher_class.id
        if classId:
            class_dict[classId] = {
                "subjectName": data.get("subjectName", ""),
                "room": data.get("room", ""),
            }

    for user in users_query:
        data = user.to_dict()
        uid = data.get("uid")
        if uid:
            users_dict[uid] = {
                "name": f"{data.get('firstName', '')} {data.get('lastName', '')}".strip(),
            }

    for attendance in attendance_query:
        data = attendance.to_dict()
        uid = data.get("uid")
        classId = data.get("classId")
        date_field = data.get("date")

        if date_field and uid:
            try:
                # Convert Firebase timestamp to Philippine timezone
                if hasattr(date_field, "astimezone"):
                    # It's a datetime object, convert to Philippine timezone
                    ph_datetime = date_field.astimezone(philippine_tz)
                    record_date = ph_datetime.date()
                else:
                    # Fallback if it's already a date
                    record_date = (
                        date_field.date() if hasattr(date_field, "date") else None
                    )

                # Only include today's records
                if record_date == today:
                    attendance_list.append(
                        {
                            "teacherName": users_dict.get(uid, {}).get(
                                "name", "Unknown"
                            ),
                            "subjectName": class_dict.get(classId, {}).get(
                                "subjectName", "Unknown"
                            ),
                            "room": class_dict.get(classId, {}).get("room", "Unknown"),
                            "timeIn": data.get("timeIn", ""),
                            "timeOut": data.get("timeOut", ""),
                            "status": data.get("status", ""),
                            "date": date_field,
                        }
                    )
            except Exception as e:
                print(f"Error parsing date '{date_field}': {e}")

    attendance_list.sort(key=lambda x: x.get("date") or datetime.min, reverse=True)
    print(f"Found {len(attendance_list)} attendance records for today")
    return attendance_list
