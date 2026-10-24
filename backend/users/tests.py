from django.contrib.auth import get_user_model
from django.db.utils import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class UserManagerTests(TestCase):
    def setUp(self):
        self.user_model = User

    def test_create_user_with_email_and_password(self):
        user = self.user_model.objects.create_user(
            email='test@example.com',
            password='securePassword123!',
            name='Test User'
        )
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.name, 'Test User')
        self.assertTrue(user.check_password('securePassword123!'))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(str(user), 'test@example.com')

    def test_create_user_normalizes_email(self):
        user = self.user_model.objects.create_user(
            email='user@EXAMPLE.COM',
            password='securePassword123!'
        )
        self.assertEqual(user.email, 'user@example.com')

    def test_create_user_without_email_raises_error(self):
        with self.assertRaises(ValueError):
            self.user_model.objects.create_user(email='', password='password123')

    def test_create_user_duplicate_email_raises_error(self):
        self.user_model.objects.create_user(email='dup@example.com', password='password123')
        with self.assertRaises(IntegrityError):
            self.user_model.objects.create_user(email='dup@example.com', password='anotherpassword')

    def test_create_superuser_success(self):
        admin_user = self.user_model.objects.create_superuser(
            email='admin@example.com',
            password='adminPassword123!',
            name='Super Admin'
        )
        self.assertEqual(admin_user.email, 'admin@example.com')
        self.assertTrue(admin_user.is_active)
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)

    def test_create_superuser_invalid_staff_flag(self):
        with self.assertRaises(ValueError):
            self.user_model.objects.create_superuser(
                email='admin@example.com',
                password='adminPassword123!',
                is_staff=False
            )

    def test_create_superuser_invalid_superuser_flag(self):
        with self.assertRaises(ValueError):
            self.user_model.objects.create_superuser(
                email='admin@example.com',
                password='adminPassword123!',
                is_superuser=False
            )


