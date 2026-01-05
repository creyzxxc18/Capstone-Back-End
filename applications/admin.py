from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Profile

User = get_user_model()


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    fields = ("userRole",)  


class CustomUserAdmin(UserAdmin):
    inlines = (ProfileInline,)

    list_display = (
        "employId",
        "email",
        "first_name",
        "last_name",
        "user_role",
        "is_staff",
        "is_active",
    )
    list_filter = ("is_staff", "is_active", "employId")
    search_fields = ("email", "first_name", "last_name", "employId")
    ordering = ("email",)

    
    fieldsets = (
        (None, {"fields": ("username", "email", "password", "employId")}),
        (
            "Personal Info",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "midName",
                    "phoneNumber",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
        ("Firebase", {"fields": ("firebase_uid",), "classes": ("collapse",)}),
    )

    
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2"),
            },
        ),
        (
            "Personal Info",
            {"fields": ("first_name", "last_name", "midName", "phoneNumber")},
        ),
        (
            "Permissions",
            {"fields": ("is_staff", "is_active")},
        ),
    )

    def user_role(self, obj):
        try:
            if hasattr(obj, "profile"):
                return obj.profile.userRole  
            return "-"
        except Profile.DoesNotExist:
            return "No Profile"

    user_role.short_description = "User Role"

admin.site.register(CustomUser, CustomUserAdmin)
