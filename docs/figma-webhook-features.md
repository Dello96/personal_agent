# Figma 웹훅으로 구현 가능한 기능 정리

현재 프로젝트 구조(팀·업무·실시간 WebSocket)에서 Figma 웹훅을 사용할 때 **Figma가 제공하는 이벤트**와, 그걸로 **만들 수 있는 기능**을 정리한 문서입니다.

---

## 1. Figma 웹훅이 지원하는 이벤트 (공식 기준)

웹훅 구독 시 선택할 수 있는 이벤트는 아래와 같습니다. `PING`은 구독 대상이 아니라 **웹훅 생성 시 한 번** Figma가 보내는 검증용 이벤트입니다.

| 이벤트명                   | 발동 조건                                                       | 페이로드에 포함되는 정보 예시                                                                                                                              |
| -------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FILE_UPDATE**            | 파일 편집 후 **약 30분간 편집 없을 때** 한 번                   | `file_key`, `file_name`, `timestamp`, `webhook_id`, `passcode`                                                                                             |
| **FILE_DELETE**            | 파일이 삭제될 때 (폴더 삭제 시 하위 파일 각각에 대해 발동)      | `file_key`, `file_name`, `triggered_by`(User), `timestamp`                                                                                                 |
| **FILE_VERSION_UPDATE**    | 파일 **버전 히스토리**에 이름 붙인 버전이 생성될 때             | `file_key`, `file_name`, `version_id`, `label`, `description`, `created_at`, `triggered_by`                                                                |
| **LIBRARY_PUBLISH**        | **라이브러리 파일**이 퍼블리시될 때 (컴포넌트/스타일/변수 변경) | `file_key`, `file_name`, `created_components/styles/variables`, `modified_*`, `deleted_*`, `triggered_by`                                                  |
| **FILE_COMMENT**           | 파일에 **댓글**이 달릴 때                                       | `file_key`, `file_name`, `comment`(텍스트/멘션 조각 배열), `comment_id`, `mentions`, `parent_id`(답글인 경우), `created_at`, `resolved_at`, `triggered_by` |
| **DEV_MODE_STATUS_UPDATE** | **Dev Mode**에서 레이어의 상태가 바뀔 때                        | `file_key`, `node_id`, `status`(NONE / READY_FOR_DEV / COMPLETED), `change_message`, `related_links`, `triggered_by`                                       |

---

## 2. 웹훅을 붙일 수 있는 범위 (Context)

| Context     | 설명                                     | 제한                                                            |
| ----------- | ---------------------------------------- | --------------------------------------------------------------- |
| **team**    | 팀 단위 (팀에 속한 파일/프로젝트 이벤트) | 팀당 웹훅 **20개**                                              |
| **project** | 특정 프로젝트 단위                       | 프로젝트당 **5개**                                              |
| **file**    | 특정 파일 단위                           | 파일당 **3개**, 플랜별 총량: Pro 150 / Org 300 / Enterprise 600 |

- **team** context: 팀 전체에 공개된 파일·뷰전용 프로젝트 파일에는 알림 오고, **초대 전용 프로젝트** 파일에는 알림 안 옴.
- 웹훅 생성/관리는 **Figma REST API**로만 가능 (Figma UI 없음).
- 생성 시 `event_type`, `context`, `context_id`, `endpoint`, `passcode`(선택) 등을 지정.

---

## 3. 현재 구조에서 Figma 웹훅으로 만들 수 있는 기능

GitHub 연동(팀 레포 / 업무별 레포, 웹훅 → DB → WebSocket)과 같은 패턴을 Figma에도 적용한다고 가정했을 때, **웹훅 이벤트별로** 기대할 수 있는 기능입니다.

### 3.1 파일 편집 추적 (FILE_UPDATE)

- **내용**: 특정 Figma 파일이 “편집 후 30분 무활동” 시점에 한 번씩 알림.
- **구현 방향**
  - 팀/업무에 “Figma 파일”(`file_key` 등)을 연결해 두고, 웹훅을 **file** 또는 **team** context로 등록.
  - 수신 시 `file_key`/`file_name`으로 우리 DB의 “Figma 연결”을 찾아 **마지막 업데이트 시각**만 갱신하거나, “Figma 활동” 로그를 한 줄 쌓기.
  - 필요 시 WebSocket으로 해당 팀/업무 화면에 “Figma 파일이 업데이트됨” 알림.
