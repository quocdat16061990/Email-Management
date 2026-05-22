# ChatGPT OTP Bot + Quản lý Học viên

Dự án Django phục vụ 2 mục tiêu chính:

- **Bot Telegram**: Tự động lấy mã OTP OpenAI từ Gmail.
- **Web Dashboard**: Quản lý học viên, khóa học, đồng bộ dữ liệu với Voomly.

---

## Cấu trúc thư mục

```text
.
├── botapp/                    # Code chính (models, views, services, bot)
├── config/                    # Cấu hình Django (settings, urls)
├── templates/                 # Giao diện web (HTML + Bootstrap)
├── Skill_AddStudent_Voomly/   # Skill dành cho Claude Code
├── .env.example               # Mẫu file biến môi trường
├── .gitignore                 # Danh sách file bỏ qua khi push git
├── manage.py                  # Django CLI
├── migration.py               # Script migrate dữ liệu
├── otp_bot.py                 # Entry point chạy bot Telegram
├── requirements.txt           # Danh sách thư viện Python
├── VOOMLY_SYNC_GUIDE.md       # Tài liệu kỹ thuật đồng bộ Voomly
└── README.md                  # File hướng dẫn này
```

---

## Cài đặt

### 1. Yêu cầu

- **Python** >= 3.10
- **Git**

### 2. Tải code về

```powershell
git clone <đường-dẫn-repo>
cd Email-Management
```

### 3. Tạo môi trường ảo (khuyến nghị)

```powershell
python -m venv venv
venv\Scripts\activate
```

### 4. Cài thư viện

```powershell
pip install -r requirements.txt
```

### 5. Tạo file biến môi trường

```powershell
copy .env.example .env
```

Mở file `.env` và điền thông tin thật của bạn:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
EMAIL_ACCOUNT=your_gmail_address
APP_PASSWORD=your_gmail_app_password

# Web Dashboard
COMPANY_NAME=OTP Academy
COMPANY_LOGO_TEXT=OA
WEBAPP_LOGIN_EMAIL=admin@example.com
WEBAPP_LOGIN_PASSWORD=change-me

# Database (Supabase PostgreSQL - không bắt buộc)
DB_HOST=your_supabase_db_host
DB_PORT=6543
DB_NAME=postgres
DB_USER=your_supabase_db_user
DB_PASSWORD=your_supabase_db_password

# Voomly API (không bắt buộc)
VOOMLY_BEARER_TOKEN=your_voomly_token
```

> **Lưu ý**: Nếu không có Supabase, hệ thống sẽ tự động dùng SQLite (file `db.sqlite3` trên ổ cứng).

### 6. Tạo cơ sở dữ liệu

```powershell
python manage.py migrate
```

---

## Chạy ứng dụng

### Web Dashboard (terminal 1)

```powershell
python manage.py runserver
```

Mở trình duyệt tại `http://127.0.0.1:8000/`, đăng nhập bằng email/mật khẩu trong `.env`.

### Bot Telegram (terminal 2)

```powershell
python manage.py run_otp_bot
```

Hoặc:

```powershell
python otp_bot.py
```

---

## Hướng dẫn sử dụng

### Trên Web

| Trang | Mô tả |
|---|---|
| `http://127.0.0.1:8000/` | Đăng nhập |
| `/dashboard/` | Quản lý học viên (thêm, sửa, xóa, tìm kiếm) |
| `/courses/` | Danh sách khóa học, đồng bộ từ Voomly |
| `/courses/<id>/` | Chi tiết khóa học — thêm học viên, xem danh sách Voomly |

### Trên Telegram Bot

Tra cứu học viên bằng email hoặc số điện thoại:

```text
/lookup email@example.com
/lookup 0987654321
```

---

## Git: file nào push, file nào bỏ qua?

### 🔒 Các file bị git bỏ qua (trong `.gitignore`)

| File / Thư mục | Lý do bỏ qua |
|---|---|
| `.env` | **Chứa mật khẩu, token — bí mật tuyệt đối!** |
| `venv/`, `.venv/` | Môi trường ảo — mỗi máy tự tạo lại |
| `__pycache__/`, `*.pyc` | Cache bytecode của Python |
| `db.sqlite3` | Database local — mỗi máy dữ liệu riêng |
| `*.log` | File log trong lúc chạy |
| `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/` | Cache công cụ phát triển |
| `.coverage`, `htmlcov/` | Báo cáo kiểm thử |
| `.DS_Store`, `Thumbs.db` | File hệ thống (MacOS / Windows) |

### ✅ Các file được push lên git

| File | Mục đích |
|---|---|
| `botapp/` | Code ứng dụng |
| `config/` | Cấu hình Django |
| `templates/` | Giao diện web |
| `manage.py` | Django CLI |
| `requirements.txt` | Danh sách thư viện |
| `.env.example` | Mẫu cho người khác copy thành `.env` |
| `.gitignore` | Liệt kê file bỏ qua |
| `VOOMLY_SYNC_GUIDE.md` | Tài liệu kỹ thuật |

---

## Cài đặt trên máy khác (sau khi clone về)

```powershell
# 1. Vào thư mục
cd Email-Management

# 2. Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate

# 3. Cài thư viện
pip install -r requirements.txt

# 4. Tạo file .env từ mẫu
copy .env.example .env

# 5. Mở file .env và điền thông tin riêng của máy này
#    (token Telegram, Gmail, database...)

# 6. Tạo database
python manage.py migrate

# 7. Chạy thử
python manage.py runserver
```

> **Quan trọng**: File `.env` **không được đồng bộ qua git**. Mỗi máy phải tự tạo và điền thông tin riêng. Nếu cần chia sẻ, hãy gửi file `.env` qua kênh riêng (email, cloud mật...), đừng commit lên git.

---

## Liên kết

- [Hướng dẫn đồng bộ Voomly](VOOMLY_SYNC_GUIDE.md) — API Voomly, tối ưu hiệu năng, bug log
