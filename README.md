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
