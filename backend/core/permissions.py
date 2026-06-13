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