- **한계**: “누가 무엇을 바꿨는지”는 페이로드에 없음. “이 파일이 이 시각에 정리(업데이트)됐다” 수준의 추적만 가능.

### 3.2 파일 삭제 알림 (FILE_DELETE)

- **내용**: 연결해 둔 Figma 파일이 삭제되면 알림.
- **구현 방향**
  - `file_key`로 매핑된 업무/팀 설정에서 “연결된 Figma 파일”을 해제하거나, “삭제됨” 상태로 표시.
  - 팀/담당자에게 “연결된 Figma 파일이 삭제되었습니다” 알림(앱 내 또는 WebSocket).
- **역할**: 디자인–업무 연결 정합성 유지용.

### 3.3 버전/스냅샷 추적 (FILE_VERSION_UPDATE)

- **내용**: 디자이너가 버전 히스토리에 이름/설명을 붙인 시점을 알 수 있음.
- **구현 방향**
  - “Figma 활동” 타임라인에 “버전 생성: {label} – {description}” 같은 이벤트로 저장.
  - 업무 상세에 “디자인 버전 이력” 블록을 두고, `version_id`/`label`/`created_at`/`triggered_by`로 목록 표시.
  - 필요 시 버전별 링크(`https://www.figma.com/file/{file_key}/?version={version_id}`) 저장.
- **활용**: “이 업무에 대응하는 디자인 버전이 여기까지 반영됐다”를 업무와 연결해 추적.

### 3.4 라이브러리 퍼블리시 추적 (LIBRARY_PUBLISH)

- **내용**: 팀/디자인 시스템 라이브러리가 퍼블리시될 때, 어떤 컴포넌트/스타일/변수가 추가·수정·삭제됐는지 알 수 있음.
- **구현 방향**
  - 팀 context 웹훅으로 수신 → “라이브러리 퍼블리시” 활동 로그 저장 (file_key, file_name, created/modified/deleted 목록, triggered_by).
  - 팀 대시보드나 “디자인 시스템 활동” 같은 화면에 “오늘/이번 주 라이브러리 변경” 요약 표시.
  - 대량 퍼블리시는 이벤트가 여러 개로 쪼개질 수 있음(타입별·개수별) → 같은 `timestamp`/`triggered_by`로 묶어서 한 번에 표시하는 식으로 처리 가능.
- **활용**: 디자인 시스템 변경을 팀 단위로 모니터링.

### 3.5 댓글 추적 (FILE_COMMENT)

- **내용**: 특정 파일에 댓글이 달리거나 답글이 달릴 때마다 알림. 텍스트·멘션(@User)·이모지 조각으로 내용 전달.
- **구현 방향**
  - `file_key`로 연결된 업무/팀을 찾아 “Figma 댓글” 활동으로 저장 (comment_id, comment 조각, mentions, parent_id, created_at, resolved_at, triggered_by).
  - 업무 상세에 “Figma 댓글” 목록/타임라인 표시.
  - `mentions`가 있으면 우리 시스템 사용자와 매칭해 “멘션 알림” 연동 가능(이메일/앱 알림).
  - WebSocket으로 “연결된 파일에 새 댓글” 푸시.
- **활용**: 디자인 리뷰·피드백을 업무와 묶어서 한 곳에서 보기, 댓글 기반 태스크 생성(예: “TODO: …” 댓글 → 업무 자동 생성) 등.

### 3.6 Dev Mode 상태 추적 (DEV_MODE_STATUS_UPDATE)

