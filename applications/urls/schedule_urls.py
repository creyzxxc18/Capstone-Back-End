from django.urls import path
from applications.views import schedule_views, semester_views


urlpatterns = [ 
    path('clear_all_classes_leave/', schedule_views.clear_all_classes_leave, name='clear_all_classes_leave'),
    path('clear_teacher_leave/', schedule_views.clear_teacher_leave, name='clear_teacher_leave'),
    path('faculty-attendance/remove_day_status/', schedule_views.remove_day_status, name='remove_day_status'),
    path('mark_compensated/', schedule_views.mark_compensated, name='mark_compensated'),


    path("faculty-attendance/", schedule_views.faculty_attendance, name="faculty_attendance"),
    path('validate_attendance/', schedule_views.validate_attendance, name='validate_attendance'),
    path('create_attendance/', schedule_views.create_attendance, name='create_attendance'),
    
    path('faculty-attendance/set_day_status/', schedule_views.set_day_status, name='set_day_status'),

    path('mark_teacher_leave/', schedule_views.mark_teacher_leave, name='mark_teacher_leave'),
    path('mark_all_classes_leave/', schedule_views.mark_all_classes_leave, name='mark_all_classes_leave'),

    path('get_day_status/', schedule_views.get_day_status, name='get_day_status'),
    path('faculty-attendance/get_month_statuses/', schedule_views.get_month_statuses, name='get_month_statuses'),
    path('get_daily_attendance_summary/', schedule_views.get_daily_attendance_summary, name='get_daily_attendance_summary'),
    path("get_schedules_by_month/", schedule_views.get_schedules_by_month, name="get_schedules_by_month"),
    path("get_schedules_by_date/", schedule_views.get_schedules_by_date, name="get_schedules_by_date"),
    path('get_attendance_by_class/', schedule_views.get_attendance_by_class, name='get_attendance_by_class'),
    path("faculty-attendance/get_classes_list/", semester_views.get_classes_list, name="get_classes_list"),
    path("faculty-attendance/get_user_profile/", semester_views.get_user_profile, name="get_user_profile"),
    
    #GET
    path("faculty-attendance/get_classes_list/", semester_views.get_classes_list, name="get_classes_list"),
    path("faculty-attendance/get_user_profile/", semester_views.get_user_profile, name="get_user_profile"),
    path("get_schedules_by_month/", schedule_views.get_schedules_by_month, name="get_schedules_by_month"),
    path("get_schedules_by_date/", schedule_views.get_schedules_by_date, name="get_schedules_by_date"),
    path('get_attendance_by_class/', schedule_views.get_attendance_by_class, name='get_attendance_by_class'),
    path('get_daily_attendance_summary/', schedule_views.get_daily_attendance_summary, name='get_daily_attendance_summary'),
    path('set_day_status/', schedule_views.set_day_status, name='set_day_status'),
    path('get_day_status/', schedule_views.get_day_status, name='get_day_status'),

    
]
