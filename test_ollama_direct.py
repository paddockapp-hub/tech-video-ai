import requests
import json

# Ollama 연결 테스트
try:
    response = requests.get('http://localhost:11434/api/tags', timeout=5)
    print(f"Ollama 서버 상태: {response.status_code}")
    print(f"사용 가능한 모델: {response.json()}")
except Exception as e:
    print(f"Ollama 연결 실패: {e}")

# Ollama 텍스트 생성 테스트
try:
    response = requests.post('http://localhost:11434/api/generate', json={
        'model': 'llama3.2',
        'prompt': '안녕하세요, 한국어로 인사해주세요',
        'stream': False
    }, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print(f"Ollama 응답: {result.get('response', '응답 없음')}")
    else:
        print(f"Ollama API 오류: {response.status_code}")
        
except Exception as e:
    print(f"Ollama 텍스트 생성 실패: {e}")