import re
from datetime import timedelta

from django.db import migrations, models


COURSE_NAMES = [
    "ChatGPT Automation",
    "Prompt Engineering Basic",
    "AI Support Agent",
    "Python for Office",
    "Email Workflow Mastery",
]

FALLBACK_NAMES = [
    "Nguyen Minh Anh",
    "Tran Quoc Dat",
    "Le Hoang Nam",
    "Pham Gia Han",
    "Vo Thanh Tung",
]


def _fake_full_name(customer_email: str, seed: int) -> str:
    local_part = (customer_email or "").split("@", 1)[0]
    tokens = [token.capitalize() for token in re.split(r"[._-]+", local_part) if token and token.isalpha()]
    if tokens:
        return " ".join(tokens[:4])
    return FALLBACK_NAMES[seed % len(FALLBACK_NAMES)]


def _fake_phone_number(seed: int) -> str:
    return f"0{((seed % 900000000) + 100000000):09d}"


def populate_customer_profile(apps, schema_editor):
    Customer = apps.get_model("botapp", "Customer")

    for customer in Customer.objects.all().iterator():
        seed = abs(customer.telegram_chat_id or 0) + sum(ord(char) for char in (customer.customer_email or "").lower())
        registration_date = customer.created_at.date() if customer.created_at else None
        expiry_date = registration_date + timedelta(days=30 + (seed % 90)) if registration_date else None
        changes = []

        if not customer.full_name:
            customer.full_name = _fake_full_name(customer.customer_email, seed)
            changes.append("full_name")
        if not customer.phone_number:
            customer.phone_number = _fake_phone_number(seed)
            changes.append("phone_number")
        if not customer.registration_date and registration_date:
            customer.registration_date = registration_date
            changes.append("registration_date")
        if not customer.expiry_date and expiry_date:
            customer.expiry_date = expiry_date
            changes.append("expiry_date")
        if not customer.course_name:
            customer.course_name = COURSE_NAMES[seed % len(COURSE_NAMES)]
            changes.append("course_name")

        if changes:
            customer.save(update_fields=changes)


class Migration(migrations.Migration):
    dependencies = [
        ("botapp", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="course_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="expiry_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="customer",
            name="full_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="customer",
            name="phone_number",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="customer",
            name="registration_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RunPython(populate_customer_profile, migrations.RunPython.noop),
    ]
