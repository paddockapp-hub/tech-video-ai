import requests
import json

# GPT 테스트
response = requests.post('http://localhost:11434/api/generate', json={
    'model': 'llama3.2',
    'prompt': '안녕하세요, 한국어로 인사해주세요',
    'stream': False
})

print("GPT 응답:")
print(response.json()['response'])