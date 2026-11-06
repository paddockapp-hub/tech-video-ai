#!/usr/bin/env python3
"""
교육 3편 + 공학 3편 실제 MP4 생성 및 품질 실측 평가 스크립트
"""
import asyncio, json, os, sys, time
from pathlib import Path

# shortsmaking/scripts/pipeline.py 모듈 임포트
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from pipeline import run_pipeline, verify_video_quality

TEST_CASES = [
    # [교육 3종]
    {
        "type": "education",
        "category": "education",
        "id": "edu_1_math",
        "title": "수능 수학 미적분 그래프 해석",
        "script": "공식을 외우지 않고 그래프 하나로 미적분을 끝내는 법입니다.\n대부분의 학생들이 공식만 암기하지만 핵심은 변화율입니다.\n기울기가 0이 되는 극값을 찾으면 숨겨진 대칭성이 드러납니다.\n수능 킬러 문항도 이 직관 하나로 단 3줄 만에 풀립니다.",
    },
    {
        "type": "education",
        "category": "education",
        "id": "edu_2_physics",
        "title": "특수상대성이론 시간지연과 GPS",
        "script": "시간이 느리게 흐른다는 건 착각이 아니라 매일 일어나는 물리입니다.\n인공위성은 지상보다 시계가 하루에 38마이크로초 빠르게 갑니다.\n아인슈타인의 상대성이론으로 이를 보정하지 않으면 GPS 오차는 매일 11km씩 쌓입니다.\n우주와 스마트폰은 물리 법칙으로 완벽히 연결되어 있습니다.",
    },
    {
        "type": "education",
        "category": "education",
        "id": "edu_3_chemistry",
        "title": "물 분자 결합 각도 104.5도의 비밀",
        "script": "물 분자가 얼면 왜 부피가 늘어날까요?\n비밀은 비공유 전자쌍이 누르는 꺾인 각도 104.5도에 있습니다.\n이 각도 때문에 얼음이 될 때 육각형 빈 공간이 형성됩니다.\n밀도가 낮아진 얼음이 물 위에 떠서 겨울에도 물고기가 살아남습니다.",
    },
    # [공학 3종]
    {
        "type": "engineering",
        "category": "engineering",
        "id": "eng_1_engine",
        "title": "4행정 엔진 실린더 폭발 원리",
        "script": "엔진 실린더 안에서 1분에 3천 번 폭발하는 4행정의 기적입니다.\n흡입과 압축 과정을 거쳐 점화 플러그가 스파크를 튀깁니다.\n순식간에 2천 도의 고온 가스가 피스톤을 아래로 밀어냅니다.\n이 직선 왕복 운동을 크랭크축이 회전 동력으로 바꿔 바퀴를 굴립니다.",
    },
    {
        "type": "engineering",
        "category": "engineering",
        "id": "eng_2_aerospace",
        "title": "초음속 비행기 충격파와 소닉붐",
        "script": "보잉 전투기가 음속을 돌파할 때 주변에 생기는 원뿔형 구름의 정체입니다.\n비행기가 소리보다 빨라지면 음파가 앞으로 빠져나가지 못하고 겹칩니다.\n압축된 공기가 강력한 원뿔형 충격파 면을 형성합니다.\n이 충격파가 지상에 도달할 때 폭탄 같은 굉음인 소닉붐이 발생합니다.",
    },
    {
        "type": "engineering",
        "category": "engineering",
        "id": "eng_3_semiconductor",
        "title": "트랜지스터 게이트 나노 전압 제어",
        "script": "손톱만 한 칩에 100억 개의 트랜지스터를 집적하는 원리입니다.\n게이트에 미세한 전압을 걸면 채널에 전자가 모여 통로가 열립니다.\n0과 1의 전기 신호를 1초에 수십억 번 켜고 끕니다.\n나노 공정의 극한에서 전류 누설을 막는 3D FinFET 구조가 핵심입니다.",
    },
]

async def main():
    base_output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "outputs", "test_verification")
    os.makedirs(base_output_dir, exist_ok=True)

    results = []
    print(f"============================================================")
    print(f"🚀 [2차 운영 안정성 검증] 총 6편(교육 3 + 공학 3) 실제 MP4 렌더링 시작")
    print(f"============================================================")

    for i, tc in enumerate(TEST_CASES, 1):
        t0 = time.time()
        job_dir = os.path.join(base_output_dir, tc["id"])
        print(f"\n[{i}/6] [{tc['type'].upper()}] {tc['title']} ({tc['id']}) 생성 중...")
        
        try:
            res = await run_pipeline(
                script=tc["script"],
                title=tc["title"],
                category=tc["category"],
                output_dir=job_dir
            )
            render_sec = time.time() - t0
            mp4_path = res["video"]
            size_mb = os.path.getsize(mp4_path) / (1024 * 1024)

            # 상세 검증
            from moviepy import VideoFileClip
            clip = VideoFileClip(mp4_path)
            w, h = clip.size
            duration = clip.duration
            fps = clip.fps
            has_audio = clip.audio is not None
            clip.close()

            status_entry = {
                "id": tc["id"],
                "type": tc["type"],
                "title": tc["title"],
                "mp4_path": mp4_path,
                "file_size_mb": round(size_mb, 2),
                "resolution": f"{w}x{h}",
                "duration_sec": round(duration, 2),
                "fps": fps,
                "has_audio": has_audio,
                "render_time_sec": round(render_sec, 2),
                "quality_passed": res.get("quality_passed", False),
                "quality_report": res.get("quality_report", ""),
                "status": "PASS" if (w == 1080 and h == 1920 and has_audio and size_mb > 0.5) else "FAIL"
            }
            print(f"   -> 완료: {size_mb:.2f}MB, {duration:.1f}초, {w}x{h}, 렌더소요 {render_sec:.1f}초 -> {status_entry['status']}")
            results.append(status_entry)
        except Exception as e:
            print(f"   -> ❌ 실패: {str(e)}")
            results.append({
                "id": tc["id"],
                "type": tc["type"],
                "title": tc["title"],
                "status": "FAIL",
                "error": str(e)
            })

    # 결과 JSON 저장
    result_path = os.path.join(base_output_dir, "test_results.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n============================================================")
    print(f"검증 결과 리포트 저장 완료: {result_path}")
    print(f"============================================================")

if __name__ == "__main__":
    asyncio.run(main())

