# Quy trình Đồng bộ Khóa học & Học viên từ Voomly API (Tài liệu Đào tạo Trợ lý AI / Developers)

Tài liệu này hướng dẫn chi tiết quy trình thiết kế, triển khai và tối ưu hóa hệ thống đồng bộ dữ liệu Khóa học & Học viên từ Voomly API về hệ thống Django (sử dụng cơ sở dữ liệu PostgreSQL trên Supabase). 

---

## 1. Tổng quan yêu cầu & Kiến trúc dữ liệu

### Mục tiêu:
* Đồng bộ danh sách khóa học (Spotlights) từ Voomly thành các thực thể `Course` trong Django.
* Đồng bộ danh sách khách hàng mua khóa học trên Voomly về bảng `Customer` và liên kết thông qua thực thể trung gian `Enrollment` (Đăng ký học).

### Quan hệ dữ liệu (Database Schema):
1. **Course**:
   * Có trường `spotlight_id` (CharField, unique) để ánh xạ với khóa học trên Voomly.
   * `web_link` là URL của khóa học.
2. **Customer**:
   * Chứa thông tin tổng hợp của học viên: `customer_email` (EmailField, unique), `full_name`, `phone_number`.
   * Các trường tổng hợp: `registration_date` (ngày đăng ký sớm nhất), `expiry_date` (ngày hết hạn muộn nhất), `status` (`ACTIVE` nếu có ít nhất 1 khóa đang kích hoạt).
3. **Enrollment (Bảng trung gian)**:
   * Liên kết `Customer` và `Course`.
   * Lưu thông tin cụ thể của học viên cho từng khóa học: `registration_date` (ngày đăng ký khóa này), `expiry_date` (ngày hết hạn khóa này), `status` (`ACTIVE`/`PENDING`/`EXPIRED` của khóa này).

---

## 2. Đặc điểm API Voomly & Quy trình gọi API

### API 1: Lấy danh sách khóa học
* **URL**: `GET https://api.voomly.com/spotlights?tiny=1`
* **Headers**: Cần Authorization Bearer Token (`settings.VOOMLY_BEARER_TOKEN`).
* **Mô tả**: Trả về danh sách spotlights. Dùng trường `id` làm `spotlight_id` và trường `name` làm tên khóa học.

### API 2: Lấy danh sách học viên của một Spotlight
* **URL**: `GET https://api.voomly.com/spotlights/{spotlight_id}/customers`
* **Query Parameters bắt buộc**:
  * `startTime`: `"1970-01-01T07:00:00"` (Lấy từ mốc thời gian này).
  * `endTime`: Thời gian hiện tại theo định dạng ISO `"YYYY-MM-DDTHH:MM:SS"`.
  * `timeZone`: `"Etc/GMT-7"` (Múi giờ bắt buộc của API).
  * `sortField`: `"createdAt"`, `sortDirection`: `"desc"`.
  * `skip`: Điểm bắt đầu phân trang (Ví dụ: `0`, `100`, `200`...).
  * `limit`: Số bản ghi tối đa mỗi trang (Bắt buộc phải **<= 100**).
* **Cơ chế Phân trang (Paging)**:
  * Do giới hạn `limit <= 100`, bắt buộc phải sử dụng vòng lặp `while True`.
  * Tăng biến `skip` lên một lượng bằng `limit` sau mỗi lượt gọi thành công.
  * Dừng vòng lặp khi số phần tử nhận được trong trang hiện tại bé hơn `limit`.

---

## 3. Kỹ thuật Tối ưu hóa Hiệu năng (Parallel & Bulk Pattern)

