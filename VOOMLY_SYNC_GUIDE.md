# Quy trình Đồng bộ Khóa học & Học viên từ Voomly API

Tài liệu kỹ thuật dành cho Developer — hướng dẫn chi tiết thiết kế, triển khai và tối ưu hệ thống đồng bộ dữ liệu Khóa học & Học viên từ Voomly API về Django (PostgreSQL / Supabase).

---

## Mục lục

1. [Tổng quan & Kiến trúc dữ liệu](#1-tổng-quan--kiến-trúc-dữ-liệu)
2. [API Voomly & Quy trình gọi](#2-api-voomly--quy-trình-gọi-api)
3. [Tối ưu hiệu năng (Parallel & Bulk Pattern)](#3-kỹ-thuật-tối-ưu-hóa-hiệu-năng)
4. [UI/UX cho đồng bộ](#4-uiux-cho-đồng-bộ)
5. [Script kiểm thử độc lập](#5-script-kiểm-thử-độc-lập)
6. [Bug Log](#6-bug-log)

---

## 1. Tổng quan & Kiến trúc dữ liệu

### Mục tiêu

- Đồng bộ danh sách khóa học (Spotlights) từ Voomly → bảng `Course`
- Đồng bộ danh sách học viên mua khóa học từ Voomly → bảng `Customer` + `Enrollment`

### Database Schema

```
┌─────────────────────────────────────────────────────┐
│                    Course                            │
├─────────────────────────────────────────────────────┤
│ id (PK)           │ BigAutoField                     │
│ spotlight_id      │ CharField(50) — UNIQUE, nullable │
│ name              │ CharField(255) — UNIQUE          │
│ description       │ TextField                        │
│ web_link          │ URLField(500)                    │
│ created_at        │ DateTimeField                    │
└─────────┬───────────────────────────────────────────┘
          │ 1
          │
          │ *
┌─────────┴───────────────────────────────────────────┐
│                    Enrollment                        │
├─────────────────────────────────────────────────────┤
│ id (PK)           │ BigAutoField                     │
│ customer_id       │ FK → Customer                   │
│ course_id         │ FK → Course                     │
│ registration_date │ DateField                        │
│ expiry_date       │ DateField                        │
│ status            │ CharField(20) — ACTIVE/PENDING.. │
│ created_at        │ DateTimeField                    │
└─────────┬───────────────────────────────────────────┘
          │ *
          │ 1
┌─────────┴───────────────────────────────────────────┐
│                    Customer                          │
├─────────────────────────────────────────────────────┤
│ id (PK)           │ BigAutoField                     │
│ telegram_chat_id  │ BigInteger — UNIQUE, nullable    │
│ customer_email    │ EmailField — UNIQUE              │
│ full_name         │ CharField(255)                   │
│ phone_number      │ CharField(20)                    │
│ registration_date │ DateField — min của enrollments  │
│ expiry_date       │ DateField — max của enrollments  │
│ status            │ CharField(20)                    │
│ has_sent_otp      │ BooleanField                     │
│ created_at        │ DateTimeField                    │
└─────────────────────────────────────────────────────┘
```

### Quan hệ

- **Course** 1──* **Enrollment** *──1 **Customer**
- `Customer.registration_date` = min(Enrollment.registration_date)
- `Customer.expiry_date` = max(Enrollment.expiry_date)
- `Customer.status` = ACTIVE nếu có Enrollment nào ACTIVE, PENDING nếu có PENDING, còn lại EXPIRED

### File thực thi

| File | Vai trò |
|---|---|
| [botapp/models.py](botapp/models.py) | Định nghĩa Course, Customer, Enrollment, CourseLink |
| [botapp/services.py](botapp/services.py) | Logic xử lý: fetch, sync, bulk create/update |
| [botapp/views.py](botapp/views.py) | API endpoints cho React frontend |

---

## 2. API Voomly & Quy trình gọi API

### API 1: Lấy danh sách khóa học

```
GET https://api.voomly.com/spotlights?tiny=1
Authorization: Bearer {token}
```

**Response:**
```json
[
  { "id": "rwbteni8pn", "name": "(Cũ) Python Revit API" },
  { "id": "o8qrc9e8aa", "name": "(Cũ) Tự Động Hóa Công Việc Nhàm Chán Với Python (Cũ)" }
]
```

**Xử lý:**
- `id` → `Course.spotlight_id`
- `name` → `Course.name`
- Nếu `spotlight_id` đã tồn tại → cập nhật name
- Nếu `name` giống (case-insensitive) mà chưa có spotlight_id → gắn spotlight_id
- Còn lại → tạo mới

### API 2: Lấy danh sách học viên của một khóa học

```
GET https://api.voomly.com/spotlights/{spotlight_id}/customers
Authorization: Bearer {token}
```

**Query Parameters:**

| Param | Giá trị | Ghi chú |
|---|---|---|
| `startTime` | `1970-01-01T07:00:00` | Lấy từ đầu |
| `endTime` | `YYYY-MM-DDTHH:MM:SS` | Giờ Bangkok (GMT+7) |
| `timeZone` | `Etc/GMT-7` | **Bắt buộc** |
| `sortField` | `createdAt` | |
| `sortDirection` | `desc` | |
| `skip` | 0, 100, 200... | Phân trang |
| `limit` | ≤ 100 | Tối đa 100 item/trang |

⚠️ **QUAN TRỌNG:** `endTime` phải là **giờ Bangkok (GMT+7)**, không phải UTC. 

**Sai:**
```python
"endTime": timezone.now()  # → gửi giờ UTC
```

**Đúng:**
```python
"endTime": timezone.localtime()  # → gửi giờ Bangkok
```

### Cơ chế phân trang

```python
skip = 0
limit = 100
while True:
    response = requests.get(url, params={"skip": skip, "limit": limit, ...})
    items = response.json().get("items", [])
    if not items:
        break
    # Xử lý items
    skip += limit
```

### API 3: Thêm học viên lên Voomly

```
POST https://api.voomly.com/spotlights/{spotlight_id}/customers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Nguyễn Văn A",
  "email": "a@example.com",
  "password": "123456",
  "amount": 12300,
  "currency": "usd",
  "comment": "Tạo tự động — Skill add_student_voomly | Tên khóa học"
}
```

**Xử lý response:**
- 200/201 → thành công
- 403 + code `SPOTLIGHT_ACCOUNT_ALREADY_EXISTS` → học viên đã tồn tại (coi như thành công)
- Khác → thất bại

---

## 3. Kỹ thuật Tối ưu hóa Hiệu năng

### Vấn đề

Supabase PostgreSQL dùng **PgBouncer Transaction Pooling**:
- Query riêng lẻ từng học viên trong thread song song → **nghẽn kết nối (connection exhaust)** → deadlock
- Query tuần tự N+1 → độ trễ mạng VN - Hàn Quốc ~100-150ms/query → 4200 học viên = **>15 phút**

### Giải pháp (3 bước)

#### Bước 1: Gọi API song song (Parallel API Fetching)

Chạy `ThreadPoolExecutor` tối đa **15 workers**.

🚨 **KHÔNG được chạy ORM trong thread** — chỉ gọi HTTP GET thuần túy:

```python
course_to_students = {}
with ThreadPoolExecutor(max_workers=15) as executor:
    future_to_course = {
        executor.submit(fetch_students_for_course, course): course
        for course in courses
    }
    for future in as_completed(future_to_course):
        course = future_to_course[future]
        course_to_students[course] = future.result()
```

#### Bước 2: In-memory Matching

Tải toàn bộ dữ liệu DB cần so sánh lên RAM chỉ với **2 câu query**:

```python
# 1 query: load tất cả Customer khớp email
existing_customers = {
    cust.customer_email: cust
    for cust in Customer.objects.filter(customer_email__in=all_emails)
}

# 1 query: load tất cả Enrollment của các customer đó
existing_enrollments = {
    (e.customer_id, e.course_id): e
    for e in Enrollment.objects.filter(customer__customer_email__in=all_emails)
}
```

#### Bước 3: Bulk DB Operations

Tất cả trong 1 `transaction.atomic()`:

| Bước | Thao tác | Số câu query |
|---|---|---|
| 3.1 | `Customer.objects.bulk_create(new_customers, ignore_conflicts=True)` | 1 |
| 3.2 | Re-fetch existing_customers để lấy ID mới | 1 |
| 3.3 | `Customer.objects.bulk_update(name_changes, fields=["full_name"])` | 1 |
| 3.4 | `Enrollment.objects.bulk_create(new_enrolls)` | 1 |
| 3.5 | `Enrollment.objects.bulk_update(changed_enrolls, fields=[...])` | 1 |
| 3.6 | `Customer.objects.bulk_update(aggregate_changes, fields=[...])` | 1 |
| **Tổng** | | **7-8 queries** |

### Hiệu quả thực tế

| Chỉ tiêu | Trước (tuần tự) | Sau (song song + bulk) |
|---|---|---|
| Số câu query | ~8,400 | ~7-8 |
| Thời gian (91 khóa, 4,280 học viên) | >15 phút | ~35 giây |
| Tỉ lệ cải thiện | — | **~25x nhanh hơn** |

### Code mẫu đầy đủ

File [botapp/services.py](botapp/services.py) — hàm `sync_all_students_from_voomly()`:

```python
def sync_all_students_from_voomly() -> dict:
    courses = Course.objects.exclude(spotlight_id__isnull=True).exclude(spotlight_id="")

    # Bước 1: ThreadPool fetch song song (không ORM)
    course_to_students = {}
    with ThreadPoolExecutor(max_workers=15) as executor:
        future_to_course = {
            executor.submit(fetch_students_for_course, course): course
            for course in courses
        }
        for future in as_completed(future_to_course):
            course = future_to_course[future]
            course_to_students[course] = future.result()

    if not course_to_students:
        return {"total_students": 0, "courses_count": 0}

    # Gom tất cả email
    all_emails = set()
    for students in course_to_students.values():
        for s in students:
            all_emails.add(s["email"])

    # Bước 2 + 3: In-memory matching + bulk ops trong 1 transaction
    with transaction.atomic():
        existing_customers = {c.customer_email: c for c in Customer.objects.filter(customer_email__in=all_emails)}
        existing_enrollments = {
            (e.customer_id, e.course_id): e
            for e in Enrollment.objects.filter(customer__customer_email__in=all_emails)
        }
        # ... bulk_create, bulk_update ...
```

---

## 4. UI/UX cho Đồng bộ

### Button "Đồng bộ từ Voomly"

| State | Hiển thị |
|---|---|
| Mặc định | `🔄 Đồng bộ từ Voomly` |
| Đang xử lý | `<spinner> Đang đồng bộ...` (disabled) |
| Thành công | Toast xanh: "Đồng bộ thành công! N khóa học / M học viên." |
| Thất bại | Toast đỏ: "Lỗi: ..." |

### Các nút đồng bộ

| Trang | Nút | API gọi |
|---|---|---|
| `/courses` | "Đồng bộ từ Voomly" | `POST /api/sync/courses/` |
| `/dashboard` | "Đồng bộ từ Voomly" | `POST /api/sync/students/` |

### API Endpoints

| Method | URL | Chức năng |
|---|---|---|
| POST | `/api/sync/courses/` | Đồng bộ khóa học từ Voomly |
| POST | `/api/sync/students/` | Đồng bộ học viên từ Voomly |

---

## 5. Script kiểm thử độc lập

Test logic đồng bộ mà không cần mở trình duyệt:

```python
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from botapp.models import Course, Customer
from botapp.services import sync_all_students_from_voomly

print("👥 Số học viên trước:", Customer.objects.count())
print("📚 Số khóa học trước:", Course.objects.count())

import time
start = time.time()
res = sync_all_students_from_voomly()
elapsed = time.time() - start

print(f"✅ Kết quả: {res}")
print(f"⏱ Thời gian: {elapsed:.2f}s")
print(f"👥 Số học viên sau: {Customer.objects.count()}")
```

### Chạy

```bash
cd d:\Email-Management
python -c "exec(open('scripts/test_sync.py').read())"
```

Hoặc chạy trực tiếp terminal:

```python
# Kiểm tra fetch đơn lẻ
from botapp.models import Course
from botapp.services import fetch_students_for_course

course = Course.objects.filter(spotlight_id__isnull=False).first()
students = fetch_students_for_course(course)
print(f"Khóa: {course.name} — {len(students)} học viên")
```

---

## 6. Bug Log

### Bug #001: `endTime` sai múi giờ

| Thông tin | Giá trị |
|---|---|
| **Ngày** | 2026-05-22 |
| **File** | [botapp/services.py](botapp/services.py) — hàm `fetch_students_for_course` |
| **Triệu chứng** | API Voomly trả về 4 items (curl), nhưng Django chỉ nhận 2 items (web) |
| **Nghiêm trọng** | Cao — thiếu dữ liệu học viên |

**Phân tích root cause:**

```
Django gửi:  endTime = 2026-05-22T06:20:49   →  Đây là giờ UTC
Voomly hiểu: timeZone = Etc/GMT-7            →  Interpret là 06:20 Bangkok
Tính toán:   06:20 Bangkok = 23:20 UTC hôm trước
Kết quả:     Bỏ sót học viên thêm sau 23:20 UTC
```

**Fix:**
```python
# Trước (sai) — gửi giờ UTC
"endTime": timezone.now().strftime("%Y-%m-%dT%H:%M:%S")

# Sau (đúng) — gửi giờ Bangkok
"endTime": timezone.localtime().strftime("%Y-%m-%dT%H:%M:%S")
```

**Lesson:** Khi API có tham số `timeZone`, `endTime` phải tính theo múi giờ đó.

### Bug #002: Bot Telegram `SynchronousOnlyOperation`

| Thông tin | Giá trị |
|---|---|
| **Ngày** | 2026-05-22 |
| **File** | [botapp/bot.py](botapp/bot.py) |
| **Triệu chứng** | Bot crash khi user nhập email vì gọi ORM từ async context |

**Phân tích:** Trong async handler `handle_email`, gọi `customer.courses.all()` mà không wrap `sync_to_async`.

**Fix:**
```python
# Trước (lỗi):
assigned_courses = ", ".join(course.name for course in customer.courses.all())

# Sau (đúng):
courses_list = await sync_to_async(list)(customer.courses.all())
assigned_courses = ", ".join(course.name for course in courses_list)
```

**Lesson:** Luôn dùng `await sync_to_async(...)()` cho mọi ORM query trong async context.

---

## Phụ lục: File tham chiếu

| File | Nội dung |
|---|---|
| [botapp/services.py](botapp/services.py) | `fetch_students_for_course`, `sync_courses_from_voomly`, `sync_all_students_from_voomly`, `add_student_to_voomly`, `wait_for_voomly_student` |
| [botapp/models.py](botapp/models.py) | `Course`, `Customer`, `Enrollment`, `CourseLink`, `sync_overall_fields` |
| [botapp/views.py](botapp/views.py) | API endpoints: `api_sync_courses`, `api_sync_students`, `api_enroll_student` |
| [botapp/bot.py](botapp/bot.py) | Telegram bot handlers (async) |
| [config/settings.py](config/settings.py) | `VOOMLY_BEARER_TOKEN`, `TIME_ZONE` |

---

*Tài liệu cập nhật lần cuối: 2026-05-22*
