import logging
import json
import re
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.contrib.auth import get_user_model
from ..firebase_service import FirebaseService
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.core.mail import send_mail, EmailMessage
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache


User = get_user_model()
logger = logging.getLogger(__name__)


def validate_name_field(name, field_name):
    if not name or not name.strip():
        return True, None
    if not re.match(r"^[a-zA-ZÀ-ÿ\s'\-]+$", name.strip()):
        return (
            False,
            f"{field_name} should only contain letters, spaces, hyphens, and apostrophes",
        )

    return True, None


def send_app_link_via_email(
    recipient_email, app_link, user_name, password=None, employ_id=None
):
    try:
        if not recipient_email or not app_link:
            logger.info(
                "No recipient or app_link provided for send_app_link_via_email."
            )
            return False, "Missing recipient or app_link"

        subject = "Welcome to CSCQC App – Get Started"

        password_section = ""
        if password:
            password_section = f"\n\nYour temporary password is: {password}\nPlease change this password after your first login for security."

        employ_id_section = ""
        if employ_id:
            employ_id_section = f"\nEmployee ID: {employ_id}"

        body = (
            f"Hi {user_name},\n\n"
            f"Welcome to CSCQC App! Your account has been successfully created.\n\n"
            f"Download or access the application using the link below:\n"
            f"{app_link}\n"
            f"{password_section}\n\n"
            f"Login Credentials:\n"
            f"Email: {recipient_email}"
            f"{employ_id_section}\n\n"
            f"If you have any questions or need assistance, please contact our support team.\n\n"
            f"Best regards,\n"
            f"CSCQC Team"
        )

        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
            [recipient_email],
            fail_silently=False,
        )

        logger.info(f"Application link email sent to {recipient_email}")
        return True, None

    except Exception as e:
        logger.error(f"Error sending app link email to {recipient_email}: {e}")
        return False, str(e)


