// upload.ts - 이미지 업로드 API 함수
import { apiRequest } from "./users";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * 단일 이미지 업로드
 * @param file - 업로드할 이미지 파일
 * @param taskId - 업무 ID (선택사항)
 * @returns 업로드된 이미지의 S3 URL
 */
export const uploadImage = async (
  file: File,
  taskId?: string
): Promise<string> => {
  try {
    // 1. FormData 생성
    const formData = new FormData();
    formData.append("image", file);

    // 2. 쿼리 파라미터 추가 (taskId가 있는 경우)
    const url = taskId
      ? `${API_URL}/api/upload?taskId=${taskId}`
      : `${API_URL}/api/upload`;

    // 3. 파일 업로드 요청
    const response = await fetch(url, {
      method: "POST",
      headers: {
        // FormData 사용 시 Content-Type 헤더를 설정하지 않음 (브라우저가 자동 설정)
        Authorization: `Bearer ${getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "이미지 업로드에 실패했습니다.");
    }

    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error("이미지 업로드 오류:", error);
    throw error;
  }
};

/**
 * 여러 이미지 일괄 업로드
 * @param files - 업로드할 이미지 파일 배열
 * @param taskId - 업무 ID (선택사항)
 * @returns 업로드된 이미지들의 S3 URL 배열
 */
export const uploadMultipleImages = async (
  files: File[],
  taskId?: string
): Promise<string[]> => {
  try {
    // 1. FormData 생성
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    // 2. 쿼리 파라미터 추가
    const url = taskId
      ? `${API_URL}/api/upload/multiple?taskId=${taskId}`
      : `${API_URL}/api/upload/multiple`;

    // 3. 파일 업로드 요청
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "이미지 업로드에 실패했습니다.");
    }

    const data = await response.json();
    return data.imageUrls;
  } catch (error) {
    console.error("다중 이미지 업로드 오류:", error);
    throw error;
  }
};

// 토큰 가져오기 헬퍼 함수
const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const authStore = require("@/app/stores/authStore").useAuthStore.getState();
  return authStore.token;
};
