# Firebase 실제 설정 가이드

## 1. Firebase 프로젝트 생성

### 1.1 Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Google 계정으로 로그인
3. "프로젝트 추가" 클릭

### 1.2 프로젝트 설정
1. **프로젝트 이름**: `engineering-shorts-generator` (또는 원하는 이름)
2. **Google Analytics**: 필요 없으면 체크 해제
3. "프로젝트 만들기" 클릭
4. 프로젝트가 생성될 때까지 기다림 (약 1-2분)

## 2. Authentication 설정

### 2.1 Authentication 활성화
1. 왼쪽 메뉴에서 "Authentication" 클릭
2. "시작하기" 버튼 클릭
3. "로그인 방법" 탭 클릭

### 2.2 Email/Password 로그인 활성화
1. "이메일/비밀번호" 클릭
2. "사용 설정" 스위치 ON
3. "저장" 클릭

### 2.3 Google 로그인 활성화 (선택사항)
1. "Google" 클릭
2. "사용 설정" 스프링 ON
3. 프로젝트 공개 이름 입력
4. 프로젝트 지원 이메일 입력
5. "저장" 클릭

## 3. 서비스 계정 키 생성

### 3.1 서비스 계정 접근
1. 왼쪽 메뉴에서 "프로젝트 설정" (톱니바퀴 아이콘) 클릭
2. "서비스 계정" 탭 클릭
3. "서비스 계정 만들기" 클릭

### 3.2 서비스 계정 키 다운로드
1. "새 비공개 키 생성" 버튼 클릭
2. 키 형식: JSON 선택
3. "생성" 클릭
4. JSON 파일이 자동으로 다운로드됨

### 3.3 키 파일 배치
1. 다운로드된 JSON 파일 이름을 `firebase-adminsdk-key.json`으로 변경
2. 프로젝트 루트 디렉토리 (`engineering-shorts-generator/`)에 저장
3. **중요**: 이 파일을 `.gitignore`에 추가하여 GitHub에 올리지 않도록 함

## 4. Firebase Storage 설정 (선택사항)

### 4.1 Storage 활성화
1. 왼쪽 메뉴에서 "Storage" 클릭
2. "시작하기" 버튼 클릭
3. "시작하기" 클릭
4. 보안 규칙 설정:
   - 테스트용: `allow read, write: if true;`
   - 프로덕션용: `allow read, write: if request.auth != null;`
5. "완료" 클릭

## 5. .env 파일 설정

프로젝트 루트의 `.env` 파일에 다음 내용 추가:

```env
# Firebase 설정
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json
```

## 6. Firebase 연동 테스트

### 6.1 연동 테스트 스크립트 실행
```bash
cd engineering-shorts-generator
py -3.14 test_auth_storage.py
```

### 6.2 예상 결과
- Firebase 상태: 활성화
- Firebase가 초기화되지 않았습니다 오류 없음
- 로그인/등록 기능 작동

## 7. Firebase 규칙 설정

### 7.1 Authentication 규칙
Firestore 데이터베이스 규칙 (사용 시):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 7.2 Storage 규칙
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 8. 문제 해결

### 8.1 초기화 실패
- **문제**: "Firebase가 초기화되지 않았습니다" 오류
- **해결**: 
  - `firebase-adminsdk-key.json` 파일이 올바른 위치에 있는지 확인
  - 파일 경로가 `.env`에 올바르게 설정되어 있는지 확인
  - JSON 파일이 손상되지 않았는지 확인

### 8.2 권한 오류
- **문제**: "Permission denied" 오류
- **해결**:
  - Firebase Console에서 Authentication이 활성화되어 있는지 확인
  - 서비스 계정에 충분한 권한이 있는지 확인
  - Firestore/Storage 규칙을 확인

### 8.3 할당량 초과
- **문제**: "Quota exceeded" 오류
- **해결**:
  - Firebase Console에서 할당량 확인
  - Spark 플랜(무료) 한도 확인
  - Blaze 플랜(유료)으로 업그레이드 고려

## 9. 프로덕션 배포 시 고려사항

### 9.1 보안
- 서비스 계정 키를 절대 공개하지 않음
- 환경 변수 또는 비밀 관리 서비스 사용
- 적절한 Firebase 규칙 설정

### 9.2 비용
- Spark 플랜(무료) vs Blaze 플랜(유료) 비교
- Storage, Authentication, Firestore 사용량 모니터링
- 예산 알림 설정

### 9.3 모니터링
- Firebase Console의 사용량 및 성능 모니터링
- Crashlytics (오류 보고) 설정
- Analytics (사용자 행동 분석) 설정

## 10. 다음 단계

Firebase 설정이 완료되면:
1. GitHub OAuth 설정 가이드 참조
2. 전체 시스템 통합 테스트
3. Vercel 배포