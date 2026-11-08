# ShortsMaking

Codex + Google Flow 워크플로우 기반 **공학/교육 쇼츠** 자동 제작 플랫폼입니다.

[YouTube 영상](https://youtu.be/xRed28mz4-s)에서 소개된 워크플로우를 웹 플랫폼으로 구현했습니다.

## 기능

- **대본 입력** → 음성 길이 기반 키프레임 수 자동 계산
- **Step 1**: 인포그래픽 없는 키프레임 이미지 프롬프트 생성
- **Step 2**: 인포그래픽 추가 이미지 프롬프트 생성
- **Step 3**: 모션 그래픽 영상 클립 프롬프트 생성
- **Step 4**: TTS 음성 생성 가이드 (Google Generate Speech)
- **Step 5**: 편집 가이드 + 클립 파일명 정렬
- **비용 계산기**: Google Flow 크레딧/원화 예측
- **전체 가이드 MD** 다운로드

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## Vercel 배포 상태

현재 저장소는 Vercel에서 영상 렌더링까지 운영할 준비가 되어 있지 않습니다. `/api/auto-pipeline`은 Python, MoviePy, FFmpeg를 동기 실행하고 결과물을 `public/outputs`에 기록하지만, Vercel 함수는 이 장기 실행 작업과 영구 로컬 파일 저장을 제공하지 않습니다. 따라서 Vercel에서 이 API는 크레딧을 차감하거나 성공을 가장하지 않고 `503 RENDERER_NOT_CONFIGURED`를 반환합니다.

또한 사용자·크레딧·설정 데이터가 `data/` 아래 JSON 파일에 저장됩니다. Vercel 배포 전에 이 상태 데이터도 영구 데이터베이스로 옮겨야 합니다. 실제 영상 생성 기능을 활성화하려면 별도 렌더 워커, 비동기 작업 제출/상태 조회, 영구 아티팩트 저장소를 연결해야 합니다. 현재 저장소에는 이 외부 렌더링 연동이 없습니다. Vercel 프로젝트 계정 설정만으로는 이 코드의 배포 준비가 완료되지 않습니다.

## 워크플로우

1. 대본 작성 + TTS 음성 길이 입력
2. Google Flow에 Step 1 프롬프트 붙여넣기 → 키프레임 이미지 생성
3. Step 2 프롬프트 → 인포그래픽 이미지 생성
4. Step 3 프롬프트 → 4초 영상 클립 생성
5. Google Generate Speech로 TTS 음성 생성
6. CapCut/Premiere에서 편집 + Vrew 자막

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- LocalStorage (프로젝트 저장)

## OpenAI API (선택)

`/api/generate` 엔드포인트에 OpenAI API 키를 전달하면 GPT 기반 고품질 프롬프트 생성이 가능합니다.
