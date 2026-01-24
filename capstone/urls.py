from django.urls import path, include
from django.contrib import admin
from django.contrib.auth import views as auth_views
from applications.views.auth_views import CustomLoginRedirectView, redirect_after_login

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", redirect_after_login, name="home"),
    path("login/", CustomLoginRedirectView.as_view(), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("", include("applications.urls")),
]
