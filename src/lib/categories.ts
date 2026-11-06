export interface CategorySubItem {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  recommendedHooks: string[];
  visualStyleGuide: string;
  sampleTopics: string[];
}

export interface CategoryGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  items: CategorySubItem[];
}

export const CATEGORIES: CategoryGroup[] = [
  {
    id: "education",
    name: "교육 (고등·대학 심화)",
    icon: "GraduationCap",
    description: "수능·내신·대학 전공 수준의 정확하고 깊이 있는 개념 전달 숏츠",
    items: [
      {
        id: "sat-college",
        name: "수능 및 입시 / 교육과정",
        description: "수능 킬러문항 출제 원리, 핵심 출제 경향, 오답률 1위 분석",
        targetAudience: "고등학생, 수험생, N수생, 학부모",
        recommendedHooks: [
          "올해 수능 킬러 문항에서 92%가 낚인 결정적 이유",
          "평가원이 매년 반복 출제하는 이 공식, 아직도 외우기만 하나요?",
          "30초 만에 정리하는 내신 1등급 판별 개념",
        ],
        visualStyleGuide: "모던 칠판 스타일, 깔끔한 수식 타이포그래피, 핵심 키워드 형광펜 하이라이트",
        sampleTopics: ["수능 국어 비문학 논리 전개", "수능 수학 미적분 그래프 해석", "영어 빈칸추론 오답 소거법"],
      },
      {
        id: "math",
        name: "수학 (고등~대학)",
        description: "미적분, 기하, 확률과 통계, 선형대수학 등 시각적 직관",
        targetAudience: "이공계 지망생, 대학생, 수학 애호가",
        recommendedHooks: [
          "공식을 외우지 않고 그래프 하나로 미적분을 끝내는 법",
          "차원이 왜 중요한지 4차원 도형을 보면 소름 돋는 이유",
          "복소수가 허수(가짜 수)가 아니라 현실 전기를 움직이는 원리",
        ],
        visualStyleGuide: "3D 벡터 공간, Manim 스타일의 부드러운 그래프 변형 애니메이션, 다크 네이비 배경",
        sampleTopics: ["오일러 공식 e^(iπ)+1=0", "미적분학의 기본정리 시각화", "고유값과 고유벡터의 기하학적 의미"],
      },
      {
        id: "physics",
        name: "물리학 (고등~전공)",
        description: "역학, 전자기학, 열역학, 양자역학, 상대성이론",
        targetAudience: "자연계열 학생, 물리학 전공자",
        recommendedHooks: [
          "시간이 느리게 흐른다는 건 착각이 아니라 GPS에 매일 적용되는 물리입니다",
          "빛보다 빠른 건 없다면서 우주 팽창은 왜 빛보다 빠를까?",
          "고전역학에선 불가능한 벽 통과, 양자 터널링은 어떻게 가능할까?",
        ],
        visualStyleGuide: "입자 시뮬레이션, 중력장 왜곡 그리드, 슬로우모션 물리 궤적",
        sampleTopics: ["특수상대성이론 시간지연", "양자 터널링과 플래시 메모리", "베르누이 방정식과 비행기"],
      },
      {
        id: "chemistry",
        name: "화학 / 생명과학 / 지구과학",
        description: "화학결합, 분자구조, DNA 복제, 세포호흡, 판구조론",
        targetAudience: "의치약한 지망생, 생명공학/화학 전공자",
        recommendedHooks: [
          "물 분자가 얼면 왜 부피가 늘어날까? 꺾인 각도 104.5도의 비밀",
          "우리 몸의 세포는 1초에 1,000번씩 DNA를 복제하고 고칩니다",
          "지구 자기장이 멈추면 인류는 며칠 안에 멸망할까?",
        ],
        visualStyleGuide: "분자 3D 렌더링, 세포 내부 마이크로 시네마틱, 지층 단면도",
        sampleTopics: ["CRISPR 유전자 가위", "ATP 합성효소 모터 구조", "배터리 리튬이온의 이동"],
      },
      {
        id: "economics-society",
        name: "경제 / 역사 / 사회 심화",
        description: "거시경제 원리, 금리와 환율, 근현대사 지정학적 역학",
        targetAudience: "사회과학 지망생, 2030 교양 탐구층",
        recommendedHooks: [
          "미국이 금리를 올리면 내 대출 이자가 왜 바로 뛸까?",
          "1차 대전의 도화선은 왜 사라예보의 골목길에서 당겨졌을까?",
          "인플레이션이 발생하면 돈을 번 사람은 대체 누구일까?",
        ],
        visualStyleGuide: "신문 아카이브 텍스처, 시계열 데이터 차트, 역사 지도 모션",
        sampleTopics: ["양적완화와 통화 공급 메커니즘", "기준금리와 채권 가격의 반비례", "브레튼우즈 체제의 붕괴"],
      },
      {
        id: "college-deep",
        name: "대학 수준 전공 지식 & 전문 심화",
        description: "학부 2~4학년 수준의 전공 핵심 이론과 논문급 인사이트",
        targetAudience: "대학생, 연구원, 고학력 전문가",
        recommendedHooks: [
          "교수님도 시험에 무조건 내는 전공 필수 개념 3분 요약",
          "이 원리를 모르면 전공 기말고사 족보를 봐도 못 풉니다",
          "논문에서 매번 나오는 이 수식, 직관적으로 설명해드립니다",
        ],
        visualStyleGuide: "학술 논문 그래프, 정밀 공학 도면, 매트랩/사이파이 플롯 스타일",
        sampleTopics: ["푸리에 변환의 주파수 분해", "나비에-스토크스 방정식", "베이즈 정리와 사후확률 갱신"],
      },
    ],
  },
  {
    id: "engineering",
    name: "공학 (작동 원리 & 메커니즘)",
    icon: "Cpu",
    description: "내부 구조와 물리적 메커니즘의 시각적 분해 중심 숏츠",
    items: [
      {
        id: "mechanical-automotive",
        name: "기계공학 / 자동차공학",
        description: "4행정 엔진, 터보차저, 자동변속기(토크컨버터), 차동기어(디퍼렌셜)",
        targetAudience: "기계공학도, 자동차 마니아, 엔지니어",
        recommendedHooks: [
          "차가 코너를 돌 때 안쪽 바퀴와 바깥 바퀴 속도가 다른 이유",
          "엔진 실린더 안에서 1분에 3,000번 폭발하는 4행정의 기적",
          "터보차저가 배기가스로 출력을 50% 끌어올리는 물리적 구조",
        ],
        visualStyleGuide: "금속 질감 투시도(Cutaway), 내부 기어 맞물림 3D 렌더링, 마찰열 히트맵",
        sampleTopics: ["디퍼렌셜 기어 작동 원리", "듀얼 클러치 변속기(DCT)", "전기차 감속기와 인버터"],
      },
      {
        id: "aerospace",
        name: "항공우주공학",
        description: "제트 엔진(터보팬), 로켓 노즐(드 라발 노즐), 양력 발생 날개 형상",
        targetAudience: "항공우주 지망생, 밀리터리/우주 마니아",
        recommendedHooks: [
          "보잉 747은 400톤인데 어떻게 공중에 떠 있을 수 있을까?",
          "로켓 노즐 모양이 모래시계처럼 좁아졌다 넓어지는 이유",
          "음속을 돌파할 때 전투기 주변에 생기는 원뿔형 구름의 정체",
        ],
        visualStyleGuide: "풍동 실험 유선(Streamline), 충격파 슐리렌 촬영 스타일, 우주 궤도 렌더링",
        sampleTopics: ["터보팬 엔진 압축기와 터빈", "초음속 충격파와 소닉붐", "로켓 자세제어 RCS 스러스터"],
      },
      {
        id: "electrical-electronics",
        name: "전기전자공학 / 반도체",
        description: "MOSFET 트랜지스터, 인버터, 변압기, 교류/직류 변환, EUV 노광",
        targetAudience: "전자공학도, 반도체 취준생, 하드웨어 개발자",
        recommendedHooks: [
          "손톱만 한 칩에 100억 개의 트랜지스터를 새기는 방법",
          "전기는 전자가 아니라 전자기파 에너지가 흐르는 것입니다",
          "스마트폰 무선 충전 패드는 어떻게 선 없이 전력을 보낼까?",
        ],
        visualStyleGuide: "네온 회로 패턴, 반도체 실리콘 나노 단면, 전자기장 플럭스 라인",
        sampleTopics: ["트랜지스터 게이트의 전압 제어 원리", "변압기의 패러데이 전자기유도", "교류(AC)와 직류(DC)의 송전 효율"],
      },
      {
        id: "robotics-control",
        name: "로봇공학 / 제어공학",
        description: "PID 제어, 역기구학, 하모닉 드라이브 감속기, IMU 센서 퓨전",
        targetAudience: "로봇 개발자, 메카트로닉스 전공자",
        recommendedHooks: [
          "로봇 팔이 오차 0.01mm로 정확하게 멈추는 비결, PID 제어",
          "넘어지지 않고 두 발로 달리는 휴머노이드의 자이로 센서 비밀",
          "백래시(유격)가 제로인 하모닉 드라이브 감속기의 탄성 변형",
        ],
        visualStyleGuide: "로봇 관절 와이어프레임, 모션 벡터 화살표, 센서 반응 그래프 오버레이",
        sampleTopics: ["PID 피드백 제어 루프", "다관절 로봇 역기구학 풀이", "브러시리스 모터(BLDC) 전자 제어"],
      },
      {
        id: "cs-ai",
        name: "컴퓨터공학 / 인공지능",
        description: "트랜스포머 Attention 메커니즘, GPU 병렬 연산, 가상 메모리 페이징",
        targetAudience: "소프트웨어 엔지니어, AI 연구원, 개발자 지망생",
        recommendedHooks: [
          "챗GPT가 다음 단어를 예측하는 '어텐션' 메커니즘 1분 설명",
          "CPU는 박사 1명, GPU는 초등학생 10,000명이라는 비유의 실체",
          "컴퓨터 메모리가 부족할 때 SSD를 램처럼 쓰는 페이징 기법",
        ],
        visualStyleGuide: "매트릭스 텐서 곱셈 시각화, 신경망 노드 발화 애니메이션, 바이너리 펄스",
        sampleTopics: ["Transformer Self-Attention 시각화", "해시 테이블의 충돌 해결 알고리즘", "인터넷 패킷 전송 TCP 3-Way Handshake"],
      },
      {
        id: "chemical-materials",
        name: "화학공학 / 신소재 / 에너지",
        description: "석유 정제 분별증류탑, 전고체 배터리, 탄소나노튜브, 수소연료전지",
        targetAudience: "화공/재료공학도, 배터리 산업 종사자",
        recommendedHooks: [
          "석유 한 방울이 아스팔트부터 플라스틱까지 분리되는 원리",
          "폭발 위험 없는 전고체 배터리가 전기차를 바꿀 결정적 이유",
          "강철보다 100배 단단한 탄소나노튜브의 육각 벌집 구조",
        ],
        visualStyleGuide: "파이프라인 흐름 시뮬레이션, 결정 격자(Crystal Lattice), 반응기 내부 열화상",
        sampleTopics: ["분별증류탑 온도 구배와 비점 분리", "리튬이온 vs 전고체 전해질", "태양광 패널 광전효과 PN접합"],
      },
    ],
  },
];

export function getCategoryById(categoryId: string): CategoryGroup | undefined {
  return CATEGORIES.find((c) => c.id === categoryId);
}

export function getSubcategoryById(
  categoryId: string,
  subcategoryId: string
): CategorySubItem | undefined {
  const cat = getCategoryById(categoryId);
  return cat?.items.find((i) => i.id === subcategoryId);
}

