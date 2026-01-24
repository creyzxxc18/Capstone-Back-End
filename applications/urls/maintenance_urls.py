from django.urls import path
from applications.views import accounts_views, schoolyear_views, semester_views
from .. import views
from ..views import RegisterView


urlpatterns = [
    # Maintenance - ACCOUNTS URL
    path("accounts/register/", RegisterView.as_view(), name="register"),
    path("accounts/", views.accounts, name="accounts"),
    path("accounts/delete-user/<str:pk>/", views.delete_user, name="delete_user"),
    path("accounts/reset-password/<str:pk>/", views.reset_password,name="reset_password",),
    path("accounts/update-professor/<str:pk>/", views.update_professor, name="update_professor"),
    path('accounts/check-employid/', accounts_views.check_employid, name='check_employid'),
    path('accounts/import-users-excel/', views.import_user_excel, name='import_user_excel'),
    path('accounts/check-name/', views.check_name, name='check_name'),
    path("accounts/check-email/", views.check_email, name="check_email"),
    path('accounts/unlock-account/<str:pk>/', views.unlock_account, name='unlock_account'),


    # Maintenance - SEMESTER URLS
    path("semester/", semester_views.semester_view, name="semester_view"),
    path("semester/maintenance/semester/add_class/", semester_views.add_class, name="add_class"),
    path("import_class_excel/", semester_views.import_class_excel, name="import_class_excel"),
    path("semester/maintenance/delete_course/<str:class_id>/", semester_views.delete_course, name="delete_course"),
    path("semester/maintenance/update_class/<str:class_id>/", semester_views.update_class, name="update_class"),
    path('semester/maintenance/import_all_teachers_excel/', views.import_all_teachers_excel, name='import_all_teachers_excel'),
    path('semester/schedules/get_classes_list/', semester_views.get_classes_list, name='get_classes_list'),
    path('semester/create_qr_code/', semester_views.create_qr_class_code, name="create_qr_class_code"),

    # Maintenance - SCHOOL YEAR URLS
    path("schoolyear/", views.school_year_view, name="school_year_view"),
    path("toggle_user_access/", views.toggle_user_access, name="toggle_user_access"),
    path('get_archived_user_report/', schoolyear_views.get_archived_user_report, name='get_archived_user_report'),
]