> [!IMPORTANT]
> **Vấn đề nghẽn PgBouncer**: Cơ sở dữ liệu PostgreSQL trên Supabase sử dụng PgBouncer ở chế độ Transaction Pooling.
> * Nếu thực hiện truy vấn cơ sở dữ liệu (SELECT/INSERT/UPDATE) riêng lẻ cho từng học viên bên trong các luồng (thread) song song, kết nối sẽ bị nghẽn (connection exhaust) dẫn đến đứng ứng dụng (deadlock).
> * Nếu thực hiện tuần tự một-một (N+1 query) trên luồng chính, độ trễ mạng Việt Nam - AWS Hàn Quốc (~100-150ms) sẽ khiến việc xử lý 4,200 bản ghi mất tới hơn 15 phút.

### Giải pháp tối ưu (Quy trình 3 bước):

### Bước 1: Gọi API song song (Parallel API Fetching)
* Chạy `ThreadPoolExecutor` với tối đa `15` workers.
* **Quy tắc vàng**: **KHÔNG** thực hiện bất kỳ câu lệnh ORM Django nào trong luồng phụ. Chỉ gọi HTTP GET để lấy dữ liệu thô và đưa vào một cấu trúc dữ liệu tạm thời (dictionary) trên RAM:
```python
course_to_students = {}
with ThreadPoolExecutor(max_workers=15) as executor:
    future_to_course = {executor.submit(fetch_students_for_course, course): course for course in courses}
    for future in as_completed(future_to_course):
        ...
```

### Bước 2: Tải dữ liệu hiện tại lên bộ nhớ (In-memory Matching)
* Gom tất cả email nhận được từ API vào một Set `all_emails`.
* Truy vấn toàn bộ Customers hiện tại có trong tập email này bằng **1 câu lệnh duy nhất**:
  ```python
  existing_customers = {cust.customer_email: cust for cust in Customer.objects.filter(customer_email__in=all_emails)}
  ```
* Truy vấn toàn bộ Enrollments hiện tại của các học viên này bằng **1 câu lệnh duy nhất**:
  ```python
  existing_enrollments = {(e.customer_id, e.course_id): e for e in Enrollment.objects.filter(customer__customer_email__in=all_emails)}
  ```

### Bước 3: Ghi dữ liệu hàng loạt (Bulk DB operations)
Thao tác hoàn toàn trong một khối `transaction.atomic()` trên luồng chính:
1. **Khởi tạo Customer mới**:
   * Kiểm tra trong `existing_customers`, nếu chưa có, đưa vào danh sách `new_customers_to_create`.
   * Sử dụng `Customer.objects.bulk_create(new_customers_to_create, ignore_conflicts=True)`.
   * Truy vấn lại `existing_customers` để cập nhật ID tự sinh của các bản ghi mới.
2. **Cập nhật Customer cũ**:
   * Nếu có thay đổi tên (`full_name`), đưa vào danh sách `customers_to_update_name`.
   * Thực hiện `Customer.objects.bulk_update(customers_to_update_name, fields=["full_name"])`.
3. **Xử lý Enrollment**:
   * Khớp cặp `(customer.id, course.id)`. Nếu chưa tồn tại trong `existing_enrollments`, đưa vào `enrolls_to_create`.
   * Nếu đã tồn tại nhưng ngày đăng ký/hết hạn/trạng thái thay đổi, cập nhật thực thể trên bộ nhớ và đưa vào `enrolls_to_update`.
   * Chạy `Enrollment.objects.bulk_create(enrolls_to_create)`.
   * Chạy `Enrollment.objects.bulk_update(enrolls_to_update, fields=["registration_date", "expiry_date", "status"])`.
4. **Cập nhật tổng hợp thông tin Customer (Overall Aggregate Fields)**:
   * Tính toán lại `registration_date` (sớm nhất), `expiry_date` (muộn nhất), `status` của từng Customer bị ảnh hưởng trong bộ nhớ.
   * Chạy `Customer.objects.bulk_update(customers_to_bulk_update, fields=["registration_date", "expiry_date", "status"])`.

> [!TIP]
> **Hiệu quả thực tế**: Giảm từ ~8,400 truy vấn cơ sở dữ liệu xuống còn đúng **7-8 truy vấn**. Thời gian đồng bộ 91 khóa học & 4,280 học viên giảm từ **>15 phút** xuống chỉ còn **~35 giây**.

