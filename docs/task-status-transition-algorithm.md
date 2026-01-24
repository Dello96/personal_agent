# 업무 상태 전이 알고리즘 정리

## 📋 개요

업무 상태 전이는 `backend/routes/tasks.js`의 `PUT /api/tasks/:id/status` 엔드포인트에서 처리됩니다.

## 🔄 상태 전이 흐름도

```
PENDING → NOW → REVIEW → ENDING
   ↓         ↓        ↓
CANCELLED  CANCELLED  CANCELLED
   ↓
(변경 불가)

IN_PROGRESS → NOW / COMPLETED / CANCELLED
COMPLETED → REVIEW / ENDING / CANCELLED
```

## 📊 허용된 상태 전이 (validTransitions)

| 현재 상태 | 가능한 다음 상태 |
|---------|----------------|
| **PENDING** | `NOW`, `CANCELLED` |
| **NOW** | `COMPLETED`, `REVIEW`, `CANCELLED` |
| **IN_PROGRESS** | `NOW`, `COMPLETED`, `CANCELLED` |
| **COMPLETED** | `REVIEW`, `ENDING`, `CANCELLED` |
| **REVIEW** | `ENDING`, `NOW`, `CANCELLED` |
| **CANCELLED** | *(변경 불가)* |
| **ENDING** | *(변경 불가)* |

## 🔐 권한 체크 로직

### 1단계: 참여자 권한 확인 (PENDING → NOW 전용)

```javascript
// PENDING → NOW 전이는 담당자 또는 참여자만 가능
if (task.status === "PENDING" && status === "NOW") {
  const isParticipant = task.participants?.some(p => p.userId === userId);
  const isAssignee = task.assigneeId === userId;
  
  if (!isAssignee && !isParticipant) {
    return 403; // 권한 없음
  }
}
```

**권한**: 담당자 또는 참여자

### 2단계: 상태 전이 검증 (`isValidStatusTransition`)

#### 2-1. 기본 전이 규칙 검증
- `validTransitions` 객체에서 현재 상태 → 새 상태 전이가 허용되는지 확인

#### 2-2. 특수 권한 체크 (함수 내부)

**REVIEW 상태로 변경 시:**
```javascript
if (newStatus === "REVIEW") {
  // 담당자가 자신의 업무를 REVIEW로 변경 → 허용
  if (taskAssigneeId === userId) {
    // 권한 체크 건너뛰기
  } else {
    // 담당자가 아닌 경우 → 팀장 이상만 가능
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(userRole)) {
      return false;
    }
  }
}
```

**권한**:
- 담당자: 자신의 업무를 REVIEW로 변경 가능
- 팀장 이상: 다른 사람의 업무도 REVIEW로 변경 가능

**ENDING 상태로 변경 시:**
```javascript
if (newStatus === "ENDING") {
  // 항상 팀장 이상만 가능 (담당자 예외 없음)
  if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(userRole)) {
    return false;
  }
}
```

**권한**: 팀장 이상만 가능 (TEAM_LEAD, MANAGER, DIRECTOR)

### 3단계: 추가 권한 검증 (엔드포인트 레벨)

#### REVIEW 상태 변경
```javascript
if (status === "REVIEW") {
  // 담당자가 자신의 업무 → 허용
  if (task.assigneeId !== userId) {
    // 담당자가 아닌 경우 → 팀장 이상 필요
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return 403;
    }
  }
}
```

#### ENDING 상태 변경
```javascript
if (status === "ENDING") {
  // 항상 팀장 이상만 가능
  if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
    return 403;
  }
}
```

#### CANCELLED 상태 변경
```javascript
if (status === "CANCELLED") {
  // 항상 팀장 이상만 가능
  if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
    return 403;
  }
}
```

**권한**: 팀장 이상만 가능 (TEAM_LEAD, MANAGER, DIRECTOR)

## 🎯 상태별 권한 요약

