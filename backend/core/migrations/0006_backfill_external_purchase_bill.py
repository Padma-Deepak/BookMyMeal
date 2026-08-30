from django.db import migrations


def backfill_bill(apps, schema_editor):
    ExternalPurchase = apps.get_model('core', 'ExternalPurchase')
    Bill = apps.get_model('core', 'Bill')

    for ep in ExternalPurchase.objects.filter(bill__isnull=True, is_paid_by_caretaker=False):
        latest_bill = Bill.objects.filter(guest=ep.guest).order_by('-created_at').first()
        if latest_bill:
            ep.bill = latest_bill
            ep.save(update_fields=['bill'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_add_bill_to_external_purchase"),
    ]

    operations = [
        migrations.RunPython(backfill_bill, noop_reverse),
    ]
