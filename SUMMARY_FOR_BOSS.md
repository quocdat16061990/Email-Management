# 🎓 Anhlaptrinh Management — Hệ thống Quản lý Học viên & Tự động hóa OTP

> **Phiên bản:** 1.0 | **Ngày:** 05/2026
> **Phát triển bởi:** Anh Lập Trình (Trợ lý Thu Nhi)

---

## 📝 Mô tả dự án

Hệ thống quản lý học viên tập trung, tự động hóa việc lấy mã OTP OpenAI qua Telegram, và đồng bộ dữ liệu khóa học & học viên từ Voomly. Dashboard React SPA giúp admin quản lý toàn bộ học viên, khóa học, đăng ký trên một nền tảng duy nhất.

---

## 🎯 Vấn đề được giải quyết

| # | Vấn đề | Giải pháp |
|---|---|---|
| 1 | **OTP OpenAI mất thời gian** — Học viên phải tự mở Gmail, tìm mã OTP thủ công | Bot Telegram tự động quét Gmail, trả OTP trong **5-30 giây** |
| 2 | **Quản lý học viên rời rạc** — Không có dashboard, phải vào từng chỗ để xem thông tin | Dashboard React SPA hiển thị toàn bộ học viên, khóa học, trạng thái |
| 3 | **Đồng bộ Voomly thủ công** — Khóa học & học viên mới phải nhập tay | Click 1 nút, đồng bộ tự động **100+ khóa, 4000+ học viên trong ~35 giây** |
| 4 | **Tra cứu thông tin chậm** — Admin phải mở DB hoặc hỏi lại học viên | Tra cứu qua Telegram: gõ `/lookup`, có ngay email, tên, SĐT, khóa học |

---

## 📊 Lợi ích kinh doanh

| Chỉ tiêu | Trước đây | Hiện tại | Cải thiện |
|---|---|---|---|
| ⏱ Thời gian lấy OTP | 2-5 phút (thủ công) | 5-30 giây (tự động) | **~10x nhanh hơn** |
| 🔄 Đồng bộ Voomly | Nhập tay từng cái | 1 click, ~35 giây | **Xóa bỏ hoàn toàn công sức nhập liệu** |
| 🔍 Tra cứu học viên | Mở DB / gọi điện hỏi lại | /lookup Telegram, 1 giây | **Tức thì** |
| 🖥 Giao diện quản lý | Không có | Dashboard React SPA | **Luôn sẵn sàng** |
| 🔄 Load lại trang | Có (công nghệ cũ) | Không (React SPA) | **Trải nghiệm mượt mà** |

---

## 🏗 Kiến trúc tổng thể

```
                     ┌─────────────────────────────┐
                     │     Người dùng cuối          │
                     │     (Học viên)               │
                     │     ┌──────────────────┐     │
                     │     │  Telegram Bot    │     │
                     │     │  • Lấy OTP       │     │
                     │     │  • Xem khóa học  │     │
                     │     └────────┬─────────┘     │
                     └─────────────┼─────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌────────────────────┐   ┌──────────────────┐   ┌────────────────────┐
│  Admin             │   │  Django Backend  │   │  Voomly API        │
│  (Nhân viên)       │   │  (REST API)      │   │  (Bên thứ ba)      │
│  ┌──────────────┐  │   │                  │   │                    │
│  │ React SPA    │  │   │  ┌────────────┐  │   │  • Khóa học        │
│  │ Dashboard    │──┼──▶  │  Services  │──┼──▶  │  • Học viên        │
│  │              │  │   │  └────────────┘  │   └────────────────────┘
│  └──────────────┘  │   │                  │
└────────────────────┘   │  ┌────────────┐  │
                         │  │ Database   │  │
                         │  │ PostgreSQL │  │
                         │  │ (Supabase) │  │
                         │  └────────────┘  │
                         └──────────────────┘
```

---

## 🖥 Các chức năng chính

### 1. Bot Telegram (dành cho học viên)

- 🔑 **Tự động lấy OTP OpenAI**: Gửi mã OTP trên OpenAI → bấm nút trong Telegram → bot tự quét Gmail, trả về mã OTP
- 📚 **Xem khóa học đã đăng ký**: Danh sách kèm ngày hết hạn, tiến trình
- 👤 **Xem thông tin cá nhân**: Email, tên, SĐT, trạng thái

### 2. Web Dashboard (dành cho admin)

- 👥 **Quản lý học viên**: Thêm, sửa, xóa, tìm kiếm — tất cả không reload trang
- 📚 **Quản lý khóa học**: Thêm, sửa, xóa, phân trang
- 🔗 **Đăng ký học viên vào khóa học**: Chọn học viên có sẵn hoặc tạo mới
- 🔄 **Đồng bộ Voomly**: 1 click đồng bộ toàn bộ khóa học & học viên
- 📊 **Thống kê**: Tổng học viên, đang hoạt động, chờ xử lý, đã hết hạn

### 3. Hệ thống đồng bộ Voomly

- Đồng bộ **tự động** khóa học (Spotlights) từ Voomly
- Đồng bộ **học viên** của từng khóa học (phân trang, xử lý song song)
- Xử lý **trùng lặp**: Cập nhật thông tin nếu đã tồn tại
- Tối ưu hiệu năng: **~35 giây** cho 91 khóa học & 4,280 học viên

---

## 🔧 Công nghệ sử dụng

| Thành phần | Công nghệ | Mục đích |
|---|---|---|
| **Backend** | Django (Python) | REST API, xử lý logic, kết nối database |
| **Frontend** | React + TypeScript + Vite | Giao diện web SPA mượt mà |
| **Styling** | Tailwind CSS + shadcn/ui | Giao diện đẹp, chuyên nghiệp |
| **Data Fetching** | TanStack React Query | Tự động cache, loading, error states |
| **Database** | PostgreSQL (Supabase) | Lưu trữ dữ liệu tập trung |
| **Bot** | python-telegram-bot | Tương tác với người dùng qua Telegram |
| **Email** | Gmail IMAP | Quét và lấy mã OTP |

---

## 📈 Kết quả đạt được

```
📊 Thống kê hệ thống (tính đến 05/2026)
─────────────────────────────────────
📚 Khóa học:         91+
👥 Học viên:        4,280+
✅ OTP tự động:     Hàng trăm lượt/tháng
🔄 Đồng bộ Voomly:  ~35 giây
📱 Người dùng:      Học viên + Admin

💾 Database:         Supabase PostgreSQL
```

---

## 🎯 Tóm tắt giá trị

> **"Một nền tảng duy nhất thay thế hoàn toàn quy trình thủ công:**
> - Học viên không cần tự lục Gmail tìm OTP — bot lo
> - Admin không cần nhập tay danh sách từ Voomly — 1 click là xong
> - Tra cứu thông tin học viên tức thì trên Telegram
> - Dashboard trực quan, mượt mà, không reload trang"

---

*Dự án được phát triển bởi **Anh Lập Trình** — Trợ lý **Thu Nhi***
