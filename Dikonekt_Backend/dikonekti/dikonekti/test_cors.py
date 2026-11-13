from django.test import TestCase, override_settings


class CorsTests(TestCase):
    """Browsers get cross-origin access only from origins listed in CORS_ALLOWED_ORIGINS."""

    def get(self, origin):
        return self.client.get("/api/doctors/", HTTP_ORIGIN=origin)

    @override_settings(CORS_ALLOWED_ORIGINS=[], CORS_ALLOW_ALL_ORIGINS=False)
    def test_with_no_origins_listed_no_origin_is_allowed(self):
        self.assertNotIn("Access-Control-Allow-Origin", self.get("https://evil.example.test"))

    @override_settings(CORS_ALLOWED_ORIGINS=[], CORS_ALLOW_ALL_ORIGINS=False)
    def test_preflight_from_any_origin_gets_no_allow_origin_header(self):
        response = self.client.options(
            "/api/auth/login/",
            HTTP_ORIGIN="https://evil.example.test",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )
        self.assertNotIn("Access-Control-Allow-Origin", response)

    @override_settings(CORS_ALLOWED_ORIGINS=["https://app.example.test"], CORS_ALLOW_ALL_ORIGINS=False)
    def test_only_the_listed_origin_is_allowed(self):
        self.assertEqual(self.get("https://app.example.test")["Access-Control-Allow-Origin"], "https://app.example.test")
        self.assertNotIn("Access-Control-Allow-Origin", self.get("https://evil.example.test"))

    @override_settings(CORS_ALLOWED_ORIGINS=["https://app.example.test"], CORS_ALLOW_ALL_ORIGINS=False)
    def test_a_lookalike_origin_is_not_allowed(self):
        self.assertNotIn("Access-Control-Allow-Origin", self.get("https://app.example.test.evil.test"))
