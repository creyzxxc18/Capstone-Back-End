import json, logging
from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse
from django.views import View
from django.shortcuts import redirect, render
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model, login
from ..firebase_service import FirebaseService
from django.urls import reverse_lazy
from django.contrib.auth.views import LoginView
from django.core.mail import send_mail
from django.conf import settings
from django.contrib import messages

User = get_user_model()
logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class RegisterView(View):
    def post(self, request):
        firebase_uid = None
        try:
            data = json.loads(request.body)
            required_fields = ["email", "password", "first_name", "last_name"]

            for field in required_fields:
                if not data.get(field):
                    return JsonResponse({"error": f"{field} is required"}, status=400)

            if User.objects.filter(email=data["email"]).exists():
                return JsonResponse({"error": "User already exists"}, status=400)

            firebase_service = FirebaseService()
            user_data = {
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "midName": data.get("midName", ""),
                "phoneNumber": data.get("phoneNumber", ""),
                "role": data.get("role", "user"),
                "department": data.get("department", "Basic Education"),
            }

            firebase_uid = firebase_service.create_firebase_user(
                email=data["email"], password=data["password"], user_data=user_data
            )

            created_user = firebase_service.get_user_by_id(firebase_uid)
            full_name = f"{created_user.get('first_name', '')} {created_user.get('last_name', '')}"

            return JsonResponse(
                {
                    "success": True,
                    "message": "User created Successfully",
                    "firebase_uid": firebase_uid,
                    "user_id": firebase_uid,
                    "full_name": full_name,
                    "department": created_user.get("department", ""),
                    "email": created_user.get("email", ""),
                    "contact": created_user.get("phoneNumber", ""),
                },
                status=201,
            )

        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            if firebase_uid:
                try:
                    firebase_service.delete_firebase_user(firebase_uid)
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup Firebase user: {cleanup_error}")
            return JsonResponse(
                {"success": False, "error": "Registration failed"}, status=500
            )


class CustomLoginRedirectView(LoginView):
    template_name = "login.html"

    def dispatch(self, request, *args, **kwargs):
        if request.method == "POST":
            username = request.POST.get("username", "")

            
            lockout_key = f"lockout_{username}"
            attempts_key = f"attempts_{username}"

            lockout_until = request.session.get(lockout_key)

            if lockout_until:
                lockout_time = timezone.datetime.fromisoformat(lockout_until)
                if timezone.now() < lockout_time:
                    remaining = (lockout_time - timezone.now()).total_seconds() / 60
                    messages.error(
                        request,
                        f"Too many failed attempts. Please try again in {int(remaining)} minutes.",
                    )
                    return self.render_to_response(self.get_context_data())
                else:
                    
                    request.session.pop(lockout_key, None)
                    request.session.pop(attempts_key, None)

        return super().dispatch(request, *args, **kwargs)

    def form_invalid(self, form):
        username = self.request.POST.get("username", "")
        attempts_key = f"attempts_{username}"
        lockout_key = f"lockout_{username}"
        
        attempts = self.request.session.get(attempts_key, 0) + 1
        self.request.session[attempts_key] = attempts

        
        if attempts >= 5:
            lockout_until = timezone.now() + timedelta(minutes=15)
            self.request.session[lockout_key] = lockout_until.isoformat()
            messages.error(
                self.request,
                "🚫Too many failed login attempts. Your account has been locked for 15 minutes.",
            )
            logger.warning(
                f"🔒Account locked for user: {username} after {attempts} failed attempts"
            )
        else:
            remaining_attempts = 5 - attempts
            messages.error(
                self.request,
                f"⚠️Invalid email or password. {remaining_attempts} attempt(s) remaining.",
            )
        return super().form_invalid(form)

    def form_valid(self, form):
        username = self.request.POST.get("username", "")
        attempts_key = f"attempts_{username}"
        lockout_key = f"lockout_{username}"

        
        self.request.session.pop(attempts_key, None)
        self.request.session.pop(lockout_key, None)

        user = form.get_user()
        login(self.request, user)

        remember_me = self.request.POST.get("remember-me")
        if remember_me:
            self.request.session.set_expiry(60 * 60 * 24 * 7)
        else:
            self.request.session.set_expiry(0)

        self.request.session["login_success"] = True
        self.request.session["redirect_to"] = str(self.get_success_url())

        return redirect("login")

    def get_success_url(self):
        user = self.request.user
        
        if user.isFirstLogin:
            return reverse_lazy("login")  
        
        if user.is_superuser:
            return reverse_lazy("dashboard")
        try:
            from applications.models import Profile
            role = Profile.objects.get(user=user).userRole.lower()
            if role == "admin":
                return reverse_lazy("dashboard")
            if role in ["staff", "staff/checker"]:
                return reverse_lazy("staff_home")
        except Profile.DoesNotExist:
            pass

        if user.is_staff:
            return reverse_lazy("staff_home")

        return reverse_lazy("staff_home")

@login_required
def redirect_after_login(request):
    user = request.user
    if user.is_superuser:
        return redirect("dashboard")
    try:
        from applications.models import Profile
        role = Profile.objects.get(user=user).userRole.lower()
        if role == "admin":
            return redirect("dashboard")

        if role in ["staff", "staff/checker"]:
            return redirect("staff_home")

    except Profile.DoesNotExist:
        pass

    if user.is_staff:
        return redirect("staff_home")

    return redirect("staff_home")