- **내용**: Figma Dev Mode에서 레이어의 상태(NONE → READY_FOR_DEV → COMPLETED)가 바뀔 때, 그리고 “관련 링크”(Jira/기타 URL)가 붙을 때 알림.
- **구현 방향**
  - `file_key` + `node_id` + `status` + `change_message` + `related_links`를 “Figma Dev Mode 활동”으로 저장.
  - 업무와 Figma 레이어를 매핑해 두었다면(예: Jira 이슈 ID ↔ node_id 또는 related_links), “이 레이어가 READY_FOR_DEV/COMPLETED로 바뀜”을 업무 진행 상태와 연동.
  - `related_links`에 우리 업무 상세 URL을 넣어두는 워크플로를 쓰면 “이 디자인이 이 업무와 연결됐다”를 자동 반영 가능.
- **활용**: 디자인–개발 진행 상태 동기화, “디자인 완료/개발 대기/개발 완료” 같은 단계를 Figma와 우리 업무 상태로 함께 추적.

---

## 4. 현재 구조와의 매핑 (참고)

- **팀 단위 Figma**
  - GitHub의 “팀 레포 1개”처럼, **팀당 Figma 팀(또는 프로젝트)** 을 하나 연결.
  - 웹훅은 **team** 또는 **project** context로 등록해, 팀 전체 디자인 활동(FILE_UPDATE, LIBRARY_PUBLISH, FILE_COMMENT 등)을 한 곳에서 수집.
- **업무 단위 Figma**
  - GitHub의 “업무별 레포”처럼, **업무마다 특정 Figma 파일**을 연결.
  - 웹훅은 **file** context로, 해당 `file_key`에 대해 필요한 이벤트만 구독.
  - 수신 시 `file_key` → TaskFigmaFile(또는 유사 모델) → taskId → 해당 팀으로 WebSocket 브로드캐스트.
- **실시간 표시**
  - 기존처럼 웹훅 수신 → DB 저장 → `broadcastToTeam`(및 필요 시 taskId 포함) → 프론트에서 `figma_activity` 같은 이벤트로 수신해 “Figma 활동” 위젯 갱신.

---

## 5. 구현 시 유의사항

- **인증**
  - 웹훅 **등록/조회/삭제**는 Figma **OAuth** 필요. scope: `webhooks:read`, `webhooks:write`.
  - 웹훅 **수신** 쪽은 GitHub와 마찬가지로 **passcode**로 검증 권장(페이로드에 `passcode` 포함).
- **엔드포인트**
  - Figma는 **POST + JSON**으로 전송.
  - **200 OK**를 빨리 돌려줘야 함(실패 시 5분 / 30분 / 3시간 재시도).
  - GitHub 웹훅처럼 “raw body로 받아서 서명 검증”이 아니라, **passcode 문자열 비교**만 하면 됨.
- **제한**
  - 팀당 20개, 프로젝트당 5개, 파일당 3개라서 “업무별 파일 웹훅”을 많이 쓰면 파일당/플랜당 한도에 먼저 걸릴 수 있음.
  - FILE_UPDATE는 “30분 무활동 후” 한 번이므로, 실시간 편집 추적에는 사용할 수 없음.

---

## 6. 요약: 웹훅으로 쓸 수 있는 기능 한눈에

| 이벤트                 | 웹훅으로 쓸 수 있는 기능                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| FILE_UPDATE            | “이 Figma 파일이 최근에 정리(업데이트)됐다” 시점 추적, 마지막 업데이트 시간/활동 로그 |
| FILE_DELETE            | 연결된 파일 삭제 시 알림, 연결 해제/삭제 상태 표시                                    |
| FILE_VERSION_UPDATE    | 디자인 버전 이력 저장·표시, 업무와 버전 매핑                                          |
| LIBRARY_PUBLISH        | 팀 라이브러리 변경(컴포넌트/스타일/변수) 로그, 팀 대시보드용 “디자인 시스템 활동”     |
| FILE_COMMENT           | 파일 댓글/답글 추적, 업무와 연결해 “디자인 피드백” 타임라인, 멘션 알림                |
| DEV_MODE_STATUS_UPDATE | 레이어별 “디자인 완료/개발 대기/개발 완료” 상태 추적, related_links로 업무와 연결     |

이 정리대로면, 지금 구조에서 Figma 웹훅을 쓰면 **파일/버전/댓글/라이브러리/Dev Mode 상태**를 기준으로 한 “Figma 추적 기능”을 구현할 수 있습니다.
