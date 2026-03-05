/**
 * 위·경도 → 지역명 (카카오 로컬 API 역지오코딩).
 * 반드시 서버에서만 호출하세요. (process.env.KAKAO_REST_API_KEY는 서버에서만 존재)
 * 카카오 개발자 콘솔 > 앱 > 앱 키 > "REST API 키" 사용 (JavaScript 키/네이티브 앱 키 아님)
 */
export async function getRegionFromCoords(
  lat: number | undefined,
  lon: number | undefined
): Promise<string> {
  try {
    if (lat == null || lon == null) return "지역 정보 없음";

    const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
    if (!apiKey) {
      return "지역 정보 조회 실패";
    }

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lon}&y=${lat}`,
      {
        method: "GET",
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        console.error(
          "Kakao 401: KAKAO_REST_API_KEY를 확인하세요. 카카오 개발자 콘솔의 'REST API 키'를 사용해야 합니다."
        );
      }
      return "지역 정보 조회 실패";
    }

    const data = (await response.json()) as {
      documents?: Array<{
        address?: {
          region_1depth_name?: string;
          region_2depth_name?: string;
          region_3depth_name?: string;
        };
      }>;
    };

    const address = data.documents?.[0]?.address;

    if (!address) return "지역 정보 없음";

    const parts = [
      address.region_1depth_name,
      address.region_2depth_name,
      address.region_3depth_name,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" ") : "지역 정보 없음";
  } catch (error) {
    console.error(error);
    return "지역 정보 조회 실패";
  }
}
