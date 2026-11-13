from django.db import migrations


def approve_existing_doctors(apps, schema_editor):
    """Doctors who registered before verification existed stay trusted. Admins can revoke any of them."""
    User = apps.get_model('accounts', 'User')
    DoctorVerification = apps.get_model('accounts', 'DoctorVerification')
    for user_id in User.objects.filter(role='doctor').values_list('pk', flat=True):
        DoctorVerification.objects.get_or_create(user_id=user_id, defaults={'status': 'approved'})


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_doctor_verification'),
    ]

    operations = [
        # Reversing does nothing: the rows it made cannot be told apart from later ones.
        migrations.RunPython(approve_existing_doctors, migrations.RunPython.noop),
    ]
