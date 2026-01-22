# GitHub Webhook 설정 가이드

## 자동 Webhook 생성

업무 생성 시 "개발팀 업무"를 선택하고 GitHub 레포지토리 정보를 입력하면, 시스템이 자동으로 GitHub에 Webhook을 생성합니다.

## Webhook 생성이 실패하는 경우

### 1. Personal Access Token 권한 부족

GitHub Personal Access Token에 다음 권한이 필요합니다:
- `repo` (전체 레포지토리 접근)
- `admin:repo_hook` (레포지토리 Webhook 관리)

**해결 방법:**
1. GitHub → Settings → Developer settings → Personal access tokens
2. 토큰을 생성하거나 기존 토큰을 수정
3. `admin:repo_hook` 권한을 체크
4. 업무를 다시 생성하거나 레포지토리를 다시 연결

### 2. BACKEND_URL이 localhost로 설정됨

GitHub는 인터넷에서 접근 가능한 URL로만 Webhook을 보낼 수 있습니다. `localhost:8080`은 GitHub에서 접근할 수 없습니다.

**해결 방법:**
- 개발 환경: ngrok 같은 터널링 도구 사용
- 프로덕션 환경: 실제 도메인으로 `BACKEND_URL` 설정

### 3. 레포지토리 소유자가 아님

레포지토리 소유자이거나 `admin` 권한이 있어야 Webhook을 생성할 수 있습니다.

**해결 방법:**
- 레포지토리 소유자에게 권한 요청
- 또는 소유자 계정의 Personal Access Token 사용

## 수동 Webhook 생성 (자동 생성 실패 시)

자동 생성이 실패한 경우, GitHub에서 수동으로 Webhook을 생성할 수 있습니다:

1. GitHub 레포지토리 → Settings → Webhooks → Add webhook
2. Payload URL: `http://your-backend-url/api/github/webhook`
3. Content type: `application/json`
4. Secret: 데이터베이스에 저장된 `webhookSecret` 값 (백엔드 로그에서 확인)
5. Events: `push`, `pull_request` 선택
6. Active 체크
7. Add webhook 클릭

## Webhook 생성 확인

업무 생성 후 백엔드 콘솔 로그를 확인하세요:
- `✅ Webhook 생성 성공: ID=123456` → 성공
- `❌ Webhook 생성 오류: ...` → 실패 (위의 해결 방법 참고)

## 문제 해결

1. 백엔드 콘솔에서 Webhook 생성 로그 확인
2. GitHub 레포지토리 Settings → Webhooks에서 Webhook 존재 여부 확인
3. Webhook이 없다면 위의 "수동 Webhook 생성" 방법 사용
