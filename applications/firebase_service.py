from django import db
from firebase_admin import auth, firestore
from django.conf import settings
import logging
import pandas as pd
from google.cloud.firestore import FieldFilter
from google.cloud.firestore import SERVER_TIMESTAMP
from datetime import datetime, timedelta, timezone, date

logger = logging.getLogger(__name__)

class FirebaseService:
    def __init__(self):
        self.db = firestore.client()

    def create_firebase_user(self, email, password, user_data):
        try:

            firebase_user = auth.create_user(
                email=email,
                password=password,
                display_name=f"{user_data['first_name']} {user_data['last_name']}",
            )

            user_profile = {
                "uid": firebase_user.uid,
                "email": email,
                "firstName": user_data["first_name"],
                "lastName": user_data["last_name"],
                "midName": user_data.get("midName", ""),
                "phoneNumber": user_data.get("phoneNumber", ""),
                "profileImageUrl": user_data.get("profileImageUrl", ""),
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastUpdated": firestore.SERVER_TIMESTAMP,
                "isFirstLogin": True,
                "isActive": True,
                "role": user_data.get("role", "user"),
                "department": user_data.get("department", "Tertiary"),
                "employmentStatus": user_data.get("employmentStatus", "Full-time"),
                "employID": user_data.get("employID", ""),
            }

            self.db.collection("users").document(firebase_user.uid).set(user_profile)

            return firebase_user.uid

        except Exception as e:
            logger.error(f"Firebase user creation error: {str(e)}")
            raise e

    def update_firebase_user(self, uid, user_data):
        try:
            update_data = {
                "firstName": user_data.get("first_name"),
                "lastName": user_data.get("last_name"),
                "midName": user_data.get("midName", ""),
                "phoneNumber": user_data.get("phoneNumber", ""),
                "lastUpdated": firestore.SERVER_TIMESTAMP,
                "department": user_data.get("department"),
                "employmentStatus": user_data.get("employmentStatus"),
                "employID": user_data.get("employID"),
            }

            update_data = {k: v for k, v in update_data.items() if v is not None}

            self.db.collection("users").document(uid).update(update_data)
        except Exception as e:
            logger.error(f"Firebase user update error: {str(e)}")
            raise e

    def delete_firebase_user(self, uid):
        try:
            self.db.collection("users").document(uid).delete()

            auth.delete_user(uid)

        except Exception as e:
            logger.error(f"Firebase user deletion error: {str(e)}")
            raise e

    def get_firebase_user(self, uid):
        try:
            doc = self.db.collection("users").document(uid).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Firebase user fetch error: {str(e)}")
            return None

    def get_all_users(self):
        try:
            users_ref = self.db.collection("users")
            docs = users_ref.stream()

            users = []
            for doc in docs:
                user_data = doc.to_dict()
                user_data["id"] = doc.id
                users.append(user_data)

            return users

        except Exception as e:
            logger.error(f"Error fetching all users: {str(e)}")
            return []

    def get_user_by_id(self, user_id):
        try:
            doc_ref = self.db.collection("users").document(user_id)
            doc = doc_ref.get()

            if doc.exists:
                user_data = doc.to_dict()
                user_data["id"] = doc.id
                return user_data
            else:
                return None

        except Exception as e:
            logger.error(f"Error fetching user {user_id}: {str(e)}")
            return None

    def check_employid_exists(self, employ_id, exclude_uid=None):
        try:
            if not employ_id:
                return False

            logger.info(f"📋 Querying Firebase for employID: {employ_id}")

            users_ref = self.db.collection("users")
            query = users_ref.where(filter=FieldFilter("employID", "==", employ_id))
            docs = list(query.stream())

            logger.info(f"   Found {len(docs)} document(s) with this employID")

            if exclude_uid:
                original_count = len(docs)
                docs = [doc for doc in docs if doc.id != exclude_uid]
                logger.info(f"   After excluding UID {exclude_uid}: {len(docs)} document(s)")

            exists = len(docs) > 0

            if exists:
                logger.info(f"   ❌ EmployID {employ_id} already exists")
            else:
                logger.info(f"   ✅ EmployID {employ_id} is available")

            return exists

        except Exception as error:
            logger.error(f"Error checking employID: {str(error)}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def check_email_exists(self, email):
        try:
            if not email:
                return False

            logger.info(f"📧 Querying Firebase for email: {email}")

            users_ref = self.db.collection("users")
            from google.cloud.firestore import FieldFilter
            query = users_ref.where(filter=FieldFilter("email", "==", email))
            docs = list(query.stream())

            logger.info(f"   Found {len(docs)} document(s) with this email")

            exists = len(docs) > 0

            if exists:
                logger.info(f"   ❌ Email {email} already exists")
            else:
                logger.info(f"   ✅ Email {email} is available")

            return exists

        except Exception as error:
            logger.error(f"Error checking email: {str(error)}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    def reset_password_to_value(self, uid):
        try:
            auth.update_user(uid, password="cscqcApp123")

            self.flag_user_for_password_reset(uid)

            user_record = auth.get_user(uid)

            logger.info(f"Password updated for user: {user_record.email}")

            return {"success": True, "email": user_record.email, "uid": uid}

        except auth.UserNotFoundError:
            logger.error(f"User not found for password update: {uid}")
            raise auth.UserNotFoundError(f"User {uid} not found")

        except Exception as e:
            logger.error(f"Error updating password for user {uid}: {str(e)}")
            raise e

    def create_class(self, class_data):
        try:
            conflict_check = self.check_schedule_conflict(
                teacher_uid=class_data.get("teacherUid"),
                day=class_data.get("day"),
                start_time=class_data.get("startTime"),
                end_time=class_data.get("endTime"),
            )

            if conflict_check.get("has_conflict"):
                conflicting = conflict_check.get("conflicting_class")
                raise ValueError(
                    f"Schedule conflict detected! This teacher already has "
                    f"{conflicting['subjectCode']} ({conflicting['subjectName']}) "
                    f"on {conflicting['day']} from {conflicting['startTime']} to {conflicting['endTime']} "
                    f"in room {conflicting['room']}"
                )

            class_ref = self.db.collection("classes").document()

            class_info = {
                "subjectCode": class_data.get("subjectCode", ""),
                "subjectName": class_data.get("subjectName", ""),
                "teacherUid": class_data.get("teacherUid"),
                "section": class_data.get("section", "B"),
                "room": class_data.get("room", ""),
                "startTime": class_data.get("startTime", ""),
                "endTime": class_data.get("endTime", ""),
                "dayOfWeek": self._convert_day_to_number(class_data.get("day")),
                "isActive": True,
                "createdAt": SERVER_TIMESTAMP,
            }

            class_ref.set(class_info)

            logger.info(f"✅ Class created: {class_info['subjectCode']}")
            return {
                "success": True,
                "class_id": class_ref.id,
                "data": class_info,
            }

        except Exception as e:
            logger.error(f"❌ Error creating class: {str(e)}")
            raise e

    def _convert_day_to_number(self, day):
        if not day:
            return None

        if isinstance(day, int) or (isinstance(day, str) and day.isdigit()):
            return int(day)

        day_map = {
            "monday": 1,
            "mon": 1,
            "tuesday": 2,
            "tue": 2,
            "wednesday": 3,
            "wed": 3,
            "thursday": 4,
            "thu": 4,
            "friday": 5,
            "fri": 5,
            "saturday": 6,
            "sat": 6,
            "sunday": 7,
            "sun": 7,
        }

        return day_map.get(str(day).lower(), None)

    def _parse_time_to_minutes(self, time_str):
        try:
            if not time_str:
                return None
            time_str = str(time_str).strip().upper()

            if "AM" in time_str or "PM" in time_str:
                time_part = time_str.replace("AM", "").replace("PM", "").strip()
                hours, minutes = map(int, time_part.split(":"))

                if "PM" in time_str and hours != 12:
                    hours += 12
                elif "AM" in time_str and hours == 12:
                    hours = 0

                return hours * 60 + minutes

            hours, minutes = map(int, time_str.split(":"))
            return hours * 60 + minutes

        except Exception as e:
            logger.error(f"Error parsing time '{time_str}': {str(e)}")
            return None

    def _check_time_overlap(self, start1, end1, start2, end2):
        start1_min = self._parse_time_to_minutes(start1)
        end1_min = self._parse_time_to_minutes(end1)
        start2_min = self._parse_time_to_minutes(start2)
        end2_min = self._parse_time_to_minutes(end2)

        if None in [start1_min, end1_min, start2_min, end2_min]:
            return False

        return start1_min < end2_min and start2_min < end1_min

    def check_schedule_conflict(self, teacher_uid, day, start_time, end_time, exclude_class_id=None):
        try:
            logger.info("=" * 80)
            logger.info("🔍 CHECKING SCHEDULE CONFLICT")
            logger.info(f"   Teacher: {teacher_uid}")
            logger.info(f"   Day: {day}")
            logger.info(f"   Time: {start_time} - {end_time}")
            logger.info(f"   Exclude Class ID: {exclude_class_id}")

            existing_classes = self.get_classes(teacherUid=teacher_uid)

            day_number = self._convert_day_to_number(day)

            for existing_class in existing_classes:

                if exclude_class_id and existing_class.get("id") == exclude_class_id:
                    continue

                existing_day_num = existing_class.get("day_number")
                if existing_day_num != day_number:
                    continue

                existing_start = existing_class.get("startTime")
                existing_end = existing_class.get("endTime")

                if self._check_time_overlap(
                    start_time, end_time, existing_start, existing_end
                ):
                    logger.warning(
                        f"   ❌ CONFLICT FOUND with class: {existing_class.get('subjectCode')}"
                    )
                    logger.warning(f"      Existing: {existing_start} - {existing_end}")
                    logger.warning(f"      New: {start_time} - {end_time}")

                    return {
                        "has_conflict": True,
                        "conflicting_class": {
                            "subjectCode": existing_class.get("subjectCode"),
                            "subjectName": existing_class.get("subjectName"),
                            "startTime": existing_start,
                            "endTime": existing_end,
                            "day": existing_class.get("day"),
                            "room": existing_class.get("room"),
                        },
                    }

            logger.info("   ✅ No conflicts found")
            logger.info("=" * 80)
            return {"has_conflict": False}

        except Exception as e:
            logger.error(f"Error checking schedule conflict: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            return {"has_conflict": False}  

    def bulk_create_classes(self, class_list):
        try:
            batch = self.db.batch()
            created_classes = []
            skipped_classes = []

            for class_data in class_list:

                conflict_check = self.check_schedule_conflict(
                    teacher_uid=class_data.get("teacherUid"),
                    day=class_data.get("day"),
                    start_time=class_data.get("startTime"),
                    end_time=class_data.get("endTime")
                )

                if conflict_check.get('has_conflict'):
                    conflicting = conflict_check.get('conflicting_class')
                    skipped_classes.append({
                        'subjectCode': class_data.get('subjectCode'),
                        'subjectName': class_data.get('subjectName'),
                        'reason': f"Conflicts with {conflicting['subjectCode']} at {conflicting['startTime']}-{conflicting['endTime']}"
                    })
                    logger.warning(f"⚠️ Skipping {class_data.get('subjectCode')} due to conflict")
                    continue

                class_ref = self.db.collection("classes").document()

                class_info = {
                    "subjectCode": class_data.get("subjectCode", ""),
                    "subjectName": class_data.get("subjectName", ""),
                    "teacherUid": class_data.get("teacherUid"),
                    "section": class_data.get("section", "B"),
                    "room": class_data.get("room", ""),
                    "startTime": class_data.get("startTime", ""),
                    "endTime": class_data.get("endTime", ""),
                    "dayOfWeek": self._convert_day_to_number(class_data.get("day")),
                    "isActive": True,
                    "createdAt": SERVER_TIMESTAMP,
                }

                batch.set(class_ref, class_info)
                created_classes.append({"id": class_ref.id, **class_info})

            batch.commit()

            logger.info(f"✅ Bulk created {len(created_classes)} classes")
            if skipped_classes:
                logger.warning(f"⚠️ Skipped {len(skipped_classes)} classes due to conflicts")

            return {
                "success": True,
                "count": len(created_classes),
                "classes": created_classes,
                "skipped": skipped_classes,
                "skipped_count": len(skipped_classes)
            }

        except Exception as e:
            logger.error(f"❌ Error bulk creating classes: {str(e)}")
            raise e

    def delete_class(self, class_id):
        try:
            self.db.collection("classes").document(class_id).delete()
            logger.info(f"✅ Class {class_id} deleted successfully")
            return True

        except Exception as e:
            logger.error(f"❌ Error deleting class {class_id}: {str(e)}")
            raise e

    def update_class(self, class_id, class_data):
        try:
            class_ref = self.db.collection("classes").document(class_id)
            if not class_ref.get().exists:
                raise ValueError(f"Class {class_id} not found")

            current_class = class_ref.get().to_dict()
            teacher_uid = current_class.get("teacherUid")

            conflict_check = self.check_schedule_conflict(
                teacher_uid=teacher_uid,
                day=class_data.get("day"),
                start_time=class_data.get("startTime"),
                end_time=class_data.get("endTime"),
                exclude_class_id=class_id,
            )

            if conflict_check.get("has_conflict"):
                conflicting = conflict_check.get("conflicting_class")
                raise ValueError(
                    f"Schedule conflict detected! This teacher already has "
                    f"{conflicting['subjectCode']} ({conflicting['subjectName']}) "
                    f"on {conflicting['day']} from {conflicting['startTime']} to {conflicting['endTime']}"
                )

            update_info = {
                "subjectCode": class_data.get("subjectCode"),
                "subjectName": class_data.get("subjectName"),
                "room": class_data.get("room"),
                "startTime": class_data.get("startTime"),
                "endTime": class_data.get("endTime"),
                "dayOfWeek": self._convert_day_to_number(class_data.get("day")),
                "lastUpdated": SERVER_TIMESTAMP,
            }

            update_info = {k: v for k, v in update_info.items() if v is not None}

            class_ref.update(update_info)

            logger.info(f"✅ Class {class_id} updated successfully")
            return {
                "success": True,
                "class_id": class_id,
                "data": update_info,
            }

        except Exception as e:
            logger.error(f"❌ Error updating class {class_id}: {str(e)}")
            raise e

    def get_classes(self, teacherUid=None, department=None):
        try:
            classes_ref = self.db.collection("classes")
            query = classes_ref

            if teacherUid:
                query = query.where(filter=FieldFilter("teacherUid", "==", teacherUid))

            docs = query.stream()
            classes = []

            day_map = {
                1: "Monday",
                2: "Tuesday",
                3: "Wednesday",
                4: "Thursday",
                5: "Friday",
                6: "Saturday",
                7: "Sunday",
                0: "Sunday",
            }

            for doc in docs:
                data = doc.to_dict()

                day_num = data.get("dayOfWeek")
                day_name = day_map.get(day_num, None) if day_num else None

                class_item = {
                    "id": doc.id,
                    "teacherUid": data.get("teacherUid"),
                    "subjectCode": data.get("subjectCode"),
                    "subjectName": data.get("subjectName"),
                    "section": data.get("section"),
                    "room": data.get("room"),
                    "startTime": data.get("startTime"),
                    "endTime": data.get("endTime"),
                    "day": day_name,
                    "day_number": day_num,
                    "is_active": data.get("isActive", True),
                }

                classes.append(class_item)

            logger.info(
                f"✅ Fetched {len(classes)} classes for teacherUid={teacherUid}"
            )
            return classes

        except Exception as e:
            logger.error(f"❌ Error fetching classes: {str(e)}")
            return []

    def get_attendance(self, class_id, date, teacher_uid):
        try:
            logger.info("=" * 80)
            logger.info("🔍 SEARCHING FOR ATTENDANCE")
            logger.info(f"   Looking for:")
            logger.info(f"   - ClassID: '{class_id}'")
            logger.info(f"   - Date: '{date}'")
            logger.info(f"   - TeacherUID: '{teacher_uid}'")

            attendance_ref = self.db.collection("attendance")
            all_docs = list(attendance_ref.stream())
            logger.info(f"   📊 Total documents: {len(all_docs)}")

            matching_records = []

            
            target_date = self._normalize_date_string(date)
            logger.info(f"   🎯 Target date normalized to: {target_date}")

            for doc in all_docs:
                data = doc.to_dict()

                doc_class_id = data.get("classId", "")
                
                
                doc_teacher_uid = data.get("teacherUid") or data.get("uid", "")
                doc_date = data.get("date")

                
                class_match = doc_class_id == class_id
                
                
                teacher_match = doc_teacher_uid == teacher_uid

                
                date_match = False
                doc_date_str = None

                if doc_date:
                    doc_date_str = self._normalize_date_string(doc_date)
                    date_match = (doc_date_str == target_date)
                    
                    if date_match:
                        logger.info(f"   ✅ Date match found: {doc_date_str} == {target_date}")
                
                
                if class_match or teacher_match:
                    logger.info(
                        f"   🔍 Doc {doc.id[:8]}: "
                        f"Class={class_match}, Teacher={teacher_match}, Date={date_match}"
                    )

                
                if class_match and teacher_match and date_match:
                    normalized_data = {
                        "id": doc.id,
                        "classId": data.get("classId"),
                        "teacherUid": doc_teacher_uid,  
                        "date": data.get("date"),
                        "timeIn": data.get("timeIn"),
                        "timeOut": data.get("timeOut"),
                        "timeInActual": data.get("timeInActual") or data.get("timeIn"),
                        "timeOutActual": data.get("timeOutActual") or data.get("timeOut"),
                        "timeInImageUrl": data.get("timeInImageUrl"),
                        "timeOutImageUrl": data.get("timeOutImageUrl"),
                        "timeInValidated": data.get("timeInValidated"),
                        "timeOutValidated": data.get("timeOutValidated"),
                        "timeInValidatedBy": data.get("timeInValidatedBy"),
                        "timeOutValidatedBy": data.get("timeOutValidatedBy"),
                        "timeInValidatedAt": data.get("timeInValidatedAt"),
                        "timeOutValidatedAt": data.get("timeOutValidatedAt"),
                        "status": data.get("status"),
                        "remarks": data.get("remarks"),
                        "validationStatus": data.get("validationStatus"),
                        "lateReasons": data.get("lateReasons"),
                        "isValidated": data.get("isValidated", False),
                        "isCompensated": data.get("isCompensated", False),
                        "compensationNote": data.get("compensationNote"),
                        "createdAt": data.get("createdAt"),
                    }

                    matching_records.append(normalized_data)
                    logger.info(f"   ✅ ✅ ✅ PERFECT MATCH FOUND: {doc.id}")
                    logger.info(f"   - Status: {normalized_data.get('status')}")
                    logger.info(f"   - Validation Status: {normalized_data.get('validationStatus')}")
                    logger.info(f"   - TimeIn: {normalized_data.get('timeIn')}")
                    logger.info(f"   - TimeOut: {normalized_data.get('timeOut')}")
                    logger.info(
                        f"   - TimeInImage: {'Present' if normalized_data.get('timeInImageUrl') else 'Missing'}"
                    )
                    logger.info(
                        f"   - TimeOutImage: {'Present' if normalized_data.get('timeOutImageUrl') else 'Missing'}"
                    )
                    logger.info(
                        f"   - LateReasons: {normalized_data.get('lateReasons') or 'None'}"
                    )

            if not matching_records:
                logger.warning(f"   ⚠️ NO MATCHES FOUND")
                logger.warning(
                    f"   Looking for: classId={class_id}, teacherUid={teacher_uid}, date={target_date}"
                )
                logger.warning("   Possible reasons:")
                logger.warning("   1. Attendance not yet submitted from mobile app")
                logger.warning("   2. ClassID mismatch (check Firebase 'classes' collection)")
                logger.warning("   3. TeacherUID mismatch (check 'uid' vs 'teacherUid' field)")
                logger.warning("   4. Date format mismatch")

            logger.info("=" * 80)
            return matching_records[0] if matching_records else None

        except Exception as e:
            logger.error(f"❌ Error fetching attendance: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    def _normalize_date_string(self, date_value):
        try:
            from datetime import datetime, timezone, timedelta
            
            
            if date_value is None:
                return None
            
            
            if isinstance(date_value, str):
                
                if "T" in date_value:
                    date_value = date_value.split("T")[0]
                elif " " in date_value:
                    date_value = date_value.split(" ")[0]
                
                
                try:
                    datetime.strptime(date_value, "%Y-%m-%d")
                    return date_value
                except ValueError:
                    logger.warning(f"Invalid date format: {date_value}")
                    return str(date_value)
            
            
            if hasattr(date_value, "date"):
                
                local_tz = timezone(timedelta(hours=8))  
                
                if date_value.tzinfo:
                    local_dt = date_value.astimezone(local_tz)
                else:
                    local_dt = date_value
                
                return local_dt.date().strftime("%Y-%m-%d")
            
            
            if hasattr(date_value, "strftime"):
                return date_value.strftime("%Y-%m-%d")
            
            
            logger.warning(f"Unknown date type: {type(date_value)}, value: {date_value}")
            return str(date_value)
            
        except Exception as e:
            logger.error(f"Error normalizing date: {str(e)}")
        return str(date_value)
    
    def mark_teacher_leave(self, attendance_id, late_reasons):
        try:
            attendance_ref = self.db.collection("attendance").document(attendance_id)

            doc = attendance_ref.get()
            if not doc.exists:
                raise ValueError(f"Attendance {attendance_id} not found")

            update_data = {
                "lateReasons": late_reasons,
                "status": "on_leave",
                "remarks": late_reasons,
                "lastUpdated": SERVER_TIMESTAMP,
            }

            attendance_ref.update(update_data)

            logger.info(f"✅ Attendance {attendance_id} marked as {late_reasons}")

            return {"lateReasons": late_reasons, "status": "on_leave"}

        except Exception as e:
            logger.error(f"❌ Error marking teacher leave: {str(e)}")
            raise e

    def mark_all_classes_leave(self, teacher_uid, date, late_reasons):
        try:

            classes = self.get_classes(teacherUid=teacher_uid)

            if not classes:
                logger.warning(f"No classes found for teacher {teacher_uid}")
                return {"updated_count": 0, "created_count": 0}

            from datetime import datetime

            date_obj = datetime.strptime(date, "%Y-%m-%d")
            day_of_week = date_obj.strftime("%A")

            day_classes = [cls for cls in classes if cls.get("day") == day_of_week]

            logger.info(
                f"Found {len(day_classes)} classes for {teacher_uid} on {day_of_week}"
            )

            updated_count = 0
            created_count = 0
            batch = self.db.batch()

            for cls in day_classes:
                class_id = cls.get("id")

                attendance = self.get_attendance(class_id, date, teacher_uid)

                if attendance:

                    attendance_ref = self.db.collection("attendance").document(
                        attendance["id"]
                    )
                    batch.update(
                        attendance_ref,
                        {
                            "lateReasons": late_reasons,
                            "status": "on_leave",
                            "remarks": late_reasons,
                            "lastUpdated": SERVER_TIMESTAMP,
                        },
                    )
                    updated_count += 1
                    logger.info(f"   Updated attendance for class {class_id}")
                else:

                    attendance_ref = self.db.collection("attendance").document()
                    batch.set(
                        attendance_ref,
                        {
                            "classId": class_id,
                            "teacherUid": teacher_uid,
                            "date": date,
                            "lateReasons": late_reasons,
                            "status": "on_leave",
                            "remarks": late_reasons,
                            "timeIn": None,
                            "timeOut": None,
                            "timeInImageUrl": None,
                            "timeOutImageUrl": None,
                            "createdAt": SERVER_TIMESTAMP,
                            "lastUpdated": SERVER_TIMESTAMP,
                        },
                    )
                    created_count += 1
                    logger.info(f"   Created attendance for class {class_id}")

            if updated_count > 0 or created_count > 0:
                batch.commit()
                logger.info(
                    f"✅ Marked {updated_count + created_count} classes as {late_reasons}"
                )

            return {
                "updated_count": updated_count,
                "created_count": created_count,
                "total": updated_count + created_count,
            }

        except Exception as e:
            logger.error(f"❌ Error marking all classes leave: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            raise e

    def clear_teacher_leave(self, attendance_id):
        try:
            attendance_ref = self.db.collection("attendance").document(attendance_id)

            doc = attendance_ref.get()
            if not doc.exists:
                raise ValueError(f"Attendance {attendance_id} not found")

            update_data = {
                "lateReasons": None,
                "status": "pending",
                "remarks": None,
                "lastUpdated": SERVER_TIMESTAMP,
            }

            attendance_ref.update(update_data)

            logger.info(f"✅ Leave status cleared for attendance {attendance_id}")

            return {"lateReasons": None, "status": "pending"}

        except Exception as e:
            logger.error(f"❌ Error clearing teacher leave: {str(e)}")
            raise e

    def clear_all_classes_leave(self, teacher_uid, date):
        try:

            classes = self.get_classes(teacherUid=teacher_uid)

            if not classes:
                logger.warning(f"No classes found for teacher {teacher_uid}")
                return {"cleared_count": 0}

            from datetime import datetime

            date_obj = datetime.strptime(date, "%Y-%m-%d")
            day_of_week = date_obj.strftime("%A")

            day_classes = [cls for cls in classes if cls.get("day") == day_of_week]

            logger.info(
                f"Found {len(day_classes)} classes for {teacher_uid} on {day_of_week}"
            )

            cleared_count = 0
            batch = self.db.batch()

            for cls in day_classes:
                class_id = cls.get("id")

                attendance = self.get_attendance(class_id, date, teacher_uid)

                if attendance and attendance.get("lateReasons"):

                    attendance_ref = self.db.collection("attendance").document(
                        attendance["id"]
                    )
                    batch.update(
                        attendance_ref,
                        {
                            "lateReasons": None,
                            "status": "pending",
                            "remarks": None,
                            "lastUpdated": SERVER_TIMESTAMP,
                        },
                    )
                    cleared_count += 1
                    logger.info(f"   Cleared leave status for class {class_id}")

            if cleared_count > 0:
                batch.commit()
                logger.info(f"✅ Cleared leave status for {cleared_count} classes")

            return {"cleared_count": cleared_count}

        except Exception as e:
            logger.error(f"❌ Error clearing all classes leave: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            raise e

    def validate_attendance(self, attendance_id, is_approved, validator_uid):
        try:
            attendance_ref = self.db.collection("attendance").document(attendance_id)

            doc = attendance_ref.get()
            if not doc.exists:
                raise ValueError(f"Attendance {attendance_id} not found")

            existing_data = doc.to_dict()
            original_status = existing_data.get("status", "late")
            
            logger.info("=" * 80)
            logger.info(f"🔍 BEFORE VALIDATION:")
            logger.info(f"   Attendance ID: {attendance_id}")
            logger.info(f"   Current status: '{original_status}'")
            logger.info(f"   Validation: {'APPROVE' if is_approved else 'DECLINE'}")

            from datetime import datetime
            validated_at = datetime.now().isoformat()

            
            
            update_data = {
                "timeInValidated": is_approved,
                "timeOutValidated": is_approved,
                "validatedBy": validator_uid,
                "validatedAt": SERVER_TIMESTAMP,
                "isValidated": True,
                "validationStatus": "approved" if is_approved else "declined",
                "remarks": "approved" if is_approved else "declined",  
                "lastUpdated": SERVER_TIMESTAMP,
            }

            logger.info(f"   Updating ONLY these fields: {list(update_data.keys())}")
            logger.info(f"   'status' field will NOT be touched")
            
            
            attendance_ref.update(update_data)

            
            verify_doc = attendance_ref.get()
            verify_data = verify_doc.to_dict()
            final_status = verify_data.get("status")
            
            logger.info(f"🔍 AFTER VALIDATION:")
            logger.info(f"   Status field: '{final_status}'")
            logger.info(f"   validationStatus: '{verify_data.get('validationStatus')}'")
            
            if final_status != original_status:
                logger.error(f"❌❌❌ ERROR: Status changed from '{original_status}' to '{final_status}'!")
            else:
                logger.info(f"✅ SUCCESS: Status preserved as '{final_status}'")
            
            logger.info("=" * 80)
            
            return {
                "attendance_id": attendance_id,
                "validation_status": "approved" if is_approved else "declined",
                "attendance_status": final_status,
                "validated_by": validator_uid,
                "validated_at": validated_at
            }

        except Exception as e:
            logger.error(f"❌ Error validating attendance: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise e


    def fix_corrupted_attendance_records(self):
        try:
            logger.info("=" * 80)
            logger.info("🔧 FIXING CORRUPTED ATTENDANCE RECORDS")
            
            attendance_ref = self.db.collection("attendance")
            all_docs = list(attendance_ref.stream())
            
            logger.info(f"   Total records to check: {len(all_docs)}")
            
            fixed_count = 0
            for doc in all_docs:
                data = doc.to_dict()
                status = data.get("status", "")
                
                
                if status.lower() in ["approved", "declined"]:
                    logger.info(f"   Found corrupted record: {doc.id}")
                    logger.info(f"      Current status: '{status}'")
                    
                    time_in = data.get("timeIn", "")
                    class_id = data.get("classId", "")
                    
                    correct_status = "late"  
                    
                    
                    if class_id and time_in:
                        try:
                            class_doc = self.db.collection("classes").document(class_id).get()
                            if class_doc.exists:
                                class_info = class_doc.to_dict()
                                scheduled_start = class_info.get("startTime")
                                
                                if scheduled_start:
                                    scheduled_minutes = self._parse_time_to_minutes(scheduled_start)
                                    actual_minutes = self._parse_time_to_minutes(time_in)
                                    
                                    if scheduled_minutes and actual_minutes:
                                        if actual_minutes <= (scheduled_minutes + 5):
                                            correct_status = "present"
                                        else:
                                            correct_status = "late"
                        except Exception as e:
                            logger.warning(f"      Could not determine correct status: {str(e)}")
                    
                    logger.info(f"      Setting status to: '{correct_status}'")
                    logger.info(f"      Moving '{status}' to validationStatus")
                    

                    doc.reference.update({
                        "status": correct_status,
                        "validationStatus": status,
                        "isValidated": True,
                        "remarks": status,
                    })
                    
                    fixed_count += 1
            
            logger.info(f"✅ Fixed {fixed_count} corrupted records")
            logger.info("=" * 80)
            
            return fixed_count
            
        except Exception as e:
            logger.error(f"❌ Error fixing records: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return 0
    
    def get_daily_attendance(self, date, department=None):
        try:
            attendance_ref = self.db.collection("attendance")
            all_docs = list(attendance_ref.stream())
            attendance_list = []

            for doc in all_docs:
                data = doc.to_dict()
                doc_date = str(data.get("date", ""))

                if date in doc_date or doc_date.startswith(date):
                    data["id"] = doc.id
                    attendance_list.append(data)

            logger.info(
                f"✅ Fetched {len(attendance_list)} attendance records for {date}"
            )
            return attendance_list

        except Exception as e:
            logger.error(f"❌ Error fetching daily attendance: {str(e)}")
            return []

    def create_attendance_record(self, attendance_data):
        try:
            logger.info("=" * 80)
            logger.info("🔥 CREATING ATTENDANCE RECORD")
            logger.info(f"ClassID: {attendance_data.get('classId')}")
            logger.info(f"TeacherUID: {attendance_data.get('teacherUid')}")
            logger.info(f"Date: {attendance_data.get('date')}")

            attendance_ref = self.db.collection("attendance").document()

            
            class_id = attendance_data.get("classId")
            status = "present"  
            
            if class_id:
                try:
                    class_doc = self.db.collection("classes").document(class_id).get()
                    if class_doc.exists:
                        class_info = class_doc.to_dict()
                        scheduled_start = class_info.get("startTime")
                        actual_time_in = attendance_data.get("timeIn")
                        
                        logger.info(f"Scheduled Start: {scheduled_start}")
                        logger.info(f"Actual Time In: {actual_time_in}")
                        
                        
                        if scheduled_start and actual_time_in:
                            scheduled_minutes = self._parse_time_to_minutes(scheduled_start)
                            actual_minutes = self._parse_time_to_minutes(actual_time_in)
                            
                            if scheduled_minutes and actual_minutes:
                                
                                if actual_minutes > (scheduled_minutes + 5):
                                    status = "late"
                                    logger.info(f"⚠️ Marked as LATE: {actual_minutes - scheduled_minutes} minutes after scheduled")
                                else:
                                    status = "present"
                                    logger.info(f"✅ Marked as PRESENT: On time or within 5 minutes")
                except Exception as e:
                    logger.error(f"Error checking class schedule: {str(e)}")

            
            if attendance_data.get("status"):
                status = attendance_data.get("status")
                logger.info(f"📱 Using status from mobile app: {status}")

            attendance_info = {
                "classId": attendance_data.get("classId"),
                "teacherUid": attendance_data.get("teacherUid"),
                "date": attendance_data.get("date"),
                "timeInImageUrl": attendance_data.get("timeInImageUrl", ""),
                "timeOutImageUrl": attendance_data.get("timeOutImageUrl", ""),
                "timeIn": attendance_data.get("timeIn", ""),
                "timeOut": attendance_data.get("timeOut", ""),
                "status": status,  
                "lateReason": attendance_data.get("lateReason", ""),
                "timeInValidated": None,
                "timeOutValidated": None,
                "timeInValidatedBy": None,
                "timeOutValidatedBy": None,
                "timeInValidatedAt": None,
                "timeOutValidatedAt": None,
                "isValidated": False,
                "validationStatus": "pending",
                "createdAt": SERVER_TIMESTAMP,
                "lastUpdated": SERVER_TIMESTAMP,
            }

            attendance_ref.set(attendance_info)

            logger.info(f"✅ Attendance record created with ID: {attendance_ref.id}")
            logger.info(f"   Status: {status}")
            logger.info("=" * 80)

            return {
                "success": True,
                "attendanceId": attendance_ref.id,
                "data": attendance_info,
            }

        except Exception as e:
            logger.error(f"❌ Error creating attendance record: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise e

    def set_day_status(self, date, status, reason=""):
        try:
            day_status_ref = self.db.collection("dayStatus").document(date)

            status_data = {
                "date": date,
                "reason": reason,
                "status": status,
                "setAt": SERVER_TIMESTAMP,
                "setBy": "admin",
            }

            day_status_ref.set(status_data)

            attendance_ref = self.db.collection("attendance")
            all_attendance = list(attendance_ref.stream())

            updated_count = 0
            batch = self.db.batch()

            for doc in all_attendance:
                data = doc.to_dict()
                doc_date = data.get("date")

                date_match = False

                if hasattr(doc_date, "strftime"):
                    doc_date_str = doc_date.strftime("%Y-%m-%d")
                    date_match = doc_date_str == date

                elif isinstance(doc_date, str):
                    if "T" in doc_date:
                        doc_date_str = doc_date.split("T")[0]
                    elif " " in doc_date:
                        doc_date_str = doc_date.split(" ")[0]
                    else:
                        doc_date_str = doc_date
                    date_match = doc_date_str == date or date in doc_date

                if date_match:

                    batch.update(
                        doc.reference,
                        {
                            "status": status,
                            "remarks": status,
                            "lastUpdated": SERVER_TIMESTAMP,
                        },
                    )
                    updated_count += 1
                    logger.info(f"   📝 Updating attendance {doc.id} to {status}")

            if updated_count > 0:
                batch.commit()
                logger.info(
                    f"✅ Updated {updated_count} attendance records to {status}"
                )
            else:
                logger.info(f"⚠️ No attendance records found for {date}")

            return_data = {
                "date": date,
                "status": status,
                "reason": reason,
                "setBy": "admin",
                "attendanceUpdated": updated_count,
            }

            logger.info(
                f"✅ Day {date} set as {status}, {updated_count} attendance records updated"
            )
            return {"success": True, "data": return_data}

        except Exception as e:
            logger.error(f"❌ Error setting day status: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            raise e

    def get_day_status(self, date):
        try:
            doc = self.db.collection("dayStatus").document(date).get()

            if doc.exists:
                data = doc.to_dict()
                return data
            return None

        except Exception as e:
            logger.error(f"❌ Error getting day status: {str(e)}")
            return None

    def get_month_statuses(self, year, month):
        try:
            statuses_ref = self.db.collection("dayStatus")

            all_docs = list(statuses_ref.stream())
            month_statuses = {}

            for doc in all_docs:
                date_str = doc.id
                if date_str.startswith(f"{year}-{month:02d}"):
                    data = doc.to_dict()
                    month_statuses[date_str] = data

            logger.info(
                f"✅ Fetched {len(month_statuses)} day statuses for {year}-{month}"
            )
            return month_statuses

        except Exception as e:
            logger.error(f"❌ Error fetching month statuses: {str(e)}")
            return {}

    def remove_day_status(self, date):
        try:
            self.db.collection("dayStatus").document(date).delete()

            attendance_ref = self.db.collection("attendance")
            all_attendance = list(attendance_ref.stream())

            updated_count = 0
            batch = self.db.batch()

            for doc in all_attendance:
                data = doc.to_dict()
                doc_date = data.get("date")

                date_match = False

                if hasattr(doc_date, "strftime"):
                    doc_date_str = doc_date.strftime("%Y-%m-%d")
                    date_match = doc_date_str == date

                elif isinstance(doc_date, str):
                    if "T" in doc_date:
                        doc_date_str = doc_date.split("T")[0]
                    elif " " in doc_date:
                        doc_date_str = doc_date.split(" ")[0]
                    else:
                        doc_date_str = doc_date
                    date_match = doc_date_str == date or date in doc_date

                if date_match:
                    current_status = data.get("status", "")
                    if current_status in ["holiday", "suspended"]:
                        
                        date_obj = datetime.strptime(date, "%Y-%m-%d").date()
                        today = datetime.now().date()
                        
                        
                        if date_obj < today:
                            new_status = "absent"
                            logger.info(f"   📅 Date {date} is in the past - setting status to 'absent'")
                        else:
                            new_status = "pending"
                            logger.info(f"   📅 Date {date} is today/future - setting status to 'pending'")
                        
                        batch.update(
                            doc.reference,
                            {
                                "status": new_status,
                                "remarks": None,
                                "lastUpdated": SERVER_TIMESTAMP,
                            },
                        )

            if updated_count > 0:
                batch.commit()
                logger.info(f"✅ Reset {updated_count} attendance records to pending")
            else:
                logger.info(f"⚠️ No attendance records to reset for {date}")

            logger.info(f"✅ Day status removed for {date}")
            return {"success": True, "attendanceReset": updated_count}

        except Exception as e:
            logger.error(f"❌ Error removing day status: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            raise e
        
    def get_teacher_by_employee_id(self, employee_id):
        try:
            teachers_ref = self.db.collection('users')
            query = teachers_ref.where('employID', '==', employee_id).limit(1)
            results = query.stream()
            
            for doc in results:
                teacher_data = doc.to_dict()
                teacher_data['uid'] = doc.id
                return teacher_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting teacher by employee ID: {str(e)}")
            return None    
        
    def toggle_user_active_status(self, uid, is_active):
        try:
            logger.info(f"🔄 Toggling isActive for user {uid} to {is_active}")
            
            self.db.collection('users').document(uid).update({
                'isActive': is_active,
                'lastUpdated': SERVER_TIMESTAMP
            })
            
            logger.info(f"✅ User {uid} isActive updated to {is_active}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error toggling user active status: {str(e)}")
            raise e

    def get_attendance_report(self, start_date, end_date, department=None):
        try:
            from datetime import datetime

            attendance_ref = self.db.collection("attendance")
            all_attendance = list(attendance_ref.stream())

            filtered_attendance = []

            for doc in all_attendance:
                data = doc.to_dict()
                doc_date = data.get("date")

                if hasattr(doc_date, "strftime"):
                    doc_date_str = doc_date.strftime("%Y-%m-%d")
                elif isinstance(doc_date, str):
                    doc_date_str = (
                        doc_date.split("T")[0]
                        if "T" in doc_date
                        else doc_date.split(" ")[0]
                    )
                else:
                    continue

                try:
                    doc_date_obj = datetime.strptime(doc_date_str, "%Y-%m-%d")
                    start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                    end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")

                    if start_date_obj <= doc_date_obj <= end_date_obj:
                        data["id"] = doc.id
                        data["date_str"] = doc_date_str
                        filtered_attendance.append(data)
                except:
                    continue

            logger.info(
                f"Found {len(filtered_attendance)} attendance records from {start_date} to {end_date}"
            )
            return filtered_attendance

        except Exception as e:
            logger.error(f"Error fetching attendance report: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            return []

    def calculate_attendance_summary(self, start_date, end_date, department="all"):
        try:
            logger.info(f"Calculating attendance summary from {start_date} to {end_date}, department: {department}")
            
            users = self.get_all_users()
            
            if department != "all":
                users = [u for u in users if u.get("department", "").lower() == department.lower()]
            
            logger.info(f"Found {len(users)} users to process")
            
            attendance_ref = self.db.collection("attendance")
            all_attendance = list(attendance_ref.stream())
            
            logger.info(f"Found {len(all_attendance)} total attendance records")
            
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            
            summary = []
            
            for user in users:
                user_id = user.get("uid") or user.get("id")
                first_name = user.get("firstName", "")
                mid_name = user.get("midName", "")
                last_name = user.get("lastName", "")
                
                middle_initial = f" {mid_name[0]}." if mid_name and mid_name.strip() else ""
                full_name = f"{first_name}{middle_initial} {last_name}".strip()
                
                user_attendance = []
                skipped_records = [] 
                
                for doc in all_attendance:
                    data = doc.to_dict()
                    
                    record_teacher_uid = data.get("uid")
                    
                    if not record_teacher_uid:
                        skipped_records.append(f"No UID field - Doc ID: {doc.id}")
                        continue
                        
                    if record_teacher_uid != user_id:
                        continue
                    
                    doc_date = data.get("date")
                    if not doc_date:
                        skipped_records.append(f"No date field - Doc ID: {doc.id}")
                        continue
                    
                    try:
                        if hasattr(doc_date, "date"):
                            local_tz = timezone(timedelta(hours=8)) 
                            
                            if doc_date.tzinfo:
                                local_dt = doc_date.astimezone(local_tz)
                            else:
                                local_dt = doc_date
                            
                            doc_date_str = local_dt.date().strftime("%Y-%m-%d")
                        elif hasattr(doc_date, "strftime"):
                            doc_date_str = doc_date.strftime("%Y-%m-%d")
                        elif isinstance(doc_date, str):
                            if "T" in doc_date:
                                doc_date_str = doc_date.split("T")[0]
                            else:
                                doc_date_str = doc_date.split(" ")[0]
                        else:
                            skipped_records.append(f"Unknown date type: {type(doc_date)} - Doc ID: {doc.id}")
                            continue
                        
                        doc_dt = datetime.strptime(doc_date_str, "%Y-%m-%d")
                        
                        
                        if start_dt <= doc_dt <= end_dt:
                            logger.info(f"   ✓ Including attendance for {full_name}: Date={doc_date_str}, Status={data.get('status')}")
                            user_attendance.append({
                                "date": doc_date_str,
                                "timeIn": data.get("timeIn"),
                                "timeOut": data.get("timeOut"),
                                "status": data.get("status", "pending"),
                                "isValidated": data.get("isValidated", False),
                                "validationStatus": data.get("validationStatus", ""),
                                "timeInImageUrl": data.get("timeInImageUrl"),
                                "timeOutImageUrl": data.get("timeOutImageUrl"),
                            })
                        else:
                            skipped_records.append(f"Date out of range: {doc_date_str} not in {start_date} to {end_date}")
                            
                    except Exception as e:
                        skipped_records.append(f"Error parsing date: {str(e)} - Doc ID: {doc.id}")
                        logger.warning(f"Error parsing date for record {doc.id}: {str(e)}")
                        continue
                
                logger.info(f"   User {full_name} ({user_id}): Found {len(user_attendance)} attendance records")
                if skipped_records and len(skipped_records) > 0:
                    logger.info(f"   Skipped {len(skipped_records)} records (first 3):")
                    for skip in skipped_records[:3]:
                        logger.info(f"     - {skip}")
                
                present_count = 0
                absent_count = 0
                late_count = 0
                total_hours = 0.0
                
                attendance_by_date = {}
                for att in user_attendance:
                    date = att["date"]
                    if date not in attendance_by_date:
                        attendance_by_date[date] = att
                
                for date_str, att in attendance_by_date.items():
                    status = att.get("status", "pending").lower()
                    
                    if status == "present":
                        present_count += 1
                    elif status == "late":
                        late_count += 1
                    elif status == "absent":
                        absent_count += 1
                    elif status == "pending":
                        has_time_in = att.get("timeIn") or att.get("timeInImageUrl")
                        has_time_out = att.get("timeOut") or att.get("timeOutImageUrl")
                        
                        if has_time_in and has_time_out:
                            present_count += 1
                        elif has_time_in and not has_time_out:
                            late_count += 1
                        else:
                            
                            if self._should_mark_absent(date_str, user_id):
                                absent_count += 1
                                logger.info(f"   ⚠️ {full_name}: Marking {date_str} as ABSENT (pending but date passed)")
                            else:
                                
                                pass
                    
                    
                    time_in = att.get("timeIn", "")
                    time_out = att.get("timeOut", "")
                    
                    if time_in and time_out:
                        try:
                            time_in_minutes = self._parse_time_to_minutes(time_in)
                            time_out_minutes = self._parse_time_to_minutes(time_out)
                            
                            if time_in_minutes is not None and time_out_minutes is not None:
                                if time_out_minutes < time_in_minutes:
                                    time_out_minutes += 24 * 60
                                
                                hours = (time_out_minutes - time_in_minutes) / 60.0
                                
                                if hours >= 0:
                                    total_hours += hours
                        except Exception as e:
                            logger.warning(f"  Error calculating hours: {str(e)}")
                
                
                total_classes_count = len(attendance_by_date)
                
                
                if total_classes_count > 0:
                    present_percentage = round((present_count / total_classes_count) * 100, 1)
                    absent_percentage = round((absent_count / total_classes_count) * 100, 1)
                    late_percentage = round((late_count / total_classes_count) * 100, 1)
                else:
                    present_percentage = 0.0
                    absent_percentage = 0.0
                    late_percentage = 0.0
                
                logger.info(f"User {full_name} FINAL: Present={present_count}, Late={late_count}, Absent={absent_count}, Total Classes={total_classes_count}, Hours={total_hours}")
                
                
                attendance_pattern = []
                all_dates = sorted(list(attendance_by_date.keys()))
                
                for date_str in all_dates:
                    att = attendance_by_date[date_str]
                    status = att.get("status", "pending").lower()
                    
                    if status == "present": 
                        attendance_pattern.append("present")
                    elif status == "late":
                        attendance_pattern.append("late")
                    elif status == "absent": 
                        attendance_pattern.append("absent")
                    elif status == "pending":
                        has_time_in = att.get("timeIn") or att.get("timeInImageUrl")
                        has_time_out = att.get("timeOut") or att.get("timeOutImageUrl")
                        
                        if has_time_in and has_time_out:
                            attendance_pattern.append("present")
                        elif has_time_in and not has_time_out:
                            attendance_pattern.append("late")
                        else:
                            attendance_pattern.append("absent")
                
                summary.append({
                    "employID": user.get("employID", ""),
                    "uid": user_id,
                    "full_name": full_name,
                    "department": user.get("department", ""),
                    "present_count": present_count,
                    "absent_count": absent_count,
                    "late_count": late_count,
                    "total_classes": total_classes_count,
                    "present_percentage": present_percentage,
                    "absent_percentage": absent_percentage,
                    "late_percentage": late_percentage,
                    "total_hours": total_hours,
                    "attendance_pattern": attendance_pattern,
                })
            
            logger.info(f"Summary complete: {len(summary)} users processed")
            return summary
            
        except Exception as e:
            logger.error(f"Error calculating attendance summary: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return []   
        
    def _should_mark_absent(self, date_str, teacher_uid):
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            today = datetime.now().date()
                        
            if date_obj >= today:
                return False
            
            date_weekday = datetime.strptime(date_str, "%Y-%m-%d").weekday()
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            day_name = day_names[date_weekday]
            
            
            classes = self.get_classes(teacherUid=teacher_uid)
            
            
            has_class_on_day = any(cls.get("day") == day_name for cls in classes)
            
            return has_class_on_day
            
        except Exception as e:
            logger.error(f"Error in _should_mark_absent: {str(e)}")
            return False
    
    def _get_full_name(self, user):
        first_name = user.get("firstName", "")
        mid_name = user.get("midName", "")
        last_name = user.get("lastName", "")
        middle_initial = f" {mid_name[0]}." if mid_name and mid_name.strip() else ""
        return f"{first_name}{middle_initial} {last_name}".strip()

    def _calculate_hours_worked(self, time_in, time_out):
        try:
            from datetime import datetime

            def parse_time(time_str):
                time_str = str(time_str).strip().upper()
                if "AM" in time_str or "PM" in time_str:
                    return datetime.strptime(time_str, "%I:%M %p")
                else:
                    return datetime.strptime(time_str, "%H:%M")

            time_in_obj = parse_time(time_in)
            time_out_obj = parse_time(time_out)

            diff = time_out_obj - time_in_obj
            hours = diff.total_seconds() / 3600

            return round(hours, 2)
        except Exception as e:
            logger.error(f"Error calculating hours: {str(e)}")
            return 0

    def _is_late(self, time_in):
        try:
            from datetime import datetime

            time_str = str(time_in).strip().upper()
            if "AM" in time_str or "PM" in time_str:
                time_obj = datetime.strptime(time_str, "%I:%M %p")
            else:
                time_obj = datetime.strptime(time_str, "%H:%M")

            late_cutoff = datetime.strptime("8:00 AM", "%I:%M %p")
            return time_obj > late_cutoff
        except Exception as e:
            return False

    def flag_user_for_password_reset(self, user_id):
        try:
            user_ref = self.db.collection('users').document(user_id)
            
            if not user_ref.get().exists:
                logger.warning(f"User {user_id} not found in Firestore")
                return False
            
            user_ref.update({
                'isFirstLogin': True,
                'passwordResetRequiredAt': firestore.SERVER_TIMESTAMP,
                'passwordResetBy': 'django_admin',
                'lastUpdated': firestore.SERVER_TIMESTAMP,
            })
            
            logger.info(f"✅ User {user_id} flagged for password reset")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error flagging user {user_id}: {str(e)}")
            return False


    def get_user_by_employee_id(self, employee_id):
        try:
            users_ref = self.db.collection('users')
            query = users_ref.where('employID', '==', employee_id).limit(1)
            docs = query.stream()
            
            for doc in docs:
                return {
                    'uid': doc.id,
                    'data': doc.to_dict()
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by employID {employee_id}: {str(e)}")
            return None
        
    def bulk_create_users(self, user_list):
        created_users = []
        skipped_users = []
        
        for user_data in user_list:
            try:
                
                try:
                    existing_user = auth.get_user_by_email(user_data['email'])
                    skipped_users.append({
                        'email': user_data['email'],
                        'reason': 'Email already exists'
                    })
                    continue
                except auth.UserNotFoundError:
                    pass  
                
                
                firebase_user = auth.create_user(
                    email=user_data['email'],
                    password=user_data.get('password', 'DefaultPass123!'),  
                    display_name=f"{user_data['firstName']} {user_data['lastName']}",
                )
                
                
                user_profile = {
                    "uid": firebase_user.uid,
                    "email": user_data['email'],
                    "firstName": user_data['firstName'],
                    "lastName": user_data['lastName'],
                    "midName": user_data.get('midName', ''),
                    "phoneNumber": user_data.get('phoneNumber', ''),
                    "profileImageUrl": user_data.get('profileImageUrl', ''),
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "lastUpdated": firestore.SERVER_TIMESTAMP,
                    "isFirstLogin": True,
                    "isActive": True,
                    "role": user_data.get('role', 'user'),
                    "department": user_data.get('department', 'Tertiary'),
                    "employmentStatus": user_data.get('employmentStatus', 'Full-time'),
                    "employID": user_data.get('employID', ''),
                }
                
                self.db.collection("users").document(firebase_user.uid).set(user_profile)
                
                created_users.append({
                    'uid': firebase_user.uid,
                    'email': user_data['email'],
                    'name': f"{user_data['firstName']} {user_data['lastName']}"
                })
                
            except Exception as e:
                logger.error(f"Error creating user {user_data.get('email')}: {str(e)}")
                skipped_users.append({
                    'email': user_data.get('email', 'Unknown'),
                    'reason': str(e)
                })
        
        return {
            'count': len(created_users),
            'users': created_users,
            'skipped': skipped_users,
            'skipped_count': len(skipped_users)
        }
