from django.urls import path
from .. import views

urlpatterns = [
    # ADMIN URLS
    path("dashboard/", views.dashboard_view, name="dashboard"),
    path("reports/", views.reports, name="reports"),
    path("redirect-after-login/", views.redirect_after_login, name="redirect_after_login"),
    path('get-login-redirect/', views.get_login_redirect, name='get_login_redirect'),
    path('get_attendance_report/', views.get_attendance_report, name='get_attendance_report'),
    path('get_professor_attendance_history/', views.get_professor_attendance_history, name='get_professor_attendance_history'),
    
    path('api/change-password-first-login/', views.ChangePasswordFirstLoginView.as_view(), name='api_change_password_first_login'),
    path('change-password-first-login/', views.change_password_first_login, name='change_password_first_login'),
    path("api/request-password-reset/", views.RequestPasswordResetView.as_view(), name="request_password_reset"),
    path("api/reset-password/", views.ResetPasswordView.as_view(), name="reset_password"),
]
