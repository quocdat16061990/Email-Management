from django.urls import path

from .views import (
    course_detail_api,
    courses_view,
    course_detail_view,
    dashboard_view,
    login_view,
    logout_view,
    student_detail_api,
    student_detail_view,
    sync_courses_view,
    sync_students_view,
    update_course_website_api,
    student_search_api,
    enroll_student_view,
)


urlpatterns = [
    path("", login_view, name="login"),
    path("dashboard/", dashboard_view, name="dashboard"),
    path("dashboard/student-detail/", student_detail_api, name="student_detail_api"),
    path("dashboard/student/<int:student_id>/", student_detail_view, name="student_detail"),
    path("dashboard/sync-students/", sync_students_view, name="sync_students"),
    path("courses/", courses_view, name="courses"),
    path("courses/<int:course_id>/", course_detail_view, name="course_detail"),
    path("courses/course-detail/", course_detail_api, name="course_detail_api"),
    path("courses/sync/", sync_courses_view, name="sync_courses"),
    path("courses/update-website/", update_course_website_api, name="update_course_website_api"),
    path("courses/search-students/", student_search_api, name="student_search_api"),
    path("courses/enroll-student/", enroll_student_view, name="enroll_student"),
    path("logout/", logout_view, name="logout"),
]