@method_decorator(csrf_exempt, name="dispatch")
class Register_View(View):
    def post(self, request):
        firebase_uid = None
        firebase_service = FirebaseService()
        try:
            data = json.loads(request.body)

            logger.info(f"🔥 Registration request received: {data}")

            required_fields = ["email", "first_name", "last_name"]

            for field in required_fields:
                if not data.get(field):
                    return JsonResponse({"error": f"{field} is required"}, status=400)

            name_validations = [
            ("first_name", "First name"),
            ("last_name", "Last name"),
            ("midName", "Middle name")
            ]

            for field_key, field_label in name_validations:
                if data.get(field_key):
                    is_valid, error_msg = validate_name_field(data.get(field_key), field_label)
                    if not is_valid:
                        return JsonResponse({"error": error_msg}, status=400)

            email = data["email"]

            logger.info("🎓 Creating Tertiary Faculty...")

            if firebase_service.check_email_exists(email):
                return JsonResponse(
                    {"error": "User already exists in firebase"}, status=400
                )

            if not data.get("password"):
                data["password"] = "cscqcApp123"

            if not data.get("employmentStatus"):
                return JsonResponse(
                    {"error": "Employment status is required for Tertiary Faculty"},
                    status=400,
                )

            employ_id = data.get("employID", "").strip()
            if employ_id:
                logger.info(f"🔍 Checking employID: {employ_id}")
                if firebase_service.check_employid_exists(employ_id):
                    return JsonResponse(
                        {
                            "success": False,
                            "error": "This Employee ID is already registered. Please use a different Employee ID.",
                        },
                        status=400,
                    )

            user_data = {
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "midName": data.get("midName", ""),
                "phoneNumber": data.get("phoneNumber", ""),
                "role": data.get("role", "user"),
                "department": data.get("department", "Basic Education"),
                "employmentStatus": data.get("employmentStatus", "Full-time"),
                "employID": employ_id,
                "userType": "TertiaryFaculty",
            }

            firebase_uid = firebase_service.create_firebase_user(
                email=data["email"], password=data["password"], user_data=user_data
            )

            logger.info(f"✅ Firebase user created: {firebase_uid}")

            created_user = firebase_service.get_user_by_id(firebase_uid)
            first_name = created_user.get("first_name", "")
            middle_name = created_user.get("midName", "")
            last_name = created_user.get("last_name", "")
            middle_initial = (
                f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
            )
            full_name = f"{first_name}{middle_initial} {last_name}".strip()

            app_link = data.get("app_link") or getattr(
                settings,
                "DEFAULT_APP_LINK",
                "https://drive.google.com/drive/folders/1yFMIRq_K4jC-ETnqq8VvDpQ1Nt2GwQad?usp=drive_link",
            )

            logger.info(
                f"📧 Sending welcome email to {created_user.get('email', email)}"
            )
            email_sent, email_error = send_app_link_via_email(
                recipient_email=created_user.get("email", email),
                app_link=app_link,
                user_name=full_name,
                password=data["password"],
                employ_id=employ_id,
            )

            response_payload = {
                "success": True,
                "message": "Tertiary Faculty created Successfully",
                "firebase_uid": firebase_uid,
                "user_id": firebase_uid,
                "full_name": full_name,
                "department": created_user.get("department", ""),
                "email": created_user.get("email", ""),
                "contact": created_user.get("phoneNumber", ""),
                "employmentStatus": created_user.get("employmentStatus", ""),
                "employID": created_user.get("employID", ""),
                "user_type": "TertiaryFaculty",
                "email_sent": email_sent,
            }
            if email_error:
                response_payload["email_error"] = email_error
                logger.warning(f"⚠️ Email sending failed: {email_error}")

            return JsonResponse(response_payload, status=201)

        except Exception as e:
            logger.error(f"❌ Registration error: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())

            if firebase_uid:
                try:
                    firebase_service.delete_firebase_user(firebase_uid)
                    logger.info("🧹 Firebase user cleaned up")
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup Firebase user: {cleanup_error}")

            return JsonResponse(
                {"success": False, "error": f"Registration failed: {str(e)}"},
                status=500,
            )


@never_cache
@login_required
def staff_tertiaryfaculty(request):
    try:
        print("\n" + "=" * 80)
        print("🔥 STAFF TERTIARY FACULTY VIEW CALLED")
        print(f"👤 User: {request.user.username if request.user else 'None'}")
        print(f"🔐 Is Staff: {request.user.is_staff if request.user else False}")
        print("=" * 80)

        firebase_service = FirebaseService()
        print("✅ FirebaseService initialized")

        professors = firebase_service.get_all_users()
        print(f"📊 Total professors fetched: {len(professors)}")

        if len(professors) == 0:
            print("⚠️ WARNING: No professors found in Firebase!")
        else:
            print(f"✅ Found {len(professors)} professors")

        processed_count = 0
        for professor in professors:
            
            if "uid" in professor and "id" not in professor:
                professor["id"] = professor["uid"]
            elif "id" in professor and "uid" not in professor:
                professor["uid"] = professor["id"]
            elif "uid" not in professor and "id" not in professor:
                
                print(
                    f"⚠️ Skipping professor with no ID: {professor.get('email', 'unknown')}"
                )
                continue

            
            if "full_name" not in professor:
                first_name = professor.get("firstName", "")
                middle_name = professor.get("midName", "")
                last_name = professor.get("lastName", "")

                middle_initial = (
                    f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
                )
                professor["full_name"] = (
                    f"{first_name}{middle_initial} {last_name}".strip()
                )

            
            if "contact_number" not in professor:
                professor["contact_number"] = professor.get("phoneNumber", "")

            
            if "employmentstatus" not in professor:
                professor["employmentstatus"] = professor.get(
                    "employmentStatus", "Full-time"
                )

            processed_count += 1

        print(f"✅ Processed {processed_count} professors")
        print("=" * 80 + "\n")

        context = {"professors": professors}

        return render(request, "staff/staff_tertiaryfaculty.html", context)

    except Exception as e:
        logger.error(f"❌ Error in staff_tertiaryfaculty view: {str(e)}")
        print(f"\n❌ EXCEPTION in staff_tertiaryfaculty view:")
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        print("=" * 80 + "\n")

        return render(request, "staff/staff_tertiaryfaculty.html", {"professors": []})


def staff_view(request):
    try:
        user_type_filter = request.GET.get("user_type", "TertiaryFaculty")

        all_users = []

        if user_type_filter in ["all", "TertiaryFaculty"]:
            firebase_service = FirebaseService()
            firebase_users = firebase_service.get_all_users()

            for user in firebase_users:
                first_name = user.get("firstName", "")
                middle_name = user.get("midName", "")
                last_name = user.get("lastName", "")
                middle_initial = (
                    f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
                )
                full_name = f"{first_name}{middle_initial} {last_name}".strip()

                all_users.append(
                    {
                        "id": user.get("uid") or user.get("id"),
                        "full_name": full_name,
                        "firstName": first_name,
                        "midName": middle_name,
                        "lastName": last_name,
                        "email": user.get("email", ""),
                        "phoneNumber": user.get("phoneNumber", ""),
                        "department": user.get("department", ""),
                        "employmentstatus": user.get("employmentStatus", "Full-time"),
                        "employID": user.get("employID", ""),
                        "user_type": "TertiaryFaculty",
                    }
                )

        context = {
            "professors": all_users,
            "filter_all": user_type_filter == "all",
            "filter_faculty": user_type_filter == "TertiaryFaculty",
            "filter_system": user_type_filter == "SystemUser",
            "current_filter": user_type_filter,
        }
        return render(request, "accounts.html", context)

    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        import traceback

        traceback.print_exc()
        return render(
            request,
            "accounts.html",
            {
                "professors": [],
                "filter_all": True,
                "filter_faculty": False,
                "filter_system": False,
            },
        )


def send_password_reset_email(email, full_name, new_password):
    try:
        subject = "Your Password Has Been Reset - CSCQC Attendance System"

        message = f"""
Hello {full_name},

Your password for the CSCQC Faculty Attendance System has been reset by an administrator.

🔐 Your New Login Credentials:
Email: {email}
Password: {new_password}

For security reasons, please change your password immediately after logging in.

📱 Access the System:
Mobile App: Log in using the CSCQC Attendance mobile application

If you did not request this password reset, please contact the IT department immediately.

Best regards,
CSCQC Administration Team
        """

        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        logger.info(f"✅ Password reset email sent to {email}")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to send password reset email to {email}: {str(e)}")
        return False


@require_POST
def staff_reset_password(request, pk):
    try:
        
        firebase_service = FirebaseService()
        result = firebase_service.reset_password_to_value(pk)

        
        user_data = firebase_service.get_user_by_id(pk)
        first_name = user_data.get("first_name", "")
        middle_name = user_data.get("midName", "")
        last_name = user_data.get("last_name", "")
        middle_initial = (
            f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
        )
        full_name = f"{first_name}{middle_initial} {last_name}".strip()

        
        new_password = "cscqcApp123"
        send_password_reset_email(result["email"], full_name, new_password)

        return JsonResponse(
            {
                "success": True,
                "message": f'Password reset for {result["email"]}. A notification email has been sent.',
                "email": result["email"],
            }
        )

    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_GET
def check_employid(request):
    try:
        employ_id = request.GET.get("employID", "").strip()
        exclude_uid = request.GET.get("excludeUid", "").strip()

        logger.info(
            f"🔍 Checking employID: '{employ_id}' (exclude: {exclude_uid or 'None'})"
        )

        if not employ_id:
            logger.info("   ✅ No employID provided - returning False")
            return JsonResponse({"exists": False, "message": "No employID provided"})

        firebase_service = FirebaseService()
        users_ref = firebase_service.db.collection("users")
        from google.cloud.firestore import FieldFilter

        query = users_ref.where(filter=FieldFilter("employID", "==", employ_id))
        docs = list(query.stream())

        if exclude_uid:
            docs = [doc for doc in docs if doc.id != exclude_uid]

        exists = len(docs) > 0

        logger.info(f"   {'❌ EXISTS' if exists else '✅ AVAILABLE'}: {employ_id}")

        return JsonResponse(
            {
                "exists": exists,
                "message": (
                    "EmployID already in use" if exists else "EmployID available"
                ),
            }
        )

    except Exception as error:
        logger.error(f"Error checking employID: {str(error)}")
        import traceback

        logger.error(traceback.format_exc())
        return JsonResponse({"exists": False, "error": str(error)}, status=500)
