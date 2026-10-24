from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for the Real-Time Communication Platform.
    Uses email as the unique primary identifier.
    """

    id = models.BigAutoField(primary_key=True)
    email = models.EmailField(unique=True, db_index=True)
    name = models.CharField(max_length=150, blank=True)
    bio = models.TextField(blank=True, default='')
    profile_image = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.email
