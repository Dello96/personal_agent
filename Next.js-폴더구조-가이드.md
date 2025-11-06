# Next.js 폴더 구조 및 파일명 가이드

> 가장 널리 사용되는 Next.js 프로젝트 구조 모범 사례

## 📁 권장 폴더 구조

```
src/
├── app/                          # App Router (Next.js 13+)
│   ├── (auth)/                   # Route Groups - 레이아웃 공유
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (main)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx       # 로딩 UI
│   │   │   └── error.tsx         # 에러 UI
│   │   └── profile/
│   │       └── page.tsx
│   ├── api/                      # API Routes
│   │   ├── users/
│   │   │   └── route.ts
│   │   └── posts/
│   │       └── [id]/
│   │           └── route.ts
│   ├── layout.tsx                # Root Layout
│   ├── page.tsx                  # Home Page
│   ├── not-found.tsx             # 404 Page
│   └── error.tsx                 # Global Error
│
├── components/                   # React 컴포넌트
│   ├── ui/                       # 재사용 가능한 UI 컴포넌트
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   ├── features/                 # 기능별 컴포넌트
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   └── dashboard/
│   │       └── DashboardWidget.tsx
│   └── shared/                   # 공유 컴포넌트
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── Sidebar.tsx
│
├── lib/                          # 유틸리티 함수
│   ├── utils.ts
│   ├── api.ts
│   └── constants.ts
│
├── hooks/                        # Custom React Hooks
│   ├── useAuth.ts
│   └── useLocalStorage.ts
│
├── types/                        # TypeScript 타입 정의
│   ├── index.ts
│   ├── user.ts
│   └── api.ts
│
├── styles/                       # 전역 스타일
│   └── globals.css
│
├── config/                       # 설정 파일
│   ├── site.ts
│   └── env.ts
│
└── services/                     # API 서비스 레이어
    ├── userService.ts
    └── postService.ts

public/                           # 정적 파일
├── images/
├── icons/
└── fonts/
```

---

## 📝 파일명 컨벤션

### 1. 컴포넌트 파일
- **PascalCase** 사용
- 예시: `UserProfile.tsx`, `LoginForm.tsx`, `DashboardWidget.tsx`
- 컴포넌트명과 파일명 일치시키기

```typescript
// ✅ Good
// UserProfile.tsx
export function UserProfile() {
  return <div>...</div>
}

// ❌ Bad
// user-profile.tsx
export function UserProfile() {
  return <div>...</div>
}
```

### 2. 유틸리티 & 함수
- **camelCase** 사용
- 예시: `formatDate.ts`, `apiClient.ts`, `validateEmail.ts`

```typescript
// ✅ Good
// formatDate.ts
export function formatDate(date: Date) {
  return date.toLocaleDateString()
}

// ❌ Bad
// FormatDate.ts or format-date.ts
```

### 3. Next.js 특수 파일
- **lowercase** 사용
- 예시: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`

```
app/
├── page.tsx          # 페이지 컴포넌트
├── layout.tsx        # 레이아웃
├── loading.tsx       # 로딩 상태
├── error.tsx         # 에러 처리
└── not-found.tsx     # 404 페이지
```

### 4. 라우트 폴더
- **kebab-case** 사용
- 예시: `user-profile/`, `blog-posts/`, `product-details/`
- 동적 라우트: `[id]/`, `[slug]/`, `[...params]/`
- 선택적 동적 라우트: `[[...slug]]/`

```
app/
├── user-profile/              # kebab-case
├── blog-posts/
│   └── [slug]/                # 동적 라우트
│       └── page.tsx
└── docs/
    └── [[...slug]]/           # 선택적 catch-all
        └── page.tsx
```

---

## 🎯 주요 설계 원칙

### 1. Colocation (공동 배치)

관련된 파일들을 가까이 배치하여 응집도를 높입니다.

```
app/
└── dashboard/
    ├── page.tsx
    ├── _components/          # 언더스코어로 시작 (라우트에서 제외)
    │   ├── Chart.tsx
    │   ├── Stats.tsx
    │   └── UserTable.tsx
    └── _lib/
        └── utils.ts
```

**장점:**
- 코드 탐색이 쉬워짐
- 관련 파일들을 한눈에 파악
- 삭제/이동 시 관련 파일들을 함께 처리 가능

### 2. Route Groups

URL에 영향을 주지 않고 라우트를 그룹화합니다.

```
app/
├── (marketing)/              # 마케팅 레이아웃
│   ├── layout.tsx           # 마케팅 전용 레이아웃
│   ├── about/
│   │   └── page.tsx         # /about
│   └── contact/
│       └── page.tsx         # /contact
│
└── (shop)/                   # 쇼핑 레이아웃
    ├── layout.tsx           # 쇼핑 전용 레이아웃
    ├── products/
    │   └── page.tsx         # /products
    └── cart/
        └── page.tsx         # /cart
```

**사용 사례:**
- 다른 레이아웃 적용
- 관련 라우트 그룹화
- 코드 조직화

### 3. Private Folders

`_`로 시작하는 폴더는 라우팅 시스템에서 제외됩니다.

```
app/
├── dashboard/
│   ├── page.tsx              # 라우트: /dashboard
│   ├── _components/          # 라우트 제외
│   │   └── Widget.tsx
│   └── _lib/                 # 라우트 제외
│       └── helpers.ts
```

**언제 사용?**
- 내부 컴포넌트
- 유틸리티 함수
- 테스트 파일
- 라우트로 노출되지 않아야 하는 파일

---

## 💡 추가 권장사항

### 1. 절대 경로 임포트 설정

`tsconfig.json` 파일에 다음을 추가:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"],
      "@/services/*": ["./src/services/*"]
    }
  }
}
```

**사용 예시:**

```typescript
// ❌ Bad - 상대 경로
import { Button } from '../../../components/ui/button'
import { formatDate } from '../../../lib/utils'

// ✅ Good - 절대 경로
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
```

### 2. 배럴 파일 (index.ts) 활용

여러 export를 하나의 진입점으로 통합:

```typescript
// components/ui/index.ts
export { Button } from './button'
export { Card } from './card'
export { Input } from './input'
export { Modal } from './modal'

// 사용
import { Button, Card, Input } from '@/components/ui'
```

**주의사항:**
- 과도한 사용은 번들 크기 증가
- Tree-shaking이 어려워질 수 있음
- 필요한 곳에만 선택적 사용

### 3. 타입 정의 분리

도메인별로 타입을 구조화:

```typescript
// types/user.ts
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export type UserRole = 'admin' | 'user' | 'guest'

// types/api.ts
export interface ApiResponse<T> {
  data: T
  error?: string
  status: number
}

// types/index.ts
export * from './user'
export * from './api'
export * from './post'
```

### 4. 환경 변수 관리

```typescript
// config/env.ts
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  apiKey: process.env.API_KEY || '',
  isDev: process.env.NODE_ENV === 'development',
} as const

// 사용
import { env } from '@/config/env'
console.log(env.apiUrl)
```

### 5. 서비스 레이어 분리

API 호출 로직을 분리하여 재사용성 향상:

```typescript
// services/userService.ts
import { User } from '@/types'

export const userService = {
  async getUser(id: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return res.json()
  },
}
```

---

## 📦 폴더별 상세 설명

### `app/` - 애플리케이션 라우팅
Next.js 13+ App Router의 핵심 디렉토리

**주요 특수 파일:**
- `layout.tsx`: 레이아웃 정의
- `page.tsx`: 페이지 컴포넌트
- `loading.tsx`: 로딩 UI (Suspense)
- `error.tsx`: 에러 바운더리
- `not-found.tsx`: 404 페이지
- `route.ts`: API 라우트
- `template.tsx`: 재렌더링되는 레이아웃

### `components/` - UI 컴포넌트
재사용 가능한 컴포넌트 저장

**하위 구조:**
- `ui/`: 기본 UI 컴포넌트 (버튼, 입력, 카드 등)
- `features/`: 기능별 복합 컴포넌트
- `shared/`: 전역 공유 컴포넌트 (헤더, 푸터 등)

### `lib/` - 유틸리티
순수 함수와 헬퍼

**예시:**
- `utils.ts`: 범용 유틸리티
- `api.ts`: API 클라이언트
- `constants.ts`: 상수 정의
- `validators.ts`: 유효성 검사

### `hooks/` - Custom Hooks
재사용 가능한 React 훅

**예시:**
```typescript
// hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState(null)
  // 인증 로직
  return { user, login, logout }
}
```

### `types/` - TypeScript 타입
타입과 인터페이스 정의

**조직화:**
- 도메인별로 분리
- `index.ts`로 통합 export

### `services/` - API 서비스
백엔드 통신 로직

**패턴:**
```typescript
export const xxxService = {
  getAll: () => {},
  getById: (id) => {},
  create: (data) => {},
  update: (id, data) => {},
  delete: (id) => {},
}
```

---

## 🔧 실전 예시

### 소규모 프로젝트

```
src/
├── app/
│   ├── page.tsx
│   └── about/
│       └── page.tsx
├── components/
│   ├── Header.tsx
│   └── Footer.tsx
└── lib/
    └── utils.ts
```

### 중규모 프로젝트

```
src/
├── app/
│   ├── (marketing)/
│   ├── (app)/
│   └── api/
├── components/
│   ├── ui/
│   └── features/
├── lib/
├── hooks/
└── types/
```

### 대규모 프로젝트

```
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── (admin)/
│   └── api/
├── components/
│   ├── ui/
│   ├── features/
│   └── shared/
├── lib/
├── hooks/
├── types/
├── services/
├── config/
├── styles/
└── utils/
```

---

## ✅ 체크리스트

프로젝트 구조 설정 시 확인사항:

- [ ] `tsconfig.json`에 절대 경로 설정
- [ ] 컴포넌트는 PascalCase 사용
- [ ] 유틸리티는 camelCase 사용
- [ ] Next.js 특수 파일은 lowercase 사용
- [ ] 라우트 폴더는 kebab-case 사용
- [ ] Route Groups로 레이아웃 분리
- [ ] Private folders로 내부 파일 숨김
- [ ] 타입 정의 분리
- [ ] 환경 변수 중앙 관리
- [ ] API 로직은 서비스 레이어로 분리

---

## 📚 참고 자료

- [Next.js 공식 문서 - Project Structure](https://nextjs.org/docs/getting-started/project-structure)
- [Next.js 공식 문서 - Routing](https://nextjs.org/docs/app/building-your-application/routing)
- [TypeScript 공식 문서 - Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)

---

## 🎓 결론

이 구조는 다음을 목표로 합니다:

1. **확장성**: 프로젝트가 커져도 관리 가능
2. **유지보수성**: 코드를 쉽게 찾고 수정 가능
3. **개발자 경험**: 직관적이고 일관된 구조
4. **팀 협업**: 공통된 컨벤션으로 협업 효율화

프로젝트 규모와 팀의 필요에 따라 유연하게 조정하여 사용하세요!

---

**문서 버전**: 1.0
**최종 업데이트**: 2025년 11월
**대상**: Next.js 13+ (App Router)