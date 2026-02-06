from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import logging

User = get_user_model()
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        
        token["email"] = user.email
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name
        token["is_first_login"] = user.isFirstLogin
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser

        
        try:
            from applications.models import Profile

            profile = Profile.objects.get(user=user)
            token["role"] = profile.userRole
        except:
            token["role"] = "staff"

        return token

    def validate(self, attrs):
        
        email = attrs.get("username")  
        password = attrs.get("password")

        try:
            user = User.objects.get(email=email)

            
            if user.is_locked:
                raise serializers.ValidationError(
                    {
                        "detail": "Your account has been locked. Please contact the administrator.",
                        "locked": True,
                    }
                )

            
            if not user.check_password(password):
                
                user.failed_login_attempts += 1

                if user.failed_login_attempts >= 5:
                    user.is_locked = True
                    user.locked_at = timezone.now()
                    user.save()

                    
                    from . import CustomLoginRedirectView

                    view = CustomLoginRedirectView()
                    view.send_account_locked_email(
                        user.email, user.first_name or "User"
                    )

                    raise serializers.ValidationError(
                        {
                            "detail": "Account locked due to multiple failed attempts. Check your email.",
                            "locked": True,
                            "attempts": user.failed_login_attempts,
                        }
                    )
                else:
                    user.save()
                    remaining = 5 - user.failed_login_attempts
                    raise serializers.ValidationError(
                        {
                            "detail": f"Invalid credentials. {remaining} attempt(s) remaining.",
                            "remaining_attempts": remaining,
                        }
                    )

            
            user.failed_login_attempts = 0
            user.save()

        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Invalid credentials."})

        data = super().validate(attrs)

        
        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "is_first_login": self.user.isFirstLogin,
        }

        return data
@method_decorator(csrf_exempt, name="dispatch")
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer