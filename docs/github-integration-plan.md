# GitHub API 통합 구현 계획

## 📋 개요

개발팀의 GitHub 레포지토리에서 commit, push, pull request 상태를 실시간으로 모니터링하는 기능을 구현합니다.

## 🎯 구현 목표

1. **GitHub 레포지토리 연결**: 팀별로 GitHub 레포지토리 정보 저장
2. **Commit 모니터링**: 최근 커밋 내역 실시간 조회
3. **Pull Request 모니터링**: PR 상태 (open, closed, merged) 실시간 조회
4. **Push 이벤트**: 새로운 push 발생 시 실시간 알림
5. **대시보드 표시**: 팀 대시보드에 GitHub 활동 표시

## 🏗️ 아키텍처

### 옵션 1: 폴링 방식 (구현 간단)
- 주기적으로 GitHub API 호출 (예: 30초마다)
- 장점: 구현 간단, WebSocket 불필요
- 단점: 실시간성 낮음, API rate limit 고려 필요

### 옵션 2: GitHub Webhooks (권장)
- GitHub에서 이벤트 발생 시 서버로 POST 요청
- 장점: 진짜 실시간, API 호출 최소화
- 단점: 공개 URL 필요 (ngrok 또는 배포 서버 필요)

### 옵션 3: 하이브리드
- Webhook + 주기적 폴링 (Webhook 실패 시 백업)

## 📊 데이터베이스 스키마 추가

```prisma
model GitHubRepository {
  id            String   @id @default(uuid())
  teamId        String   @unique
  owner         String   // GitHub username or organization
  repo          String   // Repository name
  accessToken   String   // GitHub Personal Access Token (암호화 필요)
  webhookSecret String?  // Webhook secret for verification
  webhookId     Int?     // GitHub webhook ID
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  team Team @relation(fields: [teamId], references: [teamName])
  
  @@index([teamId])
}

model GitHubActivity {
  id           String   @id @default(uuid())
  repositoryId String
  type         String   // "commit", "push", "pull_request"
  action       String?  // "opened", "closed", "merged" (PR의 경우)
  author       String
  message      String
  sha          String?  // Commit SHA
  branch       String?
  url          String
  createdAt    DateTime @default(now())

  repository GitHubRepository @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  
  @@index([repositoryId, createdAt])
  @@index([type, createdAt])
}
```

## 🔐 인증 방식

### GitHub Personal Access Token (PAT)
1. 사용자가 GitHub에서 Personal Access Token 생성
2. 팀 설정에서 레포지토리 정보와 함께 저장
3. 백엔드에서 암호화하여 저장 (bcrypt 또는 환경 변수)

### GitHub OAuth App (더 안전)
1. GitHub OAuth App 생성
2. 사용자 인증 후 access token 발급
3. 토큰 갱신 로직 구현

## 🔌 API 엔드포인트 설계

### 백엔드 API

```
POST   /api/github/repositories          # 레포지토리 연결
GET    /api/github/repositories          # 연결된 레포지토리 목록
GET    /api/github/repositories/:id     # 레포지토리 상세 정보
PUT    /api/github/repositories/:id     # 레포지토리 정보 수정
DELETE /api/github/repositories/:id     # 레포지토리 연결 해제

GET    /api/github/activities            # 최근 활동 조회
GET    /api/github/commits/:repoId       # 커밋 목록
GET    /api/github/pull-requests/:repoId # PR 목록

POST   /api/github/webhook               # GitHub Webhook 수신
```

## 📡 GitHub API 사용

### 필요한 API 엔드포인트

1. **Commits 조회**
   ```
   GET /repos/{owner}/{repo}/commits
   ```

2. **Pull Requests 조회**
   ```
   GET /repos/{owner}/{repo}/pulls
   ```

3. **Webhook 생성**
   ```
   POST /repos/{owner}/{repo}/hooks
   ```

4. **Webhook 이벤트 수신**
   ```
   POST /api/github/webhook
   ```

## 🔄 실시간 업데이트 구현

### 방법 1: 폴링 (간단)
```javascript
// 백엔드: 주기적 폴링
setInterval(async () => {
  const repos = await getActiveRepositories();
  for (const repo of repos) {
    await fetchLatestCommits(repo);
    await fetchLatestPRs(repo);
  }
}, 30000); // 30초마다
```

### 방법 2: Webhook (권장)
```javascript
// GitHub Webhook 설정
POST /repos/{owner}/{repo}/hooks
{
  "name": "web",
  "active": true,
  "events": ["push", "pull_request"],
  "config": {
    "url": "https://your-server.com/api/github/webhook",
    "content_type": "json",
    "secret": "webhook_secret"
  }
}

// Webhook 수신 처리
app.post("/api/github/webhook", (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;
  
  if (event === "push") {
    handlePushEvent(payload);
  } else if (event === "pull_request") {
    handlePullRequestEvent(payload);
  }
  
  res.status(200).send("OK");
});
```

### 방법 3: WebSocket 브로드캐스트
```javascript
// Webhook 수신 시 WebSocket으로 클라이언트에 전송
chatWSS.broadcastToTeam(teamId, {
  type: "github_activity",
  data: {
    type: "commit",
    author: "user",
    message: "Fix bug",
    url: "..."
  }
});
```

## 🎨 프론트엔드 UI

### 1. 팀 설정 페이지
- GitHub 레포지토리 연결 폼
- 레포지토리 목록 표시
- 연결 해제 기능

### 2. 대시보드 위젯
- 최근 커밋 목록
- 열린 PR 목록
- 활동 통계

### 3. 실시간 알림
- 새로운 커밋/PR 발생 시 알림
- 사이드바에 GitHub 아이콘 + 배지

## 📦 필요한 패키지

### 백엔드
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",  // GitHub API 클라이언트
    "crypto": "^1.0.1"            // Webhook 서명 검증
  }
}
```

### 프론트엔드
```json
{
  "dependencies": {
    "octokit": "^3.0.0"  // GitHub API 클라이언트 (선택사항)
  }
}
```

## 🔒 보안 고려사항

1. **토큰 암호화**: GitHub Personal Access Token은 암호화하여 저장
2. **Webhook 서명 검증**: GitHub에서 보낸 요청인지 검증
3. **Rate Limit 관리**: GitHub API rate limit 모니터링
4. **권한 제한**: 팀장 이상만 레포지토리 연결 가능

## 📝 구현 단계

### Phase 1: 기본 구조
1. 데이터베이스 스키마 추가
2. GitHub 레포지토리 연결 API
3. 기본 GitHub API 호출 테스트

### Phase 2: 데이터 수집
1. Commits 조회 API
2. Pull Requests 조회 API
3. 활동 내역 저장

### Phase 3: 실시간 업데이트
1. Webhook 설정 및 수신
2. WebSocket 브로드캐스트
3. 폴링 백업 로직

### Phase 4: UI 구현
1. 레포지토리 설정 페이지
2. 대시보드 위젯
3. 실시간 알림

## 🚀 빠른 시작 (폴링 방식)

가장 간단한 방법으로 시작:

1. **데이터베이스 스키마 추가**
2. **레포지토리 연결 API 구현**
3. **주기적 폴링 로직 구현** (30초마다)
4. **프론트엔드 대시보드에 표시**

이 방식으로 시작하고, 나중에 Webhook으로 업그레이드 가능합니다.

## 📚 참고 자료

- [GitHub REST API 문서](https://docs.github.com/en/rest)
- [GitHub Webhooks 가이드](https://docs.github.com/en/webhooks)
- [Octokit.js 라이브러리](https://github.com/octokit/octokit.js)
