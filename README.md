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

## v0에서 이어서 작업하기

GitHub 저장소를 v0로 가져오는 클릭 순서, 기준 브랜치, 복사해서 쓸 첫 프롬프트는 [V0_START_HERE.md](V0_START_HERE.md)에 있습니다. v0의 **Publish**는 기준 브랜치에 PR을 병합하고 프로덕션 배포를 진행할 수 있으므로 프리뷰와 배포 대상을 확인한 후 사용하세요.

## 영상 생성 및 배포 조건

`/auto`의 기본 경로는 브라우저 Canvas와 `MediaRecorder`를 이용한 무료 로컬 3D WebM 렌더입니다. 제목·대본 자막을 포함한 1080×1920, 30fps 영상을 브라우저 안에서 생성하고 미리보기/다운로드하며 서버 업로드나 크레딧 차감은 없습니다. 720×1280 장면을 1.5배 해상도로 렌더링하고, 신디사이저 배경음을 포함하지만 AI 생성 이미지, 나레이션 TTS, MP4 인코딩은 포함하지 않습니다.

개발 미리보기에서는 별도의 유료 AI 경로도 선택할 수 있습니다. Seedance v1.0 Pro Fast로 10초 클립 3개를 1080p로 생성해 브라우저에서 30초 WebM으로 합성하며, 현재 Gateway 단가($0.049/초) 기준 예상 모델 사용료는 편당 $1.47입니다. 실시간 1080p 요금이 $0.055/초를 넘으면 요청을 차단하고, SDK 자동 재시도도 비활성화합니다. 성공하지 못한 시도에서 이미 생성된 클립은 비용이 청구될 수 있습니다. 유료 경로는 `NODE_ENV=development`에서만 동작합니다.

기존 `/api/auto-pipeline` Python/MoviePy 렌더링은 로컬 서버에서만 실행할 수 있으며 Vercel에서는 명시적으로 비활성화됩니다. 로그인·계정·관리자·결제·TTS API도 Vercel에서 영구 저장소와 서비스 설정이 준비될 때까지 fail-closed 처리됩니다. 앱 데이터는 `data/` 아래 JSON 파일에 저장되어 Vercel 서버리스 인스턴스 간에 영구적으로 공유되지 않습니다. 인증·과금이 필요한 공개 서비스로 출시하기 전에는 영구 데이터베이스와 사용량 제한을 구성해야 합니다. 무료 로컬 3D WebM 경로는 이 외부 설정 없이 사용할 수 있습니다. WebM 녹화가 가능한 최신 Chrome/Edge 등 데스크톱 브라우저를 사용하세요.

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
