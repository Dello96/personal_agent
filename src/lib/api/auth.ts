const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

//타입정의
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: "INTERN" | "STAFF" | "ASSOCIATE" | "ASSISTANT_MANAGER" | "TEAM_LEAD";
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    picture?: string;
    teamName?: string;
  };
}

//회원가입
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "회원가입에 실패했습니다.");
  }

  return result;
}

//회원가입 후 로그인
export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "로그인에 실패했습니다.");
  }

  return result;
}

//이메일 중복확인
export async function checkEmail(
  email: string
): Promise<{ available: boolean }> {
  const response = await fetch(
    `${API_URL}/api/auth/check-email?email=${encodeURIComponent(email)}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "이메일 확인에 실패했습니다.");
  }

  return result;
}
