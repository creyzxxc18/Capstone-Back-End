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

    present_count, late_count, absent_count, week_start, week_end = get_weekly_status()
    performers = get_monthly_performers()
    department_performers = get_department_analysis()
    attendance_logs = get_attendance_logs()

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

    # Calculate insights
    insights = calculate_insights(present_counts, forecast, weeks)

    context = {
        "original": present_counts,
        "smoothed": smoothed,
        "forecast": forecast,
        "weeks": weeks,
        "profile": profile,
        # weekly count
        "present_count": present_count,
        "late_count": late_count,
        "absent_count": absent_count,
        "week_start": week_start,
        "week_end": week_end,
        # performers
        "top_performer": performers["top_performer"],
        "top_rankers": performers["top_rankers"],
        "poor_performer": performers["poor_performer"],
        "poor_rankers": performers["poor_rankers"],
        # department
        "department": department_performers["all_departments"],
        "ticks": department_performers["ticks"],
        "tick_positions": department_performers["tick_positions"],
        # attendance logs
        "attendance": attendance_logs,
        # insights
        "insights": insights,
    }

    return render(request, "staff/staff_dashboard.html", context)


def calculate_insights(present_counts, forecast, weeks):
    """Calculate dynamic insights from attendance data"""
    insights = []

    # Calculate average attendance
    if present_counts:
        avg_attendance = round(sum(present_counts) / len(present_counts))

        # Trend insight - show forecast prediction with week range
        if forecast:
            last_forecast = round(forecast[-1])

            # Calculate the forecast week range
            forecast_weeks_ahead = len(forecast)
            forecast_start = datetime.now() + timedelta(weeks=forecast_weeks_ahead)

            # Get Monday and Sunday of that week
            days_since_monday = forecast_start.weekday()
            week_start = forecast_start - timedelta(days=days_since_monday)
            week_end = week_start + timedelta(days=6)

            week_range = (
                f"{week_start.strftime('%b %d')} to {week_end.strftime('%b %d')}"
            )

            insights.append(
                {
                    "type": "trend",
                    "label": "Trend",
                    "message": f"Forecast predicts {last_forecast} attendees for week of {week_range}",
                }
            )

        # Pattern insight - show average stability
        if len(present_counts) >= 2:
            variance = max(present_counts) - min(present_counts)
            variance_pct = (
                (variance / avg_attendance * 100) if avg_attendance > 0 else 0
            )

            if variance_pct < 15:
                insights.append(
                    {
                        "type": "pattern",
                        "label": "Pattern",
                        "message": f"Average attendance stable at ~{avg_attendance} per week",
                    }
                )
            else:
                insights.append(
                    {
                        "type": "pattern",
                        "label": "Pattern",
                        "message": f"Attendance varies between {min(present_counts)}-{max(present_counts)} per week",
                    }
                )

        # Critical insight - check for declining trend with week range
        if len(present_counts) >= 3:
            recent_avg = sum(present_counts[-3:]) / 3
            older_avg = sum(present_counts[:3]) / 3

            if recent_avg < older_avg * 0.9:  # 10% decline
                decline_pct = round(((older_avg - recent_avg) / older_avg) * 100)

                # Get the date range of recent 3 weeks
                today = datetime.now()
                recent_week_start = today - timedelta(weeks=2)

                # Get Monday of that week
                days_since_monday = recent_week_start.weekday()
                recent_monday = recent_week_start - timedelta(days=days_since_monday)
                recent_sunday = today + timedelta(days=(6 - today.weekday()))

                recent_range = f"{recent_monday.strftime('%b %d')} to {recent_sunday.strftime('%b %d')}"

                insights.append(
                    {
                        "type": "critical",
                        "label": "Alert",
                        "message": f"Attendance declined by {decline_pct}% in recent weeks ({recent_range})",
                    }
                )

    return insights


def get_weekly_status():
    db = firestore.client()

    today = datetime.now()
    days_since_monday = today.weekday()
    week_start = today - timedelta(days=days_since_monday)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    query = (
        db.collection("attendance")
        .where("date", ">=", week_start)
        .where("date", "<", week_end)
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

    return (
        present_count,
        late_count,
        absent_count,
        week_start,
        week_end - timedelta(days=1),
    )


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
    top_rankers = user_rates[:10] if len(user_rates) >= 10 else user_rates

    print("Top rankers:", [f"{r['name']}: {r['rate']}%" for r in top_rankers])
    poor_performer = user_rates[-1] if len(user_rates) > 0 else None
    poor_rankers = user_rates[-10:] if len(user_rates) >= 10 else user_rates
    poor_rankers.reverse()

    return {
        "top_performer": top_performer,
        "top_rankers": top_rankers,
        "poor_performer": poor_performer,
        "poor_rankers": poor_rankers,
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

    dept_stats = defaultdict(lambda: {"count": 0})

    for doc in query:
        data = doc.to_dict()
        uid = data.get("uid", "unknown")
        status = data.get("status", "").lower()

        user_info = users_dict.get(uid)
        if user_info and status == "present":
            dept = user_info["department"]
            dept_stats[dept]["count"] += 1

    department_map = {
        "Business Administration": {"acronym": "BA", "color": "#DFEA7A"},
        "Information Technology": {"acronym": "IT", "color": "#924FD1"},
        "Tourism Management": {"acronym": "TM", "color": "#FC81EC"},
        "Basic Education": {"acronym": "EDUC", "color": "#7AB4EA"},
        "Criminology": {"acronym": "CRIM", "color": "#7A7CEA"},
    }

    # Initialize all departments with 0 count if they don't exist
    for dept_name in department_map.keys():
        if dept_name not in dept_stats:
            dept_stats[dept_name] = {"count": 0}

    # Find max count for scaling
    max_count = max((stats["count"] for stats in dept_stats.values()), default=100)

    # Calculate Y-axis range and ticks
    if max_count <= 100:
        y_max = 100
        tick_interval = 20
    else:
        # Round up to nearest hundred
        y_max = ((max_count // 100) + 1) * 100
        tick_interval = y_max // 5

    ticks = list(range(0, y_max + 1, tick_interval))

    # Generate tick positions as percentages (0-100%) for grid lines
    tick_positions = [i * 20 for i in range(6)]  # [0, 20, 40, 60, 80, 100]

    dept_data = []

    # Loop through all departments in the map to ensure all are included
    for dept_code, dept_info in department_map.items():
        count = dept_stats.get(dept_code, {"count": 0})["count"]

        # Calculate height as percentage of y_max
        height = (count / y_max * 100) if y_max > 0 else 0

        dept_data.append(
            {
                "name": dept_info["acronym"],
                "class": dept_info["acronym"],
                "color": dept_info["color"],
                "rate": count,
                "height": height,
            }
        )

    # Sort by count descending
    sorted_depts = sorted(dept_data, key=lambda x: x["rate"], reverse=True)

    return {
        "all_departments": sorted_depts,
        "ticks": ticks,
        "tick_positions": tick_positions,
    }


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
