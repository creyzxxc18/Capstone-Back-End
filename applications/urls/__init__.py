from .maintenance_urls import urlpatterns as maintenance_patterns
from .schedule_urls import urlpatterns as schedule_patterns
from .staff_urls import urlpatterns as staff_patterns
from .main_urls import urlpatterns as main_patterns


urlpatterns = [
    *maintenance_patterns,
    *schedule_patterns,
    *staff_patterns,
    *main_patterns,
]