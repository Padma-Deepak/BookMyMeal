from django.db import migrations


def backfill_price_snapshot(apps, schema_editor):
    """Best-effort backfill for OrderItem rows created before price snapshotting
    existed: copy the CURRENT MenuItem price/complimentary status in, since the
    price actually charged at the time wasn't recorded and can't be recovered.
    Going forward, new OrderItem rows are always snapshotted at creation time."""
    OrderItem = apps.get_model('core', 'OrderItem')
    for item in OrderItem.objects.select_related('menu_item').all():
        item.unit_price = item.menu_item.customer_price
        item.caterer_unit_price = item.menu_item.caterer_price
        item.is_complimentary = item.menu_item.is_complimentary
        item.save(update_fields=['unit_price', 'caterer_unit_price', 'is_complimentary'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_orderitem_price_snapshot'),
    ]

    operations = [
        migrations.RunPython(backfill_price_snapshot, noop_reverse),
    ]
