# 아키텍처 다이어그램 검증 문서

이 문서는 **실제 코드베이스**를 기준으로 프로젝트 아키텍처를 기술·알고리즘 관점에서 정리한 검증용 명세입니다. 다이어그램이 이 프로젝트를 정확히 반영하는지 확인할 때 이 명세와 대조하면 됩니다.

---

## 1. 시스템 구성 요소 (반드시 다이어그램에 포함되어야 할 것)

### 1.1 클라이언트 (프론트엔드)

| 기술                     | 용도                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| **Next.js** (App Router) | 라우팅, SSR/CSR                                                             |
| **React**                | UI                                                                          |
| **TypeScript**           | 타입                                                                        |
| **Zustand**              | 전역 상태 (authStore, taskStore, teamStore, notificationStore, useCalendar) |
| **Tailwind CSS**         | 스타일                                                                      |

**주요 페이지/경로**

- `/` – 대시보드(업무 목록, 탭: NOW / REVIEW / COMPLETED / CANCELLED / ENDING)
- `/auth/login`, `/auth/register` – 인증
- `/tasks`, `/tasks/[id]` – 업무 목록·상세
- `/manager`, `/manager/tasks`, `/manager/team` – 관리자
- `/team/create`, `/team/join` – 팀 생성/가입
- `/calendar` – 캘린더(회의실, 미팅, 연차/휴가)
- `/chat` – 팀 채팅·1:1 채팅

**API 클라이언트** (`src/lib/api/`)

- auth, calendar, chat, github, tasks, team, upload, users

**WebSocket**

- `src/lib/websocket/chatClient.ts` – 단일 인스턴스, JWT 쿼리로 인증
- 연결 경로: `ws://.../ws/chat?token=...`
- 메시지 타입: `join`, `leave`, `send` (채팅) + 서버 푸시: `message`, `github_activity`, `leave_request` 등

---

### 1.2 백엔드 (Express)

| 기술                  | 용도                                      |
| --------------------- | ----------------------------------------- |
| **Node.js + Express** | HTTP API 서버                             |
| **JWT**               | 인증 (Authorization: Bearer)              |
| **Prisma**            | ORM                                       |
| **PostgreSQL**        | DB                                        |
| **ws**                | WebSocket 서버 (같은 HTTP 서버에 마운트)  |
| **Multer**            | 업로드 (메모리) → S3                      |
| **AWS SDK (S3)**      | 이미지 저장                               |
| **Octokit**           | GitHub API (레포 연결, 웹훅 생성/삭제)    |
| **bcrypt**            | 비밀번호 해시 (회원가입/로그인)           |
| **crypto**            | 웹훅 서명 검증 (HMAC-SHA256), secret 생성 |

**미들웨어 순서 (server.js, 중요)**

1. `cors()`
2. `express.static(__dirname)`
3. **`/api/github/webhook` 에만** `express.raw({ type: 'application/json' })` → 웹훅 본문이 Buffer로 유지됨
4. `express.json()` → 나머지 API는 JSON 파싱

**인증**

- 대부분 라우트: `authenticate` 미들웨어 (JWT 검증 → `req.user`)
- 예외: `POST /api/github/webhook` (GitHub 직접 호출, 인증 없음)
- Google/Kakao 로그인: 서버에서 토큰 교환 후 JWT 발급, 프론트로 리다이렉트

---

### 1.3 외부 서비스

| 서비스           | 용도                                                     |
| ---------------- | -------------------------------------------------------- |
| **Google OAuth** | 로그인 (이메일/프로필)                                   |
| **Kakao OAuth**  | 로그인 (이메일/프로필)                                   |
| **GitHub**       | 팀 레포 1개 + 업무별 레포 연결, 웹훅(push/pull_request)  |
| **AWS S3**       | 업무 참조 이미지 업로드                                  |
| **ngrok**        | 로컬 웹훅 URL 노출 (다이어그램에 “개발 시” 로 명시 가능) |

---

## 2. API 엔드포인트 (완전 목록)

다이어그램에서 “백엔드 API”를 그릴 때 아래와 일치하는지 확인하는 것이 좋습니다.

### 2.1 인증 (auth)

