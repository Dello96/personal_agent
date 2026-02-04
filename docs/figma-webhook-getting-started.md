# Figma 웹훅 기능 추가 – 시작 가이드

GitHub 웹훅과 같은 패턴으로 Figma 웹훅을 단계별로 추가하는 방법입니다.

---

## 1. 전체 순서 (추천)

| 단계  | 내용                                                                 | 난이도 |
| ----- | -------------------------------------------------------------------- | ------ |
| **1** | 웹훅 **수신**만 구현 (POST /api/figma/webhook → passcode 검증 → 200) | 낮음   |
| **2** | DB 모델 추가 (팀별 Figma 연결, 활동 로그) + 수신 시 활동 저장        | 낮음   |
| **3** | 웹훅 **등록** API (팀에 Figma 연결 시 Figma API로 웹훅 생성)         | 중간   |
| **4** | WebSocket으로 팀에 실시간 알림 (GitHub처럼)                          | 낮음   |
| **5** | 프론트: 팀/업무 화면에 “Figma 활동” 위젯                             | 중간   |
| **6** | (선택) 업무별 Figma 파일 연결 + 파일 단위 웹훅                       | 중간   |

먼저 **1 → 2**까지 하면 “Figma에서 이벤트가 오면 우리 서버가 받아서 DB에 쌓는지”까지 검증할 수 있습니다.

---

## 2. 1단계: 웹훅 수신만 구현

### 2.1 차이점 (GitHub vs Figma)

- **GitHub**: `x-hub-signature-256`으로 **서명 검증** → raw body 필요 → `express.raw()` 사용.
- **Figma**: 페이로드에 **passcode** 문자열 포함 → **일반 JSON body**로 받아서 `req.body.passcode`와 DB에 저장한 값 비교하면 됨. **raw body 불필요.**

그래서 Figma 웹훅 경로는 기존 `express.json()` 그대로 두고, `express.raw()`는 GitHub 전용으로만 유지하면 됩니다.

### 2.2 구현할 것

- 라우트: `POST /api/figma/webhook`
  - `req.body.event_type` (PING, FILE_UPDATE, FILE_COMMENT 등) 확인.
  - PING이면 그대로 `200 OK` 반환.
  - 그 외에는 (2단계에서) `webhook_id`로 연결 정보 찾고 passcode 비교 후 활동 저장.
- **1단계만** 할 때는 passcode 검증 없이 “event_type 로그만 찍고 200”으로 해도 됩니다.

---

## 3. 2단계: DB 모델 + 활동 저장

### 3.1 모델 예시 (팀 단위)

- **FigmaTeamConnection**
  - 팀당 하나 (또는 팀당 여러 개 가능하게 할지 선택).
  - `teamId`, `figmaWebhookId`(Figma가 준 ID), `passcode`, `accessToken`, `context`, `context_id`, `event_type`, `isActive` 등.

- **FigmaActivity**
  - `connectionId`(FK), `event_type`, `file_key`, `file_name`, `message`(요약), 필요 시 `payload`(Json) 등.

웹훅 수신 시 `payload.webhook_id`로 Connection을 찾고, `payload.passcode`와 DB의 `passcode`가 같으면 해당 연결의 활동으로 저장합니다.

---

## 4. 3단계: 웹훅 등록 API

- 팀 설정 화면에서 “Figma 연결” 시:
  - 사용자가 **Figma Personal Access Token**(또는 OAuth 토큰)과 **팀/프로젝트/파일 ID**를 입력.
  - 우리 백엔드에서 `POST https://api.figma.com/v2/webhooks` 호출.
    - Body: `event_type`, `context`, `context_id`, `endpoint`(우리 서버 URL), `passcode`(우리가 생성해 DB에도 저장).
  - Figma가 반환한 `webhook_id`와 우리가 쓴 `passcode`를 DB에 저장.

Figma API 인증: `Authorization: Bearer <access_token>`  
문서: https://developers.figma.com/docs/rest-api/webhooks-endpoints/

---

## 5. 4·5단계: 실시간 + 프론트

- 활동 저장 직후, 해당 팀의 `teamId`로 `chatWSS.broadcastToTeam(teamId, { type: 'figma_activity', data: { ... } })` 호출.
- 프론트는 기존처럼 전역 WebSocket 리스너에서 `figma_activity` 이벤트를 받아, 팀/업무 페이지의 “Figma 활동” 위젯을 갱신.

---

## 6. 로컬 테스트 (ngrok)

- Figma는 **공개 URL**로만 웹훅을 보냅니다.
- 로컬: `ngrok http 8080` → 나온 URL을 `endpoint`로 사용 (예: `https://xxxx.ngrok.io/api/figma/webhook`).
- `.env.local`에 `BACKEND_URL=https://xxxx.ngrok.io` 설정 후 웹훅 등록하면, Figma 이벤트가 로컬 서버로 옵니다.

---

## 7. 체크리스트

- [ ] `POST /api/figma/webhook` 라우트 추가, JSON body로 수신
- [ ] PING일 때 200 반환
- [ ] 그 외 이벤트는 (2단계에서) passcode 검증 후 활동 저장
- [ ] Prisma에 FigmaTeamConnection, FigmaActivity 모델 추가
- [ ] (3단계) Figma API로 웹훅 생성하는 “연결” API
- [ ] (4단계) 활동 저장 후 broadcastToTeam
- [ ] (5단계) 프론트 위젯 – 다음 단계에서 구현

이 가이드와 함께 적용한 구현으로 “웹훅 수신 → DB 저장 → WebSocket 알림”까지 동작합니다.

---

## 8. 구현된 API (현재 코드 기준)

| 메서드 | 경로                    | 설명                                                                                    |
| ------ | ----------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/api/figma/webhook`    | Figma가 호출 (인증 없음). PING → 200, 그 외 passcode 검증 후 활동 저장 + WebSocket 알림 |
| GET    | `/api/figma/connection` | (인증) 팀의 Figma 연결 정보 + 최근 활동 20건                                            |
| POST   | `/api/figma/connection` | (인증, 팀장 이상) accessToken, context, contextId, eventType 으로 웹훅 생성 후 DB 저장  |
| DELETE | `/api/figma/connection` | (인증, 팀장 이상) Figma API에서 웹훅 삭제 후 DB 삭제                                    |

**연결 시 필요한 값**

- `accessToken`: Figma Personal Access Token (scope에 `webhooks:write` 포함)
- `context`: `"team"` \| `"project"` \| `"file"`
- `contextId`: Figma 팀 ID / 프로젝트 ID / 파일 key (URL에서 확인)
- `eventType`: 예) `FILE_UPDATE`, `FILE_COMMENT`, `FILE_VERSION_UPDATE`, `DEV_MODE_STATUS_UPDATE` 등

**로컬 테스트**: `BACKEND_URL`을 ngrok URL로 두고 웹훅을 등록하면 Figma 이벤트가 로컬로 전달됩니다.
