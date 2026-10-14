import unittest
from production_preflight import read_env, validate_settings
from pathlib import Path
from tempfile import TemporaryDirectory


class ProductionPreflightTests(unittest.TestCase):
    def setUp(self):
        self.good = {
            "SHL_DOMAIN": "ops.shl-company.org",
            "POSTGRES_DB": "shl_operations",
            "POSTGRES_USER": "shl_app",
            "POSTGRES_PASSWORD": "db_" + "aZ7f93_pT4" * 3,
            "BOOTSTRAP_ADMIN_USERNAME": "operations_owner",
            "BOOTSTRAP_ADMIN_PASSWORD": "admin_" + "Yk94rT3#" * 3,
            "MFA_ENCRYPTION_KEY": "7e0f94a2d31c8b6e5f0a9132c4d7b8e69a1f0c2d3b4e5a6f7c8d9e0b1a2c3d45",
        }

    def test_valid_candidate_configuration(self):
        self.assertEqual(validate_settings(self.good), [])

    def test_placeholder_and_missing_secret_fails(self):
        bad = {**self.good, "POSTGRES_PASSWORD": "replace-me", "MFA_ENCRYPTION_KEY": ""}
        failures = validate_settings(bad)
        self.assertTrue(any("POSTGRES_PASSWORD" in issue for issue in failures))
        self.assertTrue(any("MFA_ENCRYPTION_KEY" in issue for issue in failures))

    def test_example_domain_and_reused_credentials_fail(self):
        bad = {**self.good, "SHL_DOMAIN": "operations.example.com",
               "POSTGRES_PASSWORD": self.good["BOOTSTRAP_ADMIN_PASSWORD"]}
        self.assertGreaterEqual(len(validate_settings(bad)), 2)

    def test_duplicate_env_key_rejected(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / ".env"
            path.write_text("A=hello\nA=again\n")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                read_env(path)


if __name__ == "__main__":
    unittest.main()
