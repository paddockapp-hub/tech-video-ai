import ast
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from src.integrated_main import IntegratedSystem

ROOT = Path(__file__).resolve().parents[1]


class VercelDeploymentTests(unittest.TestCase):
    def test_vercel_uses_supported_flask_entrypoint_without_legacy_builds(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))

        self.assertFalse(any(key in config for key in ("builds", "routes")))
        self.assertTrue((ROOT / "app.py").is_file())
        self.assertEqual(config["$schema"], "https://openapi.vercel.sh/vercel.json")

    def test_vercel_function_limits_and_deployment_assets_target_entrypoint(self):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        function = config["functions"]["app.py"]

        self.assertEqual(function["maxDuration"], 300)
        self.assertEqual(function["includeFiles"], "{src,public}/**")
        self.assertNotIn("env", config)
        self.assertEqual(
            (ROOT / ".python-version").read_text(encoding="utf-8").strip(),
            "3.12",
        )

    def test_vercel_runtime_defaults_to_fail_closed_blob_storage(self):
        system = IntegratedSystem.__new__(IntegratedSystem)
        with patch.dict(os.environ, {"VERCEL": "1"}, clear=True):
            config = system._load_config()

        self.assertEqual(config["storage_type"], "vercel")
        self.assertTrue(config["require_persistent_storage"])
        self.assertEqual(config["output_dir"], "/tmp/engineering-shorts/output")
        self.assertEqual(config["temp_dir"], "/tmp/engineering-shorts/temp")
        self.assertEqual(config["local_storage_dir"], "/tmp/engineering-shorts/uploads")

    def test_python_entrypoint_exports_initialized_flask_app(self):
        source = (ROOT / "app.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        assignments = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "app"
                for target in node.targets
            )
        ]

        self.assertTrue(
            any(
                isinstance(node.value, ast.Attribute)
                and isinstance(node.value.value, ast.Attribute)
                and node.value.value.attr == "web_server"
                and node.value.attr == "app"
                for node in assignments
            )
        )
        self.assertIn("IntegratedSystem()", source)


if __name__ == "__main__":
    unittest.main()
