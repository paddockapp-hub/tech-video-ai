"""Content-aware scene prompts used when a text-generation provider is unavailable."""

import re
from typing import Dict, List


def build_fallback_prompts(script_text: str, num_keyframes: int) -> List[Dict]:
    text = re.sub(r'\s+', ' ', script_text).strip()
    if not text or num_keyframes <= 0:
        return []

    sentences = [
        sentence.strip()
        for sentence in re.split(r'(?<=[.!?。！？])\s*', text)
        if sentence.strip()
    ]
    units = sentences if len(sentences) >= num_keyframes else text.split()
    separator = ' '
    if len(units) < num_keyframes:
        units = list(text)
        separator = ''
    segments = [
        separator.join(units[index * len(units) // num_keyframes:
                               (index + 1) * len(units) // num_keyframes])
        for index in range(num_keyframes)
    ]

    return [
        {
            'scene_number': index + 1,
            'description': segment,
            'base_prompt': (
                f'Visual subject: {text}\n'
                f'Scene focus: {segment}\n'
                'Show the real engineering object and its force, energy, or material flow. '
                'Use a clean cinematic technical illustration with no invented measurements.'
            ),
            'infographic_prompt': (
                f'Visual subject: {text}\n'
                f'Scene focus: {segment}\n'
                'Create a clear engineering cutaway or schematic with labeled components and '
                'directional arrows. Do not invent numerical values.'
            ),
            'visual_elements': [segment],
            'engineering_concept': segment,
            'source': 'fallback',
        }
        for index, segment in enumerate(segments)
    ]