---

## 4. Triển khai Giao diện (UI/UX) và Tương tác AJAX

### Nguyên tắc thiết kế Premium:
* **Khóa thao tác (Disable state)**: Khi người dùng nhấn nút "Đồng bộ", lập tức thêm thuộc tính `disabled` cho nút để ngăn ngừa việc bấm đúp tạo ra nhiều luồng fetch dữ liệu đồng thời.
* **Trạng thái Loading**: Hiển thị Spinner hoạt họa hoặc icon xoay tròn kèm text thay đổi (ví dụ: `Đang đồng bộ...`) để người dùng biết hệ thống đang phản hồi.
* **Thông báo kết quả (Django Messages & Toast)**: Sau khi redirect, hiển thị thông báo Alert/Toast trực quan (xanh lá nếu thành công, đỏ nếu lỗi) kèm thống kê số lượng dữ liệu đã đồng bộ.

---

## 5. Hướng dẫn Viết Kịch bản Kiểm thử độc lập (Script-based Testing)

Để kiểm chứng tính đúng đắn của logic trước khi đưa lên UI hoặc tránh reload server liên tục, hãy xây dựng kịch bản kiểm thử độc lập chạy qua terminal.

**Cấu trúc mẫu của một script kiểm thử Django**:
```python
import os
import django
import sys
from pathlib import Path

def setup_and_test():
    # 1. Thêm root của dự án vào sys.path để import được các app con
    project_root = str(Path(__file__).resolve().parents[2]) # Tùy thuộc vị trí file script
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
        
    # 2. Thiết lập cấu hình Django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

    # 3. Import các models & services và chạy thử nghiệm
    from botapp.models import Course, Customer
    from botapp.services import sync_all_students_from_voomly

    print("Số lượng học viên trước:", Customer.objects.count())
    res = sync_all_students_from_voomly()
    print("Kết quả đồng bộ:", res)
    print("Số lượng học viên sau:", Customer.objects.count())

if __name__ == "__main__":
    setup_and_test()
```

Kịch bản này cho phép bạn đo thời gian chạy thực tế (`time.time()`) và kiểm tra dữ liệu log trực tiếp mà không cần khởi chạy trình duyệt.

---

## 6. Bug Log & Known Issues

### Bug #001: `endTime` sai múi giờ làm API Voomly trả về thiếu học viên

**Ngày phát hiện:** 2026-05-22
**File:** [botapp/services.py](botapp/services.py) — hàm `fetch_students_for_course`

**Triệu chứng:**
- API Voomly gọi trực tiếp bằng curl trả về đủ học viên (VD: 4 items)
- Django gọi API qua `fetch_students_for_course` chỉ nhận được ít hơn (VD: 2 items)
- Web hiển thị thiếu học viên mới thêm

**Nguyên nhân:**
- `endTime` được set bằng `timezone.now().strftime(...)` — trả về **giờ UTC**
- API Voomly có tham số `timeZone=Etc/GMT-7` để biết múi giờ của dữ liệu
- Voomly interpret `endTime` dựa trên timeZone đó, không phải UTC
- VD: Django gửi `endTime=2026-05-22T06:20:49` (giờ UTC), Voomly hiểu là `06:20 Bangkok` = `23:20 UTC hôm trước`
- Kết quả: filter sai, bỏ sót học viên được thêm sau 23:20 UTC

**Fix:**
```
# Trước (sai):
"endTime": timezone.now().strftime("%Y-%m-%dT%H:%M:%S")

# Sau (đúng):
"endTime": timezone.localtime().strftime("%Y-%m-%dT%H:%M:%S")
```

`timezone.localtime()` trả về giờ đúng của múi giờ `TIME_ZONE` trong settings (Asia/Bangkok, GMT+7), khớp với `timeZone=Etc/GMT-7` của API.

**Lesson:** Khi gọi API có tham số `timeZone`, `endTime` phải được tính theo chính múi giờ đó, không phải UTC.
