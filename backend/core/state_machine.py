"""Centralized Order.status transition rules.

Kept independent of any DRF view/request so it can be unit-tested directly
and so every code path that changes an order's status (caterer decisions,
caretaker resolution, manager overrides) goes through the same rules.
"""

# Mirrors the ORDER_STATUS_CHOICES transitions that were previously enforced
# ad hoc, inline, per role branch in OrderDetailView.partial_update:
#   - pending -> accepted / rejected / partially_accepted (caterer decision)
#   - accepted / partially_accepted -> prepared -> delivered (caterer prep)
#   - rejected / pending / partially_accepted -> resolved (caretaker, handled externally)
#   - rejected / partially_accepted -> pending (caretaker modifies items and resubmits)
# 'delivered' and 'resolved' are terminal: no further transitions out.
ALLOWED_TRANSITIONS = {
    'pending': {'accepted', 'rejected', 'partially_accepted', 'resolved'},
    'accepted': {'prepared', 'delivered'},
    'partially_accepted': {'prepared', 'delivered', 'pending', 'resolved'},
    'prepared': {'delivered'},
    'rejected': {'pending', 'resolved'},
    'delivered': set(),
    'resolved': set(),
}


class InvalidTransition(Exception):
    def __init__(self, current_status, new_status):
        self.current_status = current_status
        self.new_status = new_status
        super().__init__(
            f"Cannot change status from '{current_status}' to '{new_status}'."
        )


def validate_transition(current_status, new_status):
    """Raise InvalidTransition if the change isn't allowed. No-op if the
    status isn't actually changing (idempotent PATCH)."""
    if current_status == new_status:
        return
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise InvalidTransition(current_status, new_status)