@login_required
def check_first_login(request):
    user = request.user
    try:
        return JsonResponse(
            {
                "success": True,
                "isFirstLogin": user.isFirstLogin,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            status=200,
        )
    except Exception as e:
        logger.error(f"Error checking first login status: {str(e)}")
        return JsonResponse(
            {"success": False, "error": "Failed to check first login status"},
            status=500,
        )


@login_required
def change_password_first_login(request):
    user = request.user

    if not user.isFirstLogin:
        logger.info(f"User {user.email} is not on first login, redirecting")
        return redirect("redirect_after_login")

    context = {
        "user": user,
        "isFirstLogin": False,
    }

    return render(request, "login.html", context)


@method_decorator(login_required, name="dispatch")
class ChangePasswordFirstLoginView(View):
    def get(self, request):
        user = request.user
        try:
            return JsonResponse(
                {
                    "success": True,
                    "showPasswordChangePopup": user.isFirstLogin,
                    "message": "Please change your password to continue",
                },
                status=200,
            )
        except Exception as e:
            logger.error(f"Error in first login check: {str(e)}")
            return JsonResponse(
                {
                    "success": False,
                    "error": "Error checking password change requirement",
                },
                status=500,
            )

    def post(self, request):
        user = request.user

        try:
            data = json.loads(request.body)
            new_password = data.get("new_password")
            confirm_password = data.get("confirm_password")

            if not new_password or not confirm_password:
                return JsonResponse(
                    {
                        "success": False,
                        "error": "New password and confirmation are required",
                    },
                    status=400,
                )

            if new_password != confirm_password:
                return JsonResponse(
                    {"success": False, "error": "Passwords do not match"}, status=400
                )

            if len(new_password) < 8:
                return JsonResponse(
                    {
                        "success": False,
                        "error": "Password must be at least 8 characters long",
                    },
                    status=400,
                )

            if user.check_password(new_password):
                return JsonResponse(
                    {
                        "success": False,
                        "error": "New password cannot be the same as current password",
                    },
                    status=400,
                )

            user.set_password(new_password)
            user.isFirstLogin = False
            user.save()

            logger.info(
                f"Password changed successfully for user on first login: {user.email}"
            )

            return JsonResponse(
                {
                    "success": True,
                    "message": "Password changed successfully",
                    "isFirstLogin": False,
                },
                status=200,
            )

        except json.JSONDecodeError:
            logger.error("Invalid JSON in password change request")
            return JsonResponse(
                {"success": False, "error": "Invalid request format"}, status=400
            )
        except Exception as e:
            logger.error(f"Error changing password on first login: {str(e)}")
            return JsonResponse(
                {"success": False, "error": "Failed to change password"}, status=500
            )


@method_decorator(login_required, name="dispatch")
class SkipPasswordChangeFirstLoginView(View):
    def post(self, request):
        user = request.user

        try:
            if not user.isFirstLogin:
                return JsonResponse(
                    {"success": False, "error": "User is not on first login"},
                    status=400,
                )

            user.isFirstLogin = False
            user.save()

            logger.warning(f"User {user.email} skipped password change on first login")

            return JsonResponse(
                {
                    "success": True,
                    "message": "Password change skipped",
                    "isFirstLogin": False,
                },
                status=200,
            )

        except Exception as e:
            logger.error(f"Error skipping password change: {str(e)}")
            return JsonResponse(
                {"success": False, "error": "Failed to skip password change"},
                status=500,
            )


class RequestPasswordResetView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get("email")

            if not email:
                return JsonResponse(
                    {"success": False, "error": "Email is required"}, status=400
                )

            User = get_user_model()
            if not User.objects.filter(email=email).exists():
                return JsonResponse(
                    {"success": False, "error": "Email not found"}, status=404
                )

            
            reset_link = f"{settings.SITE_URL}/login/?reset_email={email}"

            send_mail(
                subject="CSCQC Password Reset",
                message=(
                    "We received a request to reset your password.\n\n"
                    f"Click the link below to set a new password:\n{reset_link}\n\n"
                    "If you did not request this, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )

            return JsonResponse({"success": True})

        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=500)


class ResetPasswordView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            email = data.get("email")
            new_password = data.get("new_password")

            User = get_user_model()
            user = User.objects.get(email=email)

            
            if user.check_password(new_password):
                return JsonResponse(
                    {
                        "success": False,
                        "error": "New password cannot be the same as your current password.",
                    },
                    status=400,
                )

            
            if len(new_password) < 8:
                return JsonResponse(
                    {
                        "success": False,
                        "error": "Password must be at least 8 characters.",
                    },
                    status=400,
                )

            user.set_password(new_password)
            user.save()

            return JsonResponse({"success": True})

        except User.DoesNotExist:
            return JsonResponse(
                {"success": False, "error": "Invalid email"}, status=404
            )
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=500)


@method_decorator(login_required, name="dispatch")
class ChangePasswordView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            current_password = data.get("current_password")
            new_password = data.get("new_password")
            confirm_password = data.get("confirm_password")

            user = request.user

            
            if not user.check_password(current_password):
                return JsonResponse(
                    {"success": False, "error": "Incorrect current password"},
                    status=400,
                )

            
            if user.check_password(new_password):
                return JsonResponse(
                    {
                        "success": False,
                        "error": "New password cannot be the same as the current password",
                    },
                    status=400,
                )

            if new_password != confirm_password:
                return JsonResponse(
                    {"success": False, "error": "Passwords do not match"}, status=400
                )

            if len(new_password) < 8:
                return JsonResponse(
                    {
                        "success": False,
                        "error": "Password must be at least 8 characters long",
                    },
                    status=400,
                )

            user.set_password(new_password)
            user.save()

            return JsonResponse({"success": True})

        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=500)


@login_required
def get_login_redirect(request):
    login_success = request.session.get("login_success", False)

    if login_success:
        redirect_to = request.session.get("redirect_to", "/dashboard/")
        
        request.session.pop("login_success", None)
        request.session.pop("redirect_to", None)
        return JsonResponse({"redirect_to": redirect_to})
    else:
        return JsonResponse({"redirect_to": None})
