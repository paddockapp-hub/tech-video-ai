"""
Random Topic Generator
다양한 주제를 랜덤하게 생성
"""
import random

TOPICS = {
    "science": [
        "블랙홀의 성질과 용도",
        "중력의 작동 원리",
        "전자의 발견과 역사",
        "DNA 구조와 유전",
        "화학 반응의 종류",
        "원자핵의 원리",
        "에너지 보존 법칙",
        "플라스마의 상태",
        "양자역학 기초",
        "상대성 이론"
    ],
    "history": [
        "로마 제국의 멸망",
        "한국 삼국시대",
        "산업혁명의 영향",
        "제1차 세계대전",
        "한국 전쟁의 의미",
        "고대 그리스 문명",
        "중국 황제 시대",
        "미국 독립혁명",
        "프랑스 혁명",
        "문명 교류의 역사"
    ],
    "technology": [
        "인터넷의 탄생",
        "스마트폰의 진화",
        "AI의 발전 과정",
        "전기 자동차의 미래",
        "반도체의 중요성",
        "우주 개발 역사",
        "로봇 공학 기초",
        "블록체인 기술",
        "5G 통신의 특징",
        "양자 컴퓨팅"
    ],
    "nature": [
        "기후 변화의 원인",
        "생물 다양성의 중요성",
        "해양 생태계",
        "숲의 역할",
        "동물의 행동 양식",
        "식물의 광합성",
        "지질 형성 과정",
        "화산의 분화",
        "지각의 구조",
        "대기 순환"
    ],
    "economics": [
        "수요와 공급의 법칙",
        "인플레이션의 원인",
        "GDP의 의미",
        "주식 시장 기초",
        "환율의 결정 요인",
        "무역의 중요성",
        "부의 정의",
        "세금의 역할",
        "소득 불평등",
        "경제 성장 모델"
    ]
}

def generate_random_topic():
    """랜덤 주제 생성"""
    category = random.choice(list(TOPICS.keys()))
    topic = random.choice(TOPICS[category])
    return {
        "category": category,
        "topic": topic,
        "description": f"{topic}에 대해 알아봅시다"
    }

def generate_script(topic, duration_sec=30):
    """주제에 맞는 스크립트 생성"""
    templates = [
        f"{topic}은 무엇일까요? 먼저 기본 개념부터 이해해봅시다. {topic}의 핵심 원리는 다음과 같습니다. 첫째, 기본 정의를 알아야 합니다. 둘째, 작동 원리를 이해해야 합니다. 마지막으로 실제 응용 사례를 살펴봅시다.",
        f"{topic}에 대해 설명해 드리겠습니다. 먼저 {topic}이 무엇인지 알아봅시다. 그다음 왜 중요한지 이해해야 합니다. 마지막으로 어떻게 활용할 수 있는지 알아보겠습니다.",
        f"오늘은 {topic}에 대해 배워보겠습니다. 이 주제는 우리 일상과 밀접한 관련이 있습니다. {topic}의 핵심 내용을 3단계로 나누어 설명하겠습니다."
    ]
    
    return random.choice(templates)

if __name__ == "__main__":
    for _ in range(5):
        topic = generate_random_topic()
        print(f"카테고리: {topic['category']}")
        print(f"주제: {topic['topic']}")
        print(f"설명: {topic['description']}")
        print("-" * 50)
