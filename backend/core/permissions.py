from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsGuest(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'guest'


class IsCaterer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'caterer'


class IsCaretaker(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'caretaker'


class IsCatererOrSuperuser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('caterer', 'superuser')


class IsCaretakerOrSuperuser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('caretaker', 'superuser')


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('manager', 'superuser')


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'superuser'


class IsOwnerOrManagerOrAbove(BasePermission):
    """Allows access to the resource owner or manager/superuser."""
    def has_object_permission(self, request, view, obj):
        if request.user.role in ('manager', 'superuser'):
            return True
        return getattr(obj, 'guest', None) == request.user or getattr(obj, 'user', None) == request.user


class ReadOnlyOrRoleWrite(BasePermission):
    """Any authenticated user may use safe (read) methods; unsafe (write)
    methods require one of `allowed_write_roles`. Override on a subclass."""
    allowed_write_roles = ()

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in self.allowed_write_roles


class IsCatererOwnerOrSuperuser(ReadOnlyOrRoleWrite):
    """Menu items: anyone authenticated can read; only the owning caterer or
    a superuser can create/update/delete. Object-level check enforces
    ownership specifically (a caterer can't edit another caterer's item)."""
    allowed_write_roles = ('caterer', 'superuser')

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role == 'superuser':
            return True
        return obj.caterer_id == request.user.id
