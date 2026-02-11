"use server";

export async function getWeatherData(
  latitude: number | undefined,
  longitude: number | undefined
) {
  if (latitude == null || longitude == null) {
    return { ok: false, error: "위치 정보가 없습니다.", data: null };
  }
  const apiKey = process.env.NEXT_PUBLIC_WEATHER_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "날씨 API 키가 설정되지 않았습니다.",
      data: null,
    };
  }
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message ?? `API 오류 (${res.status})`;
      return { ok: false, error: message, data: null };
    }
    return { ok: true, error: null, data };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "날씨를 불러오지 못했습니다.",
      data: null,
    };
  }
}
