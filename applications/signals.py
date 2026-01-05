from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from firebase_service import FirebaseService
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def sync_user_to_firebase(sender, instance, created, **kwargs):
    if not created and instance.firebase_uid:
        try:
            firebase_service = FirebaseService()
            user_data = {
                'first_name': instance.first_name,
                'last_name': instance.last_name,
                'middle_name': instance.middle_name,
                'phone_number': instance.phone_number,
                'department': instance.department
            }
            firebase_service.update_firebase_user(instance.firebase_uid, user_data)
            logger.info(f"Synced Django user {instance.email} to Firebase")
        except Exception as e:
            print(f"Firebase sync error: {e}")

@receiver(post_delete, sender=User)
def delete_firebase_user(sender, instance, **kwargs):
    if instance.firebase_uid:
        try:
            firebase_service = FirebaseService()
            firebase_service.delete_firebase_user(instance.firebase_uid)
            logger.info(f"Deleted Firebase user {instance.firebase_uid} after Django user deletion")
        except Exception as e:
            print(f"Firebase deletion error: {e}")
            logger.error(f"Firebase deletion error for user {instance.firebase_uid}: {e}")