- `POST /api/auth/register` – 회원가입 (이메일/비밀번호, bcrypt)
- `POST /api/auth/login` – 이메일 로그인
- `GET /api/auth/check-email` – 이메일 중복 확인
- Google: `GET /login` → Google → `GET /login/redirect` (서버에서 JWT 발급 후 프론트 리다이렉트)
- Kakao: `GET /auth/kakao` → `GET /auth/kakao/callback` (동일하게 JWT 발급 후 리다이렉트)

### 2.2 사용자 (users)

- `GET /api/users/me` – 내 정보 (인증)
- `GET /api/users/team-members` – 팀 멤버 목록

### 2.3 팀 (team)

- `GET /api/team/dashboard` – 팀 대시보드
- `POST /api/team/create` – 팀 생성
- `POST /api/team/join` – 팀 가입
- `GET /api/team/getTeam` – 팀 정보
- `POST /api/team/leave` – 팀 나가기

### 2.4 업무 (tasks)

- `GET /api/tasks` – 목록 (역할/담당자/참여자에 따라 필터)
- `GET /api/tasks/:id` – 상세 (참여자 note, startedAt, githubRepository, referenceLinks 포함)
- `POST /api/tasks` – 생성 (초기 상태 **NOW**, 참여자 생성, 선택 시 GitHub 연결은 트랜잭션 외부 비동기)
- `PUT /api/tasks/:id/status` – 상태 변경 (전이 규칙 + 역할 검사)
- `PUT /api/tasks/:id/participants/:participantId/start` – 참여자 “시작” (startedAt)
- `PUT /api/tasks/:id/participants/:participantId/note` – 참여자 노트
- `GET /api/tasks/:id/participants/notes` – 참여자 노트 조회
- `PUT /api/tasks/:id/links` – 참고 링크 배열 저장

### 2.5 GitHub (github)

- `POST /api/github/webhook` – **인증 없음**, raw body, push/pull_request/ping 처리
- `POST /api/github/repositories` – 팀 레포 연결 (팀장 이상, 웹훅 생성)
- `GET /api/github/repositories` – 팀 레포 정보
- `DELETE /api/github/repositories/:id` – 팀 레포 해제 (GitHub 웹훅 삭제 후 DB 삭제)
- `GET /api/github/activities` – 팀 레포 활동 (GitHubActivity)
- `GET /api/github/task-activities/:taskId` – 업무별 활동 (같은 owner/repo인 모든 TaskGitHubRepository 기준으로 TaskGitHubActivity 조회)

### 2.6 캘린더 (calendar)

- `GET /api/calendar/events` – 일정 목록
- `GET /api/calendar/events/pending` – 승인 대기 연차/휴가
- `POST /api/calendar/events` – 일정 생성
- `PUT /api/calendar/events/:id/approve` – 연차/휴가 승인
- `PUT /api/calendar/events/:id/reject` – 연차/휴가 반려
- `DELETE /api/calendar/events/:id` – 일정 삭제
- `GET /api/calendar/events/:id` – 일정 상세

### 2.7 채팅 (chat)

- `GET /api/chat/room` – 팀 채팅방
- `GET /api/chat/direct/:userId` – 1:1 채팅방 조회/생성
- `GET /api/chat/messages` – 메시지 목록 (페이징)
- `POST /api/chat/messages` – 메시지 전송 (DB 저장 + WebSocket으로 방 참여자에게 브로드캐스트)
- `DELETE /api/chat/messages/:id` – 메시지 삭제

### 2.8 업로드 (upload)

- `POST /api/upload` – 단일 이미지 (Multer → S3)
- `POST /api/upload/multiple` – 다중 이미지 (최대 5장)

### 2.9 기타

- `GET /health` – DB 연결 확인

---

## 3. 데이터베이스 모델 (Prisma)

다이어그램에 “데이터 영역”을 그릴 때 아래 엔티티가 빠지지 않았는지 확인할 수 있습니다.

- **User** – email, role(MEMBER/TEAM_LEAD/MANAGER/DIRECTOR), teamName, password(선택)
- **Team** – teamName (unique)
- **Task** – status(PENDING/NOW/IN_PROGRESS/REVIEW/COMPLETED/CANCELLED/ENDING), priority, referenceImageUrls, referenceLinks, isDevelopmentTask
- **TaskParticipant** – role(OWNER/PARTICIPANT/REVIEWER), note, startedAt
- **TaskStatusHistory**
- **GitHubRepository** – 팀당 1개 (teamId unique), webhookId, webhookSecret, accessToken
- **TaskGitHubRepository** – 업무당 1개 (taskId unique), 동일 필드
- **GitHubActivity** – 팀 레포 활동 (repositoryId → GitHubRepository)
- **TaskGitHubActivity** – 업무별 레포 활동 (repositoryId → TaskGitHubRepository)
- **CalendarEvent** – type(MEETING_ROOM/MEETING/LEAVE/VACATION), status
- **ChatRoom** – type(TEAM/DIRECT), teamId (TEAM일 때)
- **ChatRoomParticipant**
- **Message**

업무별 GitHub 활동 조회 시 **같은 owner/repo를 쓰는 모든 TaskGitHubRepository**의 ID로 TaskGitHubActivity를 조회하는 점이 알고리즘상 중요합니다.

---

## 4. 핵심 알고리즘·플로우 (다이어그램/시퀀스에서 누락되기 쉬운 부분)

### 4.1 업무 상태 전이

- **초기 상태**: 업무 생성 시 항상 **NOW** (PENDING 아님).
- **허용 전이** (코드 기준):
  - NOW → COMPLETED, REVIEW, CANCELLED
  - IN_PROGRESS → NOW, COMPLETED, CANCELLED
  - COMPLETED → REVIEW, ENDING, CANCELLED
  - REVIEW → ENDING, NOW, CANCELLED (승인→ENDING, 반려→NOW)
  - CANCELLED, ENDING → 변경 불가
- **권한**:
  - REVIEW(검토 요청): 팀장급 이상은 불가, 담당자/참여자만 가능.
  - ENDING(검토 완료): 팀장급 이상만 가능.

다이어그램에 “업무 라이프사이클”을 그릴 때 PENDING이 “시작 전”으로 나오면 **현재 구현과 다름**입니다.

### 4.2 참여자별 “시작” 플로우

- 참여자는 **노트(note)를 먼저 등록**한 뒤 `PUT .../participants/:id/start` 로 “시작” 가능.
- 시작 시 `TaskParticipant.startedAt` 이 설정됨 (프론트에서 “진행 중” 표시에 사용).

다이어그램에 “참여자 업무 시작” 플로우가 있다면 “노트 등록 → 시작 버튼 활성화 → 시작 API” 순서가 반영되어야 합니다.

### 4.3 GitHub 웹훅 처리 (정확한 순서)

1. **수신**: `POST /api/github/webhook` (raw body 필수).
2. **헤더**: `x-github-event`, `x-hub-signature-256`, `x-github-delivery`.
3. **ping**: 서명 검증 없이 200 반환.
4. **레포 식별**: `payload.repository.full_name` → owner/repo.
5. **레포 조회**: 먼저 `GitHubRepository`(팀), 없으면 `TaskGitHubRepository`(업무)에서 owner/repo로 검색.
6. **서명 검증**: `webhookId`가 null이면 검증 스킵(경고만); 아니면 HMAC-SHA256(secret, rawBody) vs `x-hub-signature-256`.
7. **이벤트**: push → 커밋별로 GitHubActivity 또는 TaskGitHubActivity 저장; pull_request → 한 건 저장.
8. **실시간 알림**: `chatWSS.broadcastToTeam(teamId, { type: 'github_activity', data: { ..., taskId? } })` (업무 레포일 때 taskId 포함).
9. **응답**: 레포/secret 없거나 처리 중 오류가 나도 **재시도 방지를 위해 200** 반환하는 경우가 있음 (코드 주석 기준).

다이어그램에 “GitHub → 백엔드”만 있고 “raw body / 서명 검증 / 팀 vs 업무 레포 / WebSocket 브로드캐스트”가 없으면 **알고리즘 누락**입니다.

### 4.4 업무별 GitHub 활동 조회 알고리즘

- 한 **Task**는 하나의 **TaskGitHubRepository**와 연결 (taskId unique).
- 같은 GitHub **owner/repo**를 쓰는 업무가 여러 개일 수 있으므로, **동일 owner/repo를 가진 모든 TaskGitHubRepository**의 id를 구한 뒤, `TaskGitHubActivity.repositoryId in (those ids)` 로 조회합니다.
- 따라서 “업무 상세의 GitHub 활동”은 “해당 업무의 레포 + 같은 레포를 쓰는 다른 업무의 레포”까지 포함한 활동 목록입니다.

다이어그램이나 설명에 “업무별 활동 = 같은 owner/repo 전체”가 반영되어 있으면 정확합니다.

### 4.5 WebSocket 이벤트 흐름

- **연결**: 클라이언트 `ws://.../ws/chat?token=JWT`, 서버에서 JWT 검증 후 팀 정보로 팀 채팅방 참여(join).
- **채팅**: 클라이언트 `send` → 서버가 DB에 저장 → 해당 채팅방(roomId)에만 `broadcastToRoom`으로 메시지 푸시.
- **GitHub 활동**: 웹훅 처리 후 `broadcastToTeam(teamId, { type: 'github_activity', data: { taskId?, ... } })` → 해당 팀 소속 연결 클라이언트 모두에게 전송.
- **프론트**: AppLayout에서 `message.type === 'github_activity'` 일 때 `window.dispatchEvent(new CustomEvent('github_activity', { detail: message.data }))` → TaskGithubActivityWidget 등에서 구독해 **taskId 일치 시에만** 목록 재조회.

다이어그램에 “실시간 GitHub 반영”이 있다면 “백엔드 WebSocket → AppLayout → CustomEvent → 위젯( taskId 필터)”까지 한 흐름으로 그려져야 합니다.

### 4.6 참고 링크 (referenceLinks)

- Task 모델에 `referenceLinks: string[]` 저장.
- `PUT /api/tasks/:id/links` 로 갱신 (담당자/참여자/팀장 이상).
- 상세 페이지에서는 “깃허브 활동”과 “내가 작성한 할 일” 사이 섹션에 표시.

다이어그램에 “업무 상세 기능”이 있다면 참고 링크 저장/표시가 포함되면 좋습니다.

---

## 5. 다이어그램 검증 체크리스트

아래를 확인하면 “기술적으로·알고리즘적으로 누락 없는지” 점검할 수 있습니다.

### 5.1 구성 요소

- [ ] 프론트: Next.js, React, TypeScript, Zustand, Tailwind
- [ ] 백엔드: Express, JWT, Prisma, PostgreSQL, ws(WebSocket)
- [ ] 외부: Google/Kakao OAuth, GitHub(API+Webhook), AWS S3
- [ ] WebSocket 경로: `/ws/chat`, 인증은 쿼리 token

### 5.2 API·미들웨어

- [ ] GitHub 웹훅만 raw body 사용 (express.raw 경로 한정)
- [ ] 웹훅 엔드포인트는 인증 없음
- [ ] 업무 생성 시 초기 상태 NOW
- [ ] 업무 상태 전이에 PENDING이 “시작 전”으로 나오지 않음

### 5.3 데이터·알고리즘

- [ ] 팀 레포(GitHubRepository) 1개 vs 업무별 레포(TaskGitHubRepository) 구분
- [ ] 업무별 활동 조회 시 “같은 owner/repo의 모든 TaskGitHubRepository” 기준
- [ ] GitHub 이벤트 → DB 저장 → WebSocket broadcastToTeam → 프론트 CustomEvent → taskId 필터
- [ ] 참여자: 노트 등록 후 “시작” API로 startedAt 설정
- [ ] 참고 링크: Task.referenceLinks, PUT /api/tasks/:id/links

### 5.4 자주 빠지는 부분

- [ ] 이중 GitHub 레포 개념 (팀 레포 / 업무별 레포)
- [ ] 웹훅 서명 검증(및 webhookId null 시 스킵)
- [ ] 업무 생성 시 GitHub 연결이 트랜잭션 **외부** 비동기
- [ ] 프론트 GitHub 실시간 반영 경로 (WebSocket → AppLayout → CustomEvent → 위젯)
- [ ] PENDING 제거된 업무 라이프사이클

---

## 6. 코드 이슈 (다이어그램과 무관, 참고용)

- `backend/routes/tasks.js` 573라인: `router.put("/:id/status", async (req, res) => {});` 빈 핸들러가 중복 등록되어 있음. 실제 동작은 386라인의 PUT /:id/status가 담당하므로 동작에는 영향 없으나, 제거 시 코드 일관성에 유리함.

---

이 문서는 **실제 코드**를 기준으로 작성되었습니다. 다이어그램을 이 명세와 비교해 누락·오류를 보완하면, 기술·알고리즘 측면에서 프로젝트를 정확히 설명하는 다이어그램을 유지할 수 있습니다.
