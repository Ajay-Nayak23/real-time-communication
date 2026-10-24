from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthCheckAPITests(APITestCase):
    def test_health_check_returns_ok(self):
        url = reverse('api:health_check')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertTrue(response['Content-Type'].startswith('application/json'))

    def test_health_check_direct_url(self):
        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_cors_headers_allowed_origin(self):
        response = self.client.get('/api/health/', HTTP_ORIGIN='http://localhost:4200')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200')
        self.assertEqual(response.headers.get('Access-Control-Allow-Credentials'), 'true')

    def test_cors_preflight_options_request(self):
        response = self.client.options(
            '/api/health/',
            HTTP_ORIGIN='http://localhost:4200',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200')
        self.assertIn('GET', response.headers.get('Access-Control-Allow-Methods', ''))
