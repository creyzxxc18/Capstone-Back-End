import logging
import json
import openpyxl
import re
from io import BytesIO
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from ..firebase_service import FirebaseService
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.decorators import login_required


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
class RegisterView(View):
    def post(self, request):
        firebase_uid = None
        firebase_service = FirebaseService()

        try:
            data = json.loads(request.body)
            logger.info(f"🔥 Registration request received: {data}")

            required_fields = ["email", "first_name", "last_name", "user_type"]
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

            email = data["email"].strip().lower()

            email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
            if not re.match(email_regex, email):
                return JsonResponse(
                    {"error": "Invalid email format"},
                    status=400
                    )

            user_type = data.get("user_type")
            email = data["email"]

            if User.objects.filter(email=email).exists():
                return JsonResponse(
                    {"error": "User already exists in system"}, status=400
                )

            if firebase_service.check_email_exists(email):
                return JsonResponse(
                    {"error": "User already exists in firebase"}, status=400
                )

            if user_type == "SystemUser":
                logger.info("🔧 Creating System User...")

                user_role = data.get("userRole", "staff/checker")

                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password="cscqcSys123",
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    midName=data.get("midName", ""),
                    phoneNumber=data.get("phoneNumber", ""),
                    employId=data.get("employID", ""),
                )

                if user_role == "admin":
                    user.is_staff = True
                    user.is_superuser = True
                else:
                    user.is_staff = True
                    user.is_superuser = False  

                user.isFirstLogin = True
                user.save()
                logger.info(f"✅ Django user created: {user.id} with role {user_role}")

                from applications.models import Profile

                profile, created = Profile.objects.get_or_create(user=user)
                profile.userRole = user_role
                profile.save()

                m = data.get("midName", "")
                mi = f" {m[0]}." if m.strip() else ""
                full_name = f"{data['first_name']}{mi} {data['last_name']}".strip()

                return JsonResponse(
                    {
                        "success": True,
                        "message": "System User created Successfully",
                        "user_id": user.id,
                        "full_name": full_name,
                        "email": user.email,
                        "contact": user.phoneNumber,
                        "employId": user.employId,
                        "user_type": "SystemUser",
                        "first_login": True,
                    },
                    status=201,
                )

            elif user_type == "TertiaryFaculty":
                logger.info("🎓 Creating Tertiary Faculty...")

                if not data.get("password"):
                    data["password"] = "cscqcApp123"

                if not data.get("employmentStatus"):
                    return JsonResponse(
                        {"error": "Employment status is required for Tertiary Faculty"},
                        status=400,
                    )

                employ_id = data.get("employID", "").strip()
                if employ_id:
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

                created_user = firebase_service.get_user_by_id(firebase_uid)

                m = created_user.get("midName", "")
                mi = f" {m[0]}." if m.strip() else ""
                full_name = f"{created_user.get('first_name', '')}{mi} {created_user.get('last_name', '')}".strip()

                app_link = data.get("app_link") or getattr(
                    settings,
                    "DEFAULT_APP_LINK",
                    "https://drive.google.com/drive/folders/1yFMIRq_K4jC-ETnqq8VvDpQ1Nt2GwQad?usp=drive_link",
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

                return JsonResponse(response_payload, status=201)

            else:
                return JsonResponse({"error": "Invalid user type"}, status=400)

        except Exception as e:
            logger.error(f"❌ Registration error: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())

            if firebase_uid:
                try:
                    firebase_service.delete_firebase_user(firebase_uid)
                except:
                    pass

            return JsonResponse(
                {"success": False, "error": f"Registration failed: {str(e)}"},
                status=500,
            )


@login_required
@never_cache
def accounts(request):
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

        if user_type_filter in ["all", "SystemUser"]:
            django_users = User.objects.all()

            for user in django_users:
                first_name = user.first_name
                middle_name = user.midName
                last_name = user.last_name
                middle_initial = (
                    f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
                )
                full_name = f"{first_name}{middle_initial} {last_name}".strip()

                try:
                    from applications.models import Profile

                    profile = Profile.objects.get(user=user)
                    user_role = profile.userRole
                except Profile.DoesNotExist:
                    user_role = "staff"  
                except Exception as e:
                    logger.warning(f"Error getting profile for user {user.id}: {e}")
                    user_role = "staff"

                all_users.append(
                    {
                        "id": f"django_{user.id}",
                        "django_id": user.id,
                        "full_name": full_name,
                        "firstName": first_name,
                        "midName": middle_name,
                        "lastName": last_name,
                        "email": user.email,
                        "phoneNumber": user.phoneNumber,
                        "userRole": user_role,
                        "employID": user.employId,
                        "user_type": "SystemUser",
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


@require_POST
def delete_user(request, pk):
    deleted_records = {
        "attendance_records": 0,
        "classes": 0,
        "schedules": 0,
        "user": False,
    }

    try:
        firebase_service = FirebaseService()
        
        if pk.startswith("django_"):
            django_id = int(pk.replace("django_", ""))
            try:
                user = User.objects.get(id=django_id)
                user_email = user.email
                user.delete()

                deleted_records["user"] = True
                logger.info(f"✅ Django user deleted: {user_email}")

            except User.DoesNotExist:
                logger.warning(f"⚠️ Django user not found: {pk}")

            return JsonResponse(
                {
                    "success": True,
                    "message": "System User deleted",
                    "deleted_records": deleted_records,
                }
            )

        logger.info(f"🗑️ Deleting Firebase user and related records: {pk}")
        
        try:
            attendance_ref = firebase_service.db.collection("attendance")
            from google.cloud.firestore import FieldFilter

            docs = []

            query_t = attendance_ref.where(
                filter=FieldFilter("teacherUid", "==", pk)
            ).stream()
            query_p = attendance_ref.where(
                filter=FieldFilter("professorUid", "==", pk)
            ).stream()

            docs = list(query_t) + list(query_p)

            for doc in docs:
                doc.reference.delete()
                deleted_records["attendance_records"] += 1

            logger.info(
                f"✅ Deleted {deleted_records['attendance_records']} attendance records"
            )

        except Exception as e:
            logger.error(f"⚠️ Error deleting attendance: {e}")

        
        try:
            classes_ref = firebase_service.db.collection("classes")
            query_t = classes_ref.where(
                filter=FieldFilter("teacherUid", "==", pk)
            ).stream()
            query_p = classes_ref.where(
                filter=FieldFilter("professorUid", "==", pk)
            ).stream()

            docs = list(query_t) + list(query_p)

            for doc in docs:
                doc.reference.delete()
                deleted_records["classes"] += 1

            logger.info(f"✅ Deleted {deleted_records['classes']} classes")

        except Exception as e:
            logger.error(f"⚠️ Error deleting classes: {e}")

        
        try:
            schedules_ref = firebase_service.db.collection("schedules")
            query_t = schedules_ref.where(
                filter=FieldFilter("teacherUid", "==", pk)
            ).stream()
            query_p = schedules_ref.where(
                filter=FieldFilter("professorUid", "==", pk)
            ).stream()

            docs = list(query_t) + list(query_p)

            for doc in docs:
                doc.reference.delete()
                deleted_records["schedules"] += 1

            logger.info(f"✅ Deleted {deleted_records['schedules']} schedules")

        except Exception as e:
            logger.error(f"⚠️ Error deleting schedules: {e}")
        
        try:
            
            try:
                firebase_service.get_user_by_id(pk)
                exists = True
            except Exception:
                exists = False

            if exists:
                firebase_service.delete_firebase_user(pk)
                deleted_records["user"] = True
                logger.info(f"✅ Deleted Firebase Auth user: {pk}")
            else:
                logger.warning(
                    f"⚠️ Firebase Auth user not found for {pk}, skipping Auth deletion"
                )

        except Exception as e:
            logger.warning(f"⚠️ Error deleting Firebase Auth user: {e}")
            

        return JsonResponse(
            {
                "success": True,
                "message": "User and related records deleted successfully",
                "deleted_records": deleted_records,
            }
        )

    except Exception as e:
        logger.error(f"❌ Fatal error deleting user: {e}")
        return JsonResponse(
            {"success": False, "error": str(e), "deleted_records": deleted_records},
            status=500,
        )


def send_password_reset_email(email, full_name, new_password):
    try:
        subject = "Your Password Has Been Reset - CSCQC Attendance System"

        message = f"""
Hello User,

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
def reset_password(request, pk):
    try:
        
        current_user = request.user
        try:
            from applications.models import Profile

            profile = Profile.objects.get(user=current_user)
            current_role = profile.userRole
        except Profile.DoesNotExist:
            current_role = "admin" if current_user.is_superuser else "staff"

        logger.info(f"Password reset request for {pk} by {current_role}")

        clean_pk = pk.strip().replace("/", "")

        if clean_pk.startswith("django_"):
            django_id = int(clean_pk.replace("django_", ""))

            try:
                user = User.objects.get(id=django_id)
            except User.DoesNotExist:
                return JsonResponse(
                    {"success": False, "error": f"System User {clean_pk} not found"},
                    status=404,
                )
            
            if current_role != "admin" and not current_user.is_superuser:
                return JsonResponse(
                    {
                        "success": False,
                        "error": "Permission denied. Only admin can reset system users.",
                    },
                    status=403,
                )

            new_password = "cscqcSys123"
            user.set_password(new_password)
            
            user.isFirstLogin = True
            user.save()
            return JsonResponse(
                {
                    "success": True,
                    "message": f"Password reset for system user {user.email}",
                    "email": user.email,
                }
            )

        firebase_service = FirebaseService()
        
        result = firebase_service.reset_password_to_value(pk)
        user_data = firebase_service.get_user_by_id(pk)

        first_name = user_data.get("first_name", "")
        middle_name = user_data.get("midName", "")
        last_name = user_data.get("last_name", "")

        middle_initial = f" {middle_name[0]}." if middle_name else ""
        full_name = f"{first_name}{middle_initial} {last_name}".strip()

        new_password = "cscqcApp123"

        send_password_reset_email(result["email"], full_name, new_password)

        return JsonResponse(
            {
                "success": True,
                "message": f"Password reset for {result['email']}. Email sent.",
                "email": result["email"],
            }
        )

    except Exception as e:
        logger.error(f"Password reset error: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_POST
def update_professor(request, pk):
    try:
        data = json.loads(request.body)
        name_validations = [
            ("first_name", "First name"),
            ("last_name", "Last name"),
            ("midName", "Middle name"),
        ]

        for field_key, field_label in name_validations:
            if data.get(field_key):
                is_valid, error_msg = validate_name_field(
                    data.get(field_key), field_label
                )
                if not is_valid:
                    return JsonResponse({"error": error_msg}, status=400)

        if pk.startswith("django_"):
            django_id = int(pk.replace("django_", ""))
            user = User.objects.get(id=django_id)
            user.first_name = data.get("first_name")
            user.last_name = data.get("last_name")
            user.midName = data.get("midName", "")
            user.phoneNumber = data.get("phoneNumber")

            dept_map = {
                "Information Technology": "IT",
                "Business Administration": "BA",
                "Tourism": "TM",
                "Basic Education": "BE",
                "Criminology": "CRM",
            }
            department = data.get("department")
            user.department = dept_map.get(department, "BE")
            user.save()
        else:
            firebase_service = FirebaseService()
            user_data = {
                "first_name": data.get("first_name"),
                "last_name": data.get("last_name"),
                "midName": data.get("midName", ""),
                "phoneNumber": data.get("phoneNumber"),
                "department": data.get("department"),
                "employmentStatus": data.get("employmentStatus"),
                "employID": data.get("employID"),
            }
            firebase_service.update_firebase_user(pk, user_data)

        return JsonResponse({"success": True, "message": "User updated successfully"})
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_GET
def check_employid(request):
    try:
        employ_id = request.GET.get("employID", "").strip()
        exclude_uid = request.GET.get("excludeUid", "").strip()

        logger.info(
            f"🔍 Checking employID globally: '{employ_id}' (exclude: {exclude_uid or 'None'})"
        )

        if not employ_id:
            return JsonResponse({
                "exists": False,
                "message": "No employID provided"
            })

        firebase_service = FirebaseService()
        exists = False  

        django_qs = User.objects.filter(employId=employ_id)
        if exclude_uid.startswith("django_"):
            try:
                django_exclude_id = int(exclude_uid.replace("django_", ""))
                django_qs = django_qs.exclude(id=django_exclude_id)
            except:
                pass

        if django_qs.exists():
            exists = True

        try:
            from google.cloud.firestore import FieldFilter

            users_ref = firebase_service.db.collection("users")
            query = users_ref.where(filter=FieldFilter("employID", "==", employ_id))
            docs = list(query.stream())

            
            if exclude_uid and not exclude_uid.startswith("django_"):
                docs = [doc for doc in docs if doc.id != exclude_uid]

            if len(docs) > 0:
                exists = True

        except Exception as e:
            logger.error(f"Error checking Firebase employID: {e}")

        return JsonResponse({
            "exists": exists,
            "message": (
                "This employee ID exists in system user or tertiary faculty"
                if exists else
                "EmployID available"
            )
        })

    except Exception as error:
        logger.error(f"❌ Global employID check failed: {error}")
        return JsonResponse({"exists": False, "error": str(error)}, status=500)


@login_required
@require_POST
def import_user_excel(request):
    try:
        if "file" not in request.FILES:
            return JsonResponse({"error": "No file uploaded"}, status=400)

        excel_file = request.FILES["file"]

        
        wb = openpyxl.load_workbook(filename=BytesIO(excel_file.read()), data_only=True)
        sheet = wb.active

        user_list = []

        
        for row_num, row in enumerate(
            sheet.iter_rows(min_row=3, values_only=True), start=3
        ):
            if not row or not row[1] or not row[2] or not row[3]:
                
                continue

            email = str(row[2]).strip()
            firstName = str(row[3]).strip()
            lastName = str(row[4]).strip()

            
            if "@" not in email:
                logger.warning(f"Row {row_num}: Invalid email format: {email}")
                continue

            user_data = {
                "employID": str(row[1]).strip() if len(row) > 1 and row[1] else "",
                "email": email,
                "firstName": firstName,
                "lastName": lastName,
                "midName": str(row[5]).strip() if len(row) > 5 and row[5] else "",
                "phoneNumber": str(row[6]).strip() if len(row) > 6 and row[6] else "",
                "department": (
                    str(row[7]).strip() if len(row) > 7 and row[7] else "Tertiary"
                ),
                "employmentStatus": (
                    str(row[8]).strip() if len(row) > 8 and row[8] else "Full-time"
                ),
                "password": "cscqcApp123",
                "role": "user",
            }

            user_list.append(user_data)

        if not user_list:
            return JsonResponse(
                {"error": "No valid users found in Excel file"}, status=400
            )

        
        firebase_service = FirebaseService()
        result = firebase_service.bulk_create_users(user_list)

        
        message_parts = []
        if result["count"] > 0:
            message_parts.append(f"{result['count']} users imported successfully")

        if result.get("skipped_count", 0) > 0:
            message_parts.append(
                f"{result['skipped_count']} users skipped (already exist or errors)"
            )

        message = ". ".join(message_parts)

        return JsonResponse(
            {
                "success": True,
                "message": message,
                "users": result["users"],
                "skipped": result.get("skipped", []),
                "imported_count": result["count"],
                "skipped_count": result.get("skipped_count", 0),
            }
        )

    except Exception as e:
        logger.error(f"Error importing Excel users: {str(e)}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_GET
def check_name(request):
    try:
        first_name = request.GET.get("firstName", "").strip()
        last_name = request.GET.get("lastName", "").strip()
        exclude_uid = request.GET.get("excludeUid", "").strip()

        logger.info(
            f"🔍 Checking name combination: '{first_name} {last_name}' (exclude: {exclude_uid or 'None'})"
        )

        if not first_name or not last_name:
            return JsonResponse({
                "exists": False,
                "message": "First name and last name required"
            })

        firebase_service = FirebaseService()
        exists = False

        django_qs = User.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name
        )

        if exclude_uid.startswith("django_"):
            try:
                django_exclude_id = int(exclude_uid.replace("django_", ""))
                django_qs = django_qs.exclude(id=django_exclude_id)
            except:
                pass

        if django_qs.exists():
            exists = True

        try:
            from google.cloud.firestore import FieldFilter

            users_ref = firebase_service.db.collection("users")

            all_users = users_ref.stream()

            for doc in all_users:
                user_data = doc.to_dict()

                if exclude_uid and not exclude_uid.startswith("django_") and doc.id == exclude_uid:
                    continue

                user_first = user_data.get("first_name", "").strip().lower()
                user_last = user_data.get("last_name", "").strip().lower()

                if user_first == first_name.lower() and user_last == last_name.lower():
                    exists = True
                    break

        except Exception as e:
            logger.error(f"Error checking Firebase names: {e}")

        return JsonResponse({
            "exists": exists,
            "message": (
                "A user with this first and last name already exists"
                if exists else
                "Name combination available"
            )
        })

    except Exception as error:
        logger.error(f"❌ Name check failed: {error}")
        return JsonResponse({"exists": False, "error": str(error)}, status=500)


@require_GET
def check_email(request):
    email = request.GET.get("email", "").strip().lower()

    if not email:
        return JsonResponse({"exists": False})

    # Django users
    if User.objects.filter(email=email).exists():
        return JsonResponse({"exists": True})

    # Firebase users
    firebase_service = FirebaseService()
    if firebase_service.check_email_exists(email):
        return JsonResponse({"exists": True})

    return JsonResponse({"exists": False})
