from functools import wraps

from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render

from .forms import CourseForm, CustomerRegistrationForm, LoginForm
from .models import Course, Customer, Enrollment
from .services import normalize_phone_number, upsert_customer_from_web


SESSION_KEY = "webapp_authenticated"


def _base_context() -> dict[str, str]:
    return {
        "company_name": settings.COMPANY_NAME,
        "company_logo_text": settings.COMPANY_LOGO_TEXT,
    }


def web_login_required(view_func):
    @wraps(view_func)
    def wrapped(request: HttpRequest, *args, **kwargs):
        if not request.session.get(SESSION_KEY):
            return redirect("login")
        return view_func(request, *args, **kwargs)

    return wrapped


def login_view(request: HttpRequest) -> HttpResponse:
    if request.session.get(SESSION_KEY):
        return redirect("dashboard")

    form = LoginForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"].strip().lower()
        password = form.cleaned_data["password"]
        if email == settings.WEBAPP_LOGIN_EMAIL.lower() and password == settings.WEBAPP_LOGIN_PASSWORD:
            request.session[SESSION_KEY] = True
            request.session["operator_email"] = email
            return redirect("dashboard")
        messages.error(request, "Thông tin đăng nhập không chính xác.")

    context = _base_context()
    context["form"] = form
    return render(request, "botapp/login.html", context)


