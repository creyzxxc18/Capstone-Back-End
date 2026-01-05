from django.urls import path
from .. import views
from ..views import Register_View
from applications.views import schedule_views, semester_views, accounts_views

urlpatterns = [
    #Staff Urls
    path("staff_home/", views.staff_home, name="staff_home"),
    path("staff_dashboard/", views.staff_dashboard_view, name="staff_dashboard"),
    path("staff_addsub/", views.staff_addsub_view, name="staff_addsub"),
    path("staff_scheduling/", views.staff_scheduling, name="staff_scheduling"),
    path("staff_tertiaryfaculty/", views.staff_tertiaryfaculty, name="staff_tertiaryfaculty"),
    path("staff_schoolyear/", views.staff_school_year_view, name="staff_school_year"),
    
    #Staff Reset Password Url
    path("staff_tertiaryfaculty/accounts/accounts/reset-password/<str:pk>/", views.staff_reset_password,name="staff_reset_password",),
    path('staff_tertiaryfaculty/accounts/accounts/check-employid/', accounts_views.check_employid, name='check_employid'),
    path("staff_tertiaryfaculty/accounts/register/", Register_View.as_view(), name="register"),
    path('accounts/check-name/', views.check_name, name='check_name'),
    path("accounts/check-email/", views.check_email, name="check_email"),
    #Staff Add Subject Urls
    path("staff_addsub/get_classes_list/", views.get_classes_list, name="get_classes_list"),
    path("staff_addsub/import_class_excel/", views.import_class_excel, name="import_class_excel"),
    path("staff_addsub/staff_addsub/delete_course/<str:class_id>/", views.delete_course, name="delete_course"),
    path("staff_addsub/staff_addsub/staff_addsub/delete_course/<str:class_id>/", views.delete_course, name="delete_course"),
    path("staff_addsub/staff_addsub/update_class/<str:class_id>/", views.update_class, name="update_class"),
    path('staff_addsub/staff_addsub/schedules/get_classes_list/', views.get_classes_list, name='get_classes_list'),
    path('staff_addsub/staff_addsub/import_all_teachers_excel/', views.import_all_teachers_excel, name='import_all_teachers_excel'),
    path("staff_addsub/staff_addsub/add_class/", views.add_class, name="add_class"),
    
    #Faculty Scheduling and Validation Urls
    path('staff_scheduling/staff_scheduling/create_attendance/', schedule_views.create_attendance, name='create_attendance'),
    path('staff_scheduling/staff_scheduling/validate_attendance/', schedule_views.validate_attendance, name='validate_attendance'),
    path('staff_scheduling/staff_scheduling/get_month_statuses/', schedule_views.get_month_statuses, name='get_month_statuses'),
    path('staff_scheduling/staff_scheduling/remove_day_status/', schedule_views.remove_day_status, name='remove_day_status'),
    path('staff_scheduling/staff_scheduling/mark_teacher_leave/', schedule_views.mark_teacher_leave, name='mark_teacher_leave'),
    path('staff_scheduling/staff_scheduling/clear_teacher_leave/', schedule_views.clear_teacher_leave, name='clear_teacher_leave'),
    path('staff_scheduling/staff_scheduling/mark_all_classes_leave/', schedule_views.mark_all_classes_leave, name='mark_all_classes_leave'),
    path('staff_scheduling/staff_scheduling/clear_all_classes_leave/', schedule_views.clear_all_classes_leave, name='clear_all_classes_leave'),
    
    path("staff_scheduling/staff_scheduling/get_classes_list/", semester_views.get_classes_list, name="get_classes_list"),
    path("staff_scheduling/staff_scheduling/get_user_profile/", semester_views.get_user_profile, name="get_user_profile"),
    path("staff_scheduling/staff_scheduling/get_schedules_by_month/", schedule_views.get_schedules_by_month, name="get_schedules_by_month"),
    path("staff_scheduling/staff_scheduling/get_schedules_by_date/", schedule_views.get_schedules_by_date, name="get_schedules_by_date"),
    path('staff_scheduling/staff_scheduling/get_attendance_by_class/', schedule_views.get_attendance_by_class, name='get_attendance_by_class'),
    path('staff_scheduling/staff_scheduling/get_daily_attendance_summary/', schedule_views.get_daily_attendance_summary, name='get_daily_attendance_summary'),
    path('staff_scheduling/staff_scheduling/set_day_status/', schedule_views.set_day_status, name='set_day_status'),
    path('staff_scheduling/staff_scheduling/get_day_status/', schedule_views.get_day_status, name='get_day_status'),
    path('mark_compensated/', schedule_views.mark_compensated, name='mark_compensated'),
    
    path("schoolyear/", views.staff_school_year_view, name="staff_school_year_view"),
    path("toggle_user_access/", views.toggle_user_access, name="toggle_user_access"),
]