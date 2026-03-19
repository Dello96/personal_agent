# 🚀 Personal Agent

AI 기반 협업 및 업무 관리 서비스

---

## 📌 프로젝트 소개
- 서비스 목적
- 어떤 문제를 해결하려고 했는지

---

## 🏗 아키텍처

(여기 그림 있으면 최고)

- Frontend: Next.js
- Backend: Node.js (Express)
- Infra: AWS ECS Fargate, ALB, ECR
- DB: PostgreSQL → Supabase

---

## 🔥 핵심 기술 결정

### 1. ECS Fargate 선택 이유
- 서버 관리 부담 제거
- 컨테이너 기반 확장성 확보

### 2. ALB 라우팅 구조
- /api, /auth 분리
- 트래픽 분산 처리

---

## 💥 트러블슈팅

### 🚨 RDS 비용 문제

#### 문제
- Aurora db.r6g.2xlarge 사용
- 약 $600 비용 발생

#### 원인
- 과도한 스펙 선택
- 시간 기반 과금 구조 미인지

#### 해결
- Supabase로 전환
- 리소스 구조 재설계

#### 결과
- 비용 95% 절감

---

## ⚡ 성능 / 개선

- API 응답 구조 최적화
- 상태 관리 개선
- 불필요 요청 감소

---

## 🧠 배운 점

- 인프라 설계의 중요성
- 비용 최적화 경험