| 상태 전이 | 권한 요구사항 |
|---------|-------------|
| **PENDING → NOW** | 담당자 또는 참여자 |
| **NOW → REVIEW** | 담당자 (자신의 업무) 또는 팀장 이상 |
| **NOW → COMPLETED** | 담당자 또는 참여자 |
| **COMPLETED → REVIEW** | 담당자 (자신의 업무) 또는 팀장 이상 |
| **REVIEW → ENDING** | 팀장 이상만 |
| **REVIEW → NOW** | 팀장 이상만 (반려) |
| **→ CANCELLED** | 팀장 이상만 |
| **→ ENDING** | 팀장 이상만 |

## 🔄 상태 변경 프로세스

### 1. 업무 조회
- 업무 정보 + 참여자 정보 조회

### 2. 참여자 권한 확인 (PENDING → NOW만)
- 담당자 또는 참여자인지 확인

### 3. 상태 전이 검증
- `isValidStatusTransition()` 함수 호출
- 기본 전이 규칙 + 특수 권한 체크

### 4. 추가 권한 검증
- REVIEW, ENDING, CANCELLED 상태 변경 시 권한 재확인

### 5. 트랜잭션 실행
```javascript
prisma.$transaction(async (tx) => {
  // 1. Task 상태 업데이트
  const updatedTask = await tx.task.update({ ... });
  
  // 2. PENDING → NOW 전이 시 참여자 startedAt 업데이트
  if (task.status === "PENDING" && status === "NOW") {
    // 참여자의 업무 시작 시간 기록
    await tx.taskParticipant.update({
      where: { id: participant.id },
      data: { startedAt: new Date() }
    });
  }
  
  // 3. 상태 이력 저장 (TaskStatusHistory)
  await tx.taskStatusHistory.create({
    data: {
      taskId: id,
      status: status,
      changedBy: userId,
      comment: comment || null
    }
  });
  
  // 4. 최종 Task 정보 조회 (참여자 정보 포함)
  return await tx.task.findUnique({ ... });
});
```

## 📝 특수 케이스

### 1. PENDING → NOW 전이 시
- 참여자의 `startedAt` 필드가 자동으로 업데이트됨
- 담당자 또는 참여자 모두 가능

### 2. COMPLETED 상태일 때
- `completedAt` 필드가 자동으로 설정됨 (처음 COMPLETED로 변경될 때만)

### 3. CANCELLED / ENDING 상태
- 최종 상태로, 더 이상 변경 불가

### 4. REVIEW 상태
- 담당자가 자신의 업무를 REVIEW로 변경 가능 (리뷰 요청)
- 팀장 이상이 다른 사람의 업무를 REVIEW로 변경 가능
- REVIEW → ENDING: 승인 (팀장 이상만)
- REVIEW → NOW: 반려 (팀장 이상만)

## 🚫 차단되는 전이

1. **CANCELLED → 다른 상태**: 불가능 (최종 상태)
2. **ENDING → 다른 상태**: 불가능 (최종 상태)
3. **허용되지 않은 전이**: `validTransitions`에 없는 전이 시도 시 차단
4. **권한 부족**: 권한이 없는 사용자의 상태 변경 시도 시 차단

## 🔍 에러 응답

| 상황 | HTTP 상태 코드 | 에러 메시지 |
|-----|--------------|-----------|
| 업무 없음 | 404 | "업무를 찾을 수 없습니다." |
| 유효하지 않은 전이 | 400 | "유효하지 않은 상태 전이입니다." |
| 권한 없음 (PENDING → NOW) | 403 | "권한이 없습니다. 담당자 또는 참여자만 업무를 시작할 수 있습니다." |
| 권한 없음 (REVIEW) | 403 | "리뷰 권한이 없습니다." |
| 권한 없음 (ENDING) | 403 | "종료 권한이 없습니다." |
| 권한 없음 (CANCELLED) | 403 | "취소 권한이 없습니다. 팀장급 이상만 업무를 취소할 수 있습니다." |
| 서버 오류 | 500 | "서버 오류" |

## 📌 참고사항

- 모든 상태 변경은 `TaskStatusHistory`에 기록됨
- 상태 변경 시 `comment` 필드를 통해 변경 사유를 기록할 수 있음
- 트랜잭션으로 처리되어 원자성 보장
- 참여자 정보는 상태 변경 시 자동으로 업데이트됨 (PENDING → NOW)
