from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache

@never_cache
@login_required
def staff_home(request):
    user = request.user
    
    first_name = user.first_name
    middle_name = user.midName if hasattr(user, "midName") else ""
    last_name = user.last_name

    middle_initial = (
        f" {middle_name[0]}." if middle_name and middle_name.strip() else ""
    )
    full_name = f"{first_name}{middle_initial} {last_name}".strip()

    context = {
        "user": user,
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
    }

    return render(request, "staff/staff_home.html", context)
