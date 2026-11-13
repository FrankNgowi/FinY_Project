from django.db import migrations, models
from django.db.models.functions import Length

MAX_LENGTH = 2000


def refuse_if_any_body_is_too_long(apps, schema_editor):
    """Stop before changing the column if existing data would not fit in it.

    The whole migration runs in one transaction, so nothing is altered when this raises.
    """
    message = apps.get_model('messaging', 'Message')
    too_long = message.objects.annotate(size=Length('body')).filter(size__gt=MAX_LENGTH).count()
    if too_long:
        raise RuntimeError(
            f'{too_long} message(s) are longer than {MAX_LENGTH} characters, so the message '
            f'column cannot be limited yet. Shorten or delete those messages (find them with '
            f'Message.objects.annotate(n=Length("body")).filter(n__gt={MAX_LENGTH})), '
            f'then run the migration again.'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(refuse_if_any_body_is_too_long, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='message',
            name='body',
            field=models.CharField(max_length=MAX_LENGTH),
        ),
    ]
