import logging
import time

from asgiref.sync import sync_to_async
from django.conf import settings
from telegram import Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from .keyboards import build_fetch_otp_keyboard, build_restart_keyboard, build_start_keyboard
from .services import (
    create_or_update_customer,
    extract_otp_from_openai_email,
    is_valid_email,
    list_available_courses,
    lookup_customer_by_email,
    mark_customer_otp_received,
)


logger = logging.getLogger(__name__)

ASK_EMAIL = 0
ENROLLMENT_STATUS_LABELS = {
    "ACTIVE": "Đang hoạt động",
    "PENDING": "Chờ xử lý",
    "EXPIRED": "Đã hết hạn",
}


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text(
        "Xin chào. Bấm /start để bắt đầu.\n\nVui lòng nhập email của bạn.",
        reply_markup=build_start_keyboard(),
    )
    return ASK_EMAIL


async def handle_email(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    email_text = update.message.text.strip()

    if not is_valid_email(email_text):
        await update.message.reply_text("Email không hợp lệ. Vui lòng nhập lại email của bạn.")
        return ASK_EMAIL

    try:
        customer = await sync_to_async(create_or_update_customer)(update.effective_chat.id, email_text)
        available_courses = await sync_to_async(list_available_courses)()
    except Exception:
        logger.exception("Không tạo được phiên customer.")
        await update.message.reply_text(
            "Không khởi tạo được phiên làm việc lúc này. Vui lòng thử lại sau.",
            reply_markup=build_restart_keyboard(),
        )
        return ConversationHandler.END

    context.user_data["email"] = email_text
    context.user_data["otp_session_started_at"] = time.time()

    assigned_courses = ", ".join(course.name for course in customer.courses.all()) or "Chưa có khóa học nào."
    available_course_lines = "\n".join(
        f"{index}. {course.name}" for index, course in enumerate(available_courses, start=1)
    )
    if not available_course_lines:
        available_course_lines = "Hệ thống hiện chưa có khóa học nào."

    await update.message.reply_text(
        "Email hợp lệ.\n"
        f"Các khóa học hiện có:\n{available_course_lines}\n\n"
        f"Khóa học đã gán cho bạn: {assigned_courses}\n\n"
        "Bây giờ hãy bấm gửi OTP trên trang OpenAI, sau đó bấm nút bên dưới để tôi lấy OTP từ Gmail.",
        reply_markup=build_fetch_otp_keyboard(),
    )
    return ConversationHandler.END


async def fetch_openai_otp(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    email_text = context.user_data.get("email")

    if not email_text:
        context.user_data.clear()
        await query.message.reply_text(
            "Phiên xác thực không còn hợp lệ. Vui lòng bấm /start để thử lại.",
            reply_markup=build_start_keyboard(),
        )
        return

    await query.message.reply_text("Đang quét Gmail để tìm OTP OpenAI...")
    try:
        otp_code = await sync_to_async(extract_otp_from_openai_email)(
            timeout_seconds=settings.OTP_TTL_MINUTES * 60,
            interval_seconds=5,
            min_received_timestamp=context.user_data.get("otp_session_started_at"),
        )
    except Exception:
        logger.exception("Không đọc được Gmail OpenAI OTP.")
        await query.message.reply_text(
            "Không đọc được Gmail lúc này. Kiểm tra lại EMAIL_ACCOUNT và APP_PASSWORD.",
            reply_markup=build_restart_keyboard(),
        )
        return

    if not otp_code:
        await query.message.reply_text(
            "Không tìm thấy OTP OpenAI trong vòng 1 phút. Hãy bấm gửi OTP bên OpenAI rồi thử lại.",
            reply_markup=build_fetch_otp_keyboard(),
        )
        return

    await sync_to_async(mark_customer_otp_received)(query.message.chat_id, email_text)
    await query.message.reply_text(
        f"OTP OpenAI của bạn là: {otp_code}\nXong rồi. Cảm ơn bạn.",
        reply_markup=build_restart_keyboard(),
    )
    context.user_data.clear()


async def restart_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data.clear()
    await query.message.reply_text(
        "Xin chào. Bấm /start để bắt đầu.\n\nVui lòng nhập email của bạn.",
        reply_markup=build_start_keyboard(),
    )
    return ASK_EMAIL


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text(
        "Đã hủy phiên hiện tại. Bấm /start nếu muốn bắt đầu lại.",
        reply_markup=build_start_keyboard(),
    )
    return ConversationHandler.END


def _format_customer_summary(customer) -> str:
    enrollments = list(customer.enrollments.all())
    if enrollments:
        course_block = "\n".join(
            f"- {enroll.course.name} ({ENROLLMENT_STATUS_LABELS.get(enroll.status, enroll.status)})"
            for enroll in enrollments
        )
    else:
        course_block = "Chưa có khóa học"

    telegram_value = customer.telegram_chat_id if customer.telegram_chat_id is not None else "Chưa liên kết"
    status_vi = ENROLLMENT_STATUS_LABELS.get(customer.status, customer.status)
    return (
        f"Email: {customer.customer_email}\n"
        f"Họ tên: {customer.full_name or 'Chưa cập nhật'}\n"
        f"Số điện thoại: {customer.phone_number or 'Chưa cập nhật'}\n"
        f"Đang học:\n{course_block}\n"
        f"Trạng thái: {status_vi}\n"
        f"Telegram: {telegram_value}"
    )


async def lookup_customer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyword = " ".join(context.args).strip()
    if not keyword:
        await update.message.reply_text("Cú pháp: /lookup email@example.com")
        return

    if not is_valid_email(keyword):
        await update.message.reply_text("Vui lòng nhập đúng email học viên. Ví dụ: /lookup email@example.com")
        return

    customer = await sync_to_async(lookup_customer_by_email)(keyword)
    if not customer:
        await update.message.reply_text("Không tìm thấy học viên với email này.")
        return

    await update.message.reply_text(_format_customer_summary(customer))


def build_application() -> Application:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN chưa được cấu hình trong .env")

    application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    conversation_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            ASK_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_email)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        per_chat=True,
        per_user=True,
        per_message=False,
    )
    application.add_handler(conversation_handler)
    application.add_handler(CommandHandler("lookup", lookup_customer))
    application.add_handler(CallbackQueryHandler(restart_flow, pattern="^restart_flow$"))
    application.add_handler(CallbackQueryHandler(fetch_openai_otp, pattern="^fetch_openai_otp$"))
    return application


def run_bot() -> None:
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.INFO,
    )
    app = build_application()
    print("Bot dang chay va lang nghe tin nhan...")
    app.run_polling()
