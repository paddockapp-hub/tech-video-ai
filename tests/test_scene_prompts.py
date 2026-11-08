import unittest

from src.scene_prompts import build_fallback_prompts


class ScenePromptFallbackTests(unittest.TestCase):
    def test_fallback_prompts_preserve_topic_and_nonempty_scene_focus(self):
        prompts = build_fallback_prompts(
            'Bridge beams carry the load into the foundations.',
            3,
        )

        self.assertEqual(len(prompts), 3)
        self.assertTrue(all(prompt['description'] for prompt in prompts))
        self.assertTrue(all(
            'bridge beams carry the load' in prompt['base_prompt'].lower()
            for prompt in prompts
        ))
        self.assertTrue(all(
            'do not invent numerical values' in prompt['infographic_prompt'].lower()
            for prompt in prompts
        ))

    def test_empty_script_does_not_create_success_shaped_prompts(self):
        self.assertEqual(build_fallback_prompts('', 4), [])


if __name__ == '__main__':
    unittest.main()
