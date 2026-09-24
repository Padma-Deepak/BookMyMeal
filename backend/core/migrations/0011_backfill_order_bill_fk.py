from django.db import migrations


def backfill_order_bill(apps, schema_editor):
    """Copy the old Bill.orders M2M into the new Order.bill FK before the M2M
    is dropped in the next migration. If an order were somehow attached to
    more than one bill under the old M2M (which the application never
    allowed via the API, but nothing enforced it at the DB level either),
    the most recently created bill wins — the FK can only point at one."""
    Bill = apps.get_model('core', 'Bill')
    for bill in Bill.objects.order_by('created_at').prefetch_related('orders'):
        bill.orders.update(bill=bill)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_order_bill_fk_stage1_add'),
    ]

    operations = [
        migrations.RunPython(backfill_order_bill, noop_reverse),
    ]
