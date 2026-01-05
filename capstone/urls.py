from django.urls import path, include
from django.contrib import admin
from django.contrib.auth import views as auth_views
from applications.views.auth_views import CustomLoginRedirectView, redirect_after_login

urlpatterns = [
    path("admin/", admin.site.urls),
    # FIXED: root URL now redirects based on login + user role
    path("", redirect_after_login, name="home"),
    # Login page
    path("login/", CustomLoginRedirectView.as_view(), name="login"),
    # Logout
    path("logout/",auth_views.LogoutView.as_view(template_name="logged_out.html"),name="logout",),
    # App URLs
    path("", include("applications.urls")),
]
