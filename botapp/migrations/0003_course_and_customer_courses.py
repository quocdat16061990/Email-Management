from django.db import migrations, models


COURSE_SEED_DATA = [
    ("ChatGPT Automation", "Tự động hóa quy trình làm việc với ChatGPT."),
    ("Prompt Engineering Basic", "Nền tảng viết prompt hiệu quả cho công việc hằng ngày."),
    ("AI Support Agent", "Xây dựng và vận hành agent hỗ trợ khách hàng."),
    ("Python for Office", "Ứng dụng Python để xử lý công việc văn phòng."),
    ("Email Workflow Mastery", "Tối ưu quy trình email và quản lý hộp thư."),
]


def seed_courses_and_assign_customers(apps, schema_editor):
    Course = apps.get_model("botapp", "Course")
    Customer = apps.get_model("botapp", "Customer")

    seeded_courses = {}
    course_names = [name for name, _ in COURSE_SEED_DATA]
    for name, description in COURSE_SEED_DATA:
        course, _ = Course.objects.get_or_create(name=name, defaults={"description": description})
        seeded_courses[name] = course

    for customer in Customer.objects.all().iterator():
        seed = abs(customer.telegram_chat_id or 0) + sum(ord(char) for char in (customer.customer_email or "").lower())
        primary_name = customer.course_name if customer.course_name in seeded_courses else course_names[seed % len(course_names)]
        secondary_name = course_names[(seed + 2) % len(course_names)]

        customer.courses.add(seeded_courses[primary_name])
        if secondary_name != primary_name:
            customer.courses.add(seeded_courses[secondary_name])


class Migration(migrations.Migration):
    dependencies = [
        ("botapp", "0002_customer_profile_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Course",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, unique=True)),
                ("description", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddField(
            model_name="customer",
            name="courses",
            field=models.ManyToManyField(blank=True, related_name="customers", to="botapp.course"),
        ),
        migrations.RunPython(seed_courses_and_assign_customers, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="customer",
            name="course_name",
        ),
    ]