class UserRegistrationAPITests(APITestCase):
    def setUp(self):
        self.register_url = reverse('api:auth:register')

    def test_registration_success(self):
        payload = {
            'email': 'newuser@example.com',
            'name': 'New User',
            'password': 'StrongPassword123!'
        }
        response = self.client.post(self.register_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['email'], 'newuser@example.com')
        self.assertEqual(response.data['name'], 'New User')
        self.assertIn('id', response.data)
        self.assertNotIn('password', response.data)

        # Verify user in database
        user = User.objects.get(email='newuser@example.com')
        self.assertEqual(user.name, 'New User')
        self.assertTrue(user.check_password('StrongPassword123!'))
        self.assertNotEqual(user.password, 'StrongPassword123!')

    def test_registration_duplicate_email_fails(self):
        User.objects.create_user(
            email='existing@example.com',
            name='Existing User',
            password='Password123!'
        )

        payload = {
            'email': 'existing@example.com',
            'name': 'Duplicate User',
            'password': 'StrongPassword123!'
        }
        response = self.client.post(self.register_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertIn('already exists', str(response.data['email']))

    def test_registration_weak_password_fails(self):
        payload = {
            'email': 'weakpass@example.com',
            'name': 'Weak Pass User',
            'password': '123'
        }
        response = self.client.post(self.register_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_missing_required_fields(self):
        response = self.client.post(self.register_url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
        self.assertIn('name', response.data)
        self.assertIn('password', response.data)

    def test_registration_blank_name_fails(self):
        payload = {
            'email': 'blankname@example.com',
            'name': '   ',
            'password': 'StrongPassword123!'
        }
        response = self.client.post(self.register_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)


class JWTAuthenticationAPITests(APITestCase):
    def setUp(self):
        self.user_password = 'TestPassword123!'
        self.user = User.objects.create_user(
            email='jwtuser@example.com',
            name='JWT User',
            password=self.user_password
        )
        self.login_url = reverse('api:auth:login')
        self.refresh_url = reverse('api:auth:token_refresh')
        self.logout_url = reverse('api:auth:logout')
        self.protected_url = reverse('api:auth:test_protected')

    def test_login_success(self):
        payload = {
            'email': 'jwtuser@example.com',
            'password': self.user_password
        }
        response = self.client.post(self.login_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'jwtuser@example.com')

    def test_login_invalid_password_fails(self):
        payload = {
            'email': 'jwtuser@example.com',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.login_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_email_fails(self):
        payload = {
            'email': 'unknown@example.com',
            'password': self.user_password
        }
        response = self.client.post(self.login_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_success(self):
        login_res = self.client.post(self.login_url, {
            'email': 'jwtuser@example.com',
            'password': self.user_password
        }, format='json')
        refresh_token = login_res.data['refresh']

        refresh_res = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.data)

    def test_token_refresh_invalid_token_fails(self):
        response = self.client.post(self.refresh_url, {'refresh': 'invalid.token.value'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_with_valid_jwt(self):
        login_res = self.client.post(self.login_url, {
            'email': 'jwtuser@example.com',
            'password': self.user_password
        }, format='json')
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.protected_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'jwtuser@example.com')

    def test_access_protected_endpoint_without_token_fails(self):
        response = self.client.get(self.protected_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_protected_endpoint_with_invalid_token_fails(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_jwt_token')
        response = self.client.get(self.protected_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_token(self):
        login_res = self.client.post(self.login_url, {
            'email': 'jwtuser@example.com',
            'password': self.user_password
        }, format='json')
        access_token = login_res.data['access']
        refresh_token = login_res.data['refresh']

        # Logout with auth header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_res = self.client.post(self.logout_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        # Attempting to refresh with the blacklisted token must fail with 401
        self.client.credentials()  # clear auth
        refresh_attempt = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED)


class UserProfileAPITests(APITestCase):
    def setUp(self):
        self.profile_url = reverse('api:users:user_me')
        self.user = User.objects.create_user(
            email='profileuser@example.com',
            name='Original Name',
            password='Password123!'
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            name='Other User',
            password='Password123!'
        )
        # Login to obtain JWT
        login_res = self.client.post(reverse('api:auth:login'), {
            'email': 'profileuser@example.com',
            'password': 'Password123!'
        }, format='json')
        self.access_token = login_res.data['access']

    def test_unauthenticated_profile_request_returns_401(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_patch_returns_401(self):
        response = self.client.patch(self.profile_url, {'name': 'New Name'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_current_user_profile_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['email'], 'profileuser@example.com')
        self.assertEqual(response.data['name'], 'Original Name')
        self.assertIn('profile_image', response.data)
        self.assertIn('last_seen', response.data)
        self.assertIn('bio', response.data)

    def test_patch_profile_name_and_bio_persists(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        payload = {
            'name': 'Updated Name',
            'bio': 'Real-time communication developer',
            'avatar': 'https://example.com/avatar.png'
        }
        response = self.client.patch(self.profile_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Name')
        self.assertEqual(response.data['bio'], 'Real-time communication developer')
        self.assertEqual(response.data['profile_image'], 'https://example.com/avatar.png')

        # Verify database persistence
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, 'Updated Name')
        self.assertEqual(self.user.bio, 'Real-time communication developer')
        self.assertEqual(self.user.profile_image, 'https://example.com/avatar.png')

    def test_patch_blank_name_fails_validation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.patch(self.profile_url, {'name': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_cannot_modify_sensitive_fields(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        payload = {
            'email': 'hacked@example.com',
            'id': 9999,
            'is_staff': True,
            'is_active': False
        }
        response = self.client.patch(self.profile_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'profileuser@example.com')
        self.assertNotEqual(self.user.id, 9999)
        self.assertFalse(self.user.is_staff)
        self.assertTrue(self.user.is_active)

    def test_authorization_boundary_user_cannot_modify_other_user(self):
        # User is authenticated as self.user
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        self.client.patch(self.profile_url, {'name': 'Attacker'}, format='json')

        # Verify other user was NOT touched
        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.name, 'Other User')


class UserDirectoryAPITests(APITestCase):
    def setUp(self):
        self.directory_url = reverse('api:users:user_directory')
        self.current_user = User.objects.create_user(
            email='alice@example.com',
            name='Alice Smith',
            password='Password123!'
        )
        self.user_bob = User.objects.create_user(
            email='bob@example.com',
            name='Bob Jones',
            password='Password123!'
        )
        self.user_charlie = User.objects.create_user(
            email='charlie@dev.io',
            name='Charlie Brown',
            password='Password123!'
        )
        self.inactive_user = User.objects.create_user(
            email='inactive@example.com',
            name='Inactive User',
            password='Password123!',
            is_active=False
        )
        # Login to obtain JWT
        login_res = self.client.post(reverse('api:auth:login'), {
            'email': 'alice@example.com',
            'password': 'Password123!'
        }, format='json')
        self.access_token = login_res.data['access']

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get(self.directory_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_directory_returns_other_active_users(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 2)  # Bob and Charlie

        emails = [u['email'] for u in response.data['results']]
        self.assertIn('bob@example.com', emails)
        self.assertIn('charlie@dev.io', emails)

    def test_requesting_user_is_excluded(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url)

        emails = [u['email'] for u in response.data['results']]
        self.assertNotIn('alice@example.com', emails)

    def test_inactive_users_are_excluded(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url)

        emails = [u['email'] for u in response.data['results']]
        self.assertNotIn('inactive@example.com', emails)

    def test_search_by_name(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url, {'search': 'jones'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Bob Jones')

    def test_search_by_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url, {'search': 'dev.io'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['email'], 'charlie@dev.io')

    def test_search_no_matches_returns_empty_results(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url, {'search': 'nonexistent'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(len(response.data['results']), 0)

    def test_directory_exposes_only_safe_fields(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url)

        first_user = response.data['results'][0]
        # Required safe public fields
        self.assertIn('id', first_user)
        self.assertIn('name', first_user)
        self.assertIn('profile_image', first_user)
        self.assertIn('last_seen', first_user)

        # Sensitive attributes MUST NOT be exposed
        self.assertNotIn('password', first_user)
        self.assertNotIn('is_staff', first_user)
        self.assertNotIn('is_superuser', first_user)

    def test_directory_pagination(self):
        for i in range(25):
            User.objects.create_user(
                email=f'user{i}@example.com',
                name=f'User {i:02d}',
                password='Password123!'
            )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.directory_url, {'page_size': 10, 'page': 1})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertIsNotNone(response.data['next'])

        response_page_2 = self.client.get(self.directory_url, {'page_size': 10, 'page': 2})
        self.assertEqual(response_page_2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_page_2.data['results']), 10)