@web_login_required
def dashboard_view(request: HttpRequest) -> HttpResponse:
    edit_id = request.GET.get("edit")
    delete_id = request.GET.get("delete")

    # Handle Delete action
    if delete_id:
        customer_to_delete = get_object_or_404(Customer, id=delete_id)
        email = customer_to_delete.customer_email
        customer_to_delete.delete()
        messages.success(request, f"Đã xóa thành công học viên '{email}'.")
        return redirect("dashboard")

    edit_instance = None
    if edit_id:
        edit_instance = get_object_or_404(Customer, id=edit_id)

    if request.method == "POST":
        form = CustomerRegistrationForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["customer_email"].strip().lower()
            name = form.cleaned_data["full_name"].strip()
            phone = normalize_phone_number(form.cleaned_data["phone_number"])
            
            if edit_instance:
                customer = edit_instance
                customer.customer_email = email
                customer.full_name = name
                customer.phone_number = phone
                customer.save()
            else:
                customer, _ = Customer.objects.get_or_create(
                    customer_email=email,
                    defaults={
                        "full_name": name,
                        "phone_number": phone,
                    }
                )
                customer.full_name = name
                customer.phone_number = phone
                customer.save()

            # Process courses
            selected_courses = list(form.cleaned_data.get("existing_courses", []))
            extra_course_names = [
                line.strip()
                for line in form.cleaned_data.get("extra_courses", "").splitlines()
                if line.strip()
            ]
            for c_name in extra_course_names:
                c_obj, _ = Course.objects.get_or_create(name=c_name)
                selected_courses.append(c_obj)

            # Remove enrollments not selected
            customer.enrollments.exclude(course__in=selected_courses).delete()

            # Save enrollment details
            from django.utils import timezone
            from datetime import datetime, timedelta
            today = timezone.localdate()
            
            for course in selected_courses:
                reg_date_str = request.POST.get(f"course_{course.id}_registration_date")
                exp_date_str = request.POST.get(f"course_{course.id}_expiry_date")
                c_status = request.POST.get(f"course_{course.id}_status", "ACTIVE")
                
                if reg_date_str:
                    try:
                        reg_date = datetime.strptime(reg_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        reg_date = today
                else:
                    reg_date = today
                    
                if exp_date_str:
                    try:
                        exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        exp_date = reg_date + timedelta(days=365)
                else:
                    exp_date = reg_date + timedelta(days=365)

                from botapp.models import Enrollment
                Enrollment.objects.update_or_create(
                    customer=customer,
                    course=course,
                    defaults={
                        "registration_date": reg_date,
                        "expiry_date": exp_date,
                        "status": c_status,
                    }
                )

            customer.sync_overall_fields()

            if edit_instance:
                messages.success(request, f"Đã cập nhật thông tin học viên {customer.customer_email} thành công.")
            else:
                messages.success(request, f"Đã lưu thành công thông tin học viên {customer.customer_email} và đồng bộ lên cơ sở dữ liệu.")
            return redirect("dashboard")
    else:
        if edit_instance:
            initial_data = {
                "full_name": edit_instance.full_name,
                "customer_email": edit_instance.customer_email,
                "phone_number": edit_instance.phone_number,
                "existing_courses": edit_instance.courses.all(),
                "registration_date": edit_instance.registration_date,
                "expiry_date": edit_instance.expiry_date,
                "status": edit_instance.status,
            }
            form = CustomerRegistrationForm(initial=initial_data)
        else:
            form = CustomerRegistrationForm()

    from django.core.paginator import Paginator
    from django.db.models import Q
    
    query = request.GET.get("q", "").strip()
    customer_list = Customer.objects.prefetch_related("courses").order_by("-created_at")
    if query:
        customer_list = customer_list.filter(
            Q(full_name__icontains=query) |
            Q(customer_email__icontains=query) |
            Q(phone_number__icontains=query)
        )
        
    page_number = request.GET.get("page", 1)
    paginator = Paginator(customer_list, 10)
    customers = paginator.get_page(page_number)

    context = _base_context()
    context.update(
        {
            "form": form,
            "customers": customers,
            "edit_mode": edit_instance is not None,
            "edit_customer": edit_instance,
            "operator_email": request.session.get("operator_email", ""),
            "query": query,
        }
    )
    return render(request, "botapp/dashboard.html", context)


@web_login_required
def logout_view(request: HttpRequest) -> HttpResponse:
    request.session.flush()
    return redirect("login")


@web_login_required
def courses_view(request: HttpRequest) -> HttpResponse:
    edit_id = request.GET.get("edit")
    delete_id = request.GET.get("delete")

    # Handle Delete action
    if delete_id:
        course_to_delete = get_object_or_404(Course, id=delete_id)
        course_name = course_to_delete.name
        course_to_delete.delete()
        messages.success(request, f"Đã xóa thành công khóa học '{course_name}'.")
        return redirect("courses")

    edit_instance = None
    if edit_id:
        edit_instance = get_object_or_404(Course, id=edit_id)

    if request.method == "POST":
        form = CourseForm(request.POST, instance=edit_instance)
        if form.is_valid():
            course = form.save()
            
            # Save dynamic course links
            link_titles = request.POST.getlist("link_titles[]")
            link_urls = request.POST.getlist("link_urls[]")
            
            course.links.all().delete()
            for title, url in zip(link_titles, link_urls):
                title = title.strip()
                url = url.strip()
                if title and url:
                    course.links.create(title=title, url=url)
                    
            if edit_instance:
                messages.success(request, f"Đã cập nhật thông tin khóa học '{course.name}' thành công.")
            else:
                messages.success(request, f"Đã tạo mới khóa học '{course.name}' thành công.")
            return redirect("course_detail", course_id=course.id)
    else:
        form = CourseForm(instance=edit_instance)

    # Get all courses with student counts with pagination
    from django.db.models import Count
    from django.core.paginator import Paginator

    course_list = Course.objects.annotate(student_count=Count('customers')).order_by('-created_at')
    page_number = request.GET.get("page", 1)
    paginator = Paginator(course_list, 10)
    courses = paginator.get_page(page_number)

    context = _base_context()
    context.update({
        "form": form,
        "courses": courses,
        "edit_mode": edit_instance is not None,
        "edit_course": edit_instance,
        "operator_email": request.session.get("operator_email", ""),
    })
    return render(request, "botapp/courses.html", context)


@web_login_required
def student_detail_api(request: HttpRequest) -> JsonResponse:
    student_id = request.GET.get("id")
    if not student_id:
        return JsonResponse({"error": "Missing student ID"}, status=400)

    student = get_object_or_404(Customer, id=student_id)
    courses_ids = list(student.courses.values_list("id", flat=True))
    
    enrollments_data = []
    for enroll in student.enrollments.all():
        enrollments_data.append({
            "course_id": enroll.course_id,
            "registration_date": str(enroll.registration_date) if enroll.registration_date else "",
            "expiry_date": str(enroll.expiry_date) if enroll.expiry_date else "",
            "status": enroll.status,
        })

    return JsonResponse({
        "id": student.id,
        "full_name": student.full_name,
        "customer_email": student.customer_email,
        "phone_number": student.phone_number,
        "status": student.status,
        "registration_date": str(student.registration_date) if student.registration_date else "",
        "expiry_date": str(student.expiry_date) if student.expiry_date else "",
        "courses": courses_ids,
        "enrollments": enrollments_data,
    })


@web_login_required
def course_detail_api(request: HttpRequest) -> JsonResponse:
    course_id = request.GET.get("id")
    if not course_id:
        return JsonResponse({"error": "Missing course ID"}, status=400)

    course = get_object_or_404(Course, id=course_id)
    links_data = [{"title": link.title, "url": link.url} for link in course.links.all()]
    return JsonResponse({
        "id": course.id,
        "name": course.name,
        "spotlight_id": course.spotlight_id or "",
        "description": course.description or "",
        "web_link": course.web_link or "",
        "links": links_data,
    })



@web_login_required
def student_detail_view(request: HttpRequest, student_id: int) -> HttpResponse:
    student = get_object_or_404(Customer, id=student_id)
    enrollments = student.enrollments.select_related("course").prefetch_related("course__links").all()

    context = _base_context()
    context.update({
        "student": student,
        "enrollments": enrollments,
        "operator_email": request.session.get("operator_email", ""),
    })
    return render(request, "botapp/student_detail.html", context)


@web_login_required
def sync_courses_view(request: HttpRequest) -> HttpResponse:
    from .services import sync_courses_from_voomly
    try:
        result = sync_courses_from_voomly()
        messages.success(
            request, 
            f"Đồng bộ khóa học từ Voomly thành công! Đã thêm mới {result['created']} khóa học, cập nhật {result['updated']} khóa học (Tổng số từ API: {result['total']})."
        )
    except Exception as e:
        messages.error(request, f"Lỗi khi đồng bộ khóa học từ Voomly: {e}")
    
    return redirect("courses")


@web_login_required
def update_course_website_api(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Phương thức không được hỗ trợ"}, status=405)
    
    import json
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Dữ liệu JSON không hợp lệ"}, status=400)
        
    course_id = data.get("id")
    web_link = data.get("web_link", "").strip()
    
    if not course_id:
        return JsonResponse({"error": "Thiếu ID khóa học"}, status=400)
        
    course = get_object_or_404(Course, id=course_id)
    course.web_link = web_link
    course.save(update_fields=["web_link"])
    
    return JsonResponse({
        "success": True,
        "message": f"Đã cập nhật website cho khóa học '{course.name}' thành công.",
        "web_link": course.web_link
    })


@web_login_required
def sync_students_view(request: HttpRequest) -> HttpResponse:
    from .services import sync_all_students_from_voomly
    try:
        result = sync_all_students_from_voomly()
        messages.success(
            request,
            f"Đồng bộ học viên từ Voomly thành công! Đã đồng bộ tổng cộng {result['total_students']} học viên của {result['courses_count']} khóa học."
        )
    except Exception as e:
        messages.error(request, f"Lỗi khi đồng bộ học viên từ Voomly: {e}")
    
    return redirect("dashboard")


@web_login_required
def student_search_api(request: HttpRequest) -> JsonResponse:
    query = request.GET.get("q", "").strip()
    page_number = request.GET.get("page", 1)
    course_id = request.GET.get("course_id")

    students_query = Customer.objects.all().order_by("-created_at")
    if query:
        from django.db.models import Q
        students_query = students_query.filter(
            Q(full_name__icontains=query) |
            Q(customer_email__icontains=query) |
            Q(phone_number__icontains=query)
        )

    enrolled_student_ids = set()
    if course_id:
        from .models import Enrollment
        enrolled_student_ids = set(
            Enrollment.objects.filter(course_id=course_id).values_list("customer_id", flat=True)
        )

    from django.core.paginator import Paginator
    paginator = Paginator(students_query, 10)
    
    try:
        page_obj = paginator.page(page_number)
    except Exception:
        page_obj = paginator.page(1)

    students_data = []
    for s in page_obj:
        students_data.append({
            "id": s.id,
            "full_name": s.full_name,
            "customer_email": s.customer_email,
            "phone_number": s.phone_number,
            "is_enrolled": s.id in enrolled_student_ids
        })

    return JsonResponse({
        "students": students_data,
        "pagination": {
            "current_page": page_obj.number,
            "total_pages": paginator.num_pages,
            "has_next": page_obj.has_next(),
            "has_prev": page_obj.has_previous(),
            "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
            "prev_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None,
            "total_count": paginator.count
        }
    })


@web_login_required
def enroll_student_view(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        return redirect("courses")
    
    course_id = request.POST.get("course_id")
    student_id = request.POST.get("student_id")
    
    course = get_object_or_404(Course, id=course_id)
    
    from django.utils import timezone
    from datetime import datetime, timedelta
    today = timezone.localdate()
    
    reg_date_str = request.POST.get("registration_date")
    exp_date_str = request.POST.get("expiry_date")
    status = request.POST.get("status", "ACTIVE")
    
    if reg_date_str:
        try:
            reg_date = datetime.strptime(reg_date_str, "%Y-%m-%d").date()
        except ValueError:
            reg_date = today
    else:
        reg_date = today
        
    if exp_date_str:
        try:
            exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date()
        except ValueError:
            exp_date = reg_date + timedelta(days=365)
    else:
        exp_date = reg_date + timedelta(days=365)
        
    student = None
    if student_id:
        student = get_object_or_404(Customer, id=student_id)
    else:
        email = request.POST.get("customer_email", "").strip().lower()
        full_name = request.POST.get("full_name", "").strip()
        phone_number = normalize_phone_number(request.POST.get("phone_number", ""))
        
        if not email:
            messages.error(request, "Email học viên không được để trống.")
            return redirect("course_detail", course_id=course.id)
            
        student, created = Customer.objects.get_or_create(
            customer_email=email,
            defaults={
                "full_name": full_name,
                "phone_number": phone_number,
            }
        )
        if not created:
            if not student.full_name and full_name:
                student.full_name = full_name
            if not student.phone_number and phone_number:
                student.phone_number = phone_number
            student.save()


    from botapp.models import Enrollment
    enrollment, created = Enrollment.objects.update_or_create(
        customer=student,
        course=course,
        defaults={
            "registration_date": reg_date,
            "expiry_date": exp_date,
            "status": status,
        }
    )
    
    student.sync_overall_fields()
    
    # Sync with Voomly if course has spotlight_id
    voomly_sync_msg = ""
    if course.spotlight_id:
        from .services import add_student_to_voomly, wait_for_voomly_student
        success = add_student_to_voomly(
            course=course,
            name=student.full_name or "Học viên",
            email=student.customer_email,
            phone=student.phone_number or ""
        )
        if success:
            wait_for_voomly_student(course, student.customer_email)
            voomly_sync_msg = " và đồng bộ thành công sang Voomly"
        else:
            voomly_sync_msg = " nhưng không đồng bộ được sang Voomly (Vui lòng kiểm tra log)"
            
    if created:
        messages.success(request, f"Đã thêm thành công học viên '{student.customer_email}' vào khóa học '{course.name}'{voomly_sync_msg}.")
    else:
        messages.success(request, f"Đã cập nhật thông tin đăng ký của học viên '{student.customer_email}' trong khóa học '{course.name}'{voomly_sync_msg}.")
        
    return redirect("course_detail", course_id=course.id)


@web_login_required
def course_detail_view(request: HttpRequest, course_id: int) -> HttpResponse:
    course = get_object_or_404(Course, id=course_id)
    student_count = Enrollment.objects.filter(course=course).count()
    voomly_students = []
    voomly_error = ""
    if course.spotlight_id:
        from .services import fetch_students_for_course
        try:
            voomly_students = fetch_students_for_course(course)
        except Exception as exc:
            voomly_error = str(exc)


    # Lọc tìm kiếm học viên đã đăng ký trong khóa học này
    context = _base_context()
    context.update({
        "course": course,
        "student_count": student_count,
        "voomly_students": voomly_students,
        "voomly_error": voomly_error,
        "operator_email": request.session.get("operator_email", ""),
    })
    return render(request, "botapp/course_detail.html", context)
