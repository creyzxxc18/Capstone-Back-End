from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        extra_fields.setdefault("is_staff", True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    midName = models.CharField(max_length=30, blank=True)
    phoneNumber = models.CharField(max_length=11, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    email = models.EmailField(unique=True)
    employId = models.CharField(unique=True, max_length=30, null=True, blank=True)
    isFirstLogin = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    def __str__(self):
        return self.email


class Profile(models.Model):
    
    userRoleChoice = [
        ("staff/checker", "Staff/Checker"),
        ("admin", "Admin"),
    ]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    userRole = models.CharField(
        max_length=15, choices=userRoleChoice, default="staff/checker"
    )

    def __str__(self):
        return f"{self.user.email} - {self.userRole}"


class Subject(models.Model):
    firebase_id = models.CharField(max_length=255, unique=True, db_index=True)
    course_id = models.CharField(max_length=50)
    course_subject = models.CharField(max_length=255)
    professor_id = models.CharField(max_length=255, null=True, blank=True)
    professor_name = models.CharField(max_length=255, null=True, blank=True)
    department = models.CharField(max_length=100, default="all")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["course_id"]
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"

    def __str__(self):
        return f"{self.course_id} - {self.course_subject}"


class Course(models.Model):
    course_code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.course_code}"


@receiver(post_save, sender=CustomUser)
def manage_user_profile(sender, instance, created, **kwargs):
    if created:
        
        role = "admin" if instance.is_superuser else "staff/checker"
        Profile.objects.create(user=instance, userRole=role)
    else:
        
        if hasattr(instance, "profile"):
            instance.profile.save()
