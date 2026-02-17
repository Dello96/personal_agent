"use server";

import dfsXYConv from "../utils/locationConv";
import { getRegionFromCoords } from "../utils/kakaoReverseGeocode";

const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

/** 단기예보 base_time (HHMM): 02, 05, 08, 11, 14, 17, 20, 23시 */
const VILAGE_BASE_TIMES = [
  "0200",
  "0500",
  "0800",
  "1100",
  "1400",
  "1700",
  "2000",
  "2300",
];

/** 한국 시간 기준 오늘 YYYYMMDD */
function getKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** 초단기실황용 base_time: 매시 정시, 데이터 지연 고려해 1시간 전 사용 */
function getUltraSrtBaseTime(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const prevHour = h - 1 < 0 ? 23 : h - 1;
  return `${String(prevHour).padStart(2, "0")}00`;
}

/** 단기예보용 base_time: 이미 발표된 가장 최근 시각 (3시간 간격) */
function getVilageBaseTime(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const h = kst.getUTCHours();
  const currentHHMM = h * 100;
  const past = VILAGE_BASE_TIMES.filter((t) => parseInt(t, 10) <= currentHHMM);
  return past.length > 0 ? past[past.length - 1] : "2300";
}

/** serviceKey는 이미 인코딩 여부가 반영된 값이므로 쿼리에서 한 번만 넣음(이중 인코딩 방지) */
function buildKmaUrl(
  path: string,
  serviceKey: string,
  params: Record<string, string | number>
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => search.set(k, String(v)));
  return `${KMA_BASE}${path}?serviceKey=${serviceKey}&${search.toString()}`;
}

/** SKY 코드 → 하늘 상태 문구 */
function skyToDescription(sky: string): string {
  const map: Record<string, string> = {
    "1": "맑음",
    "2": "구름조금",
    "3": "구름많음",
    "4": "흐림",
  };
  return map[sky] ?? "알 수 없음";
}

/** PTY 코드 → 강수 형태 (설명에 반영) */
function ptyToDescription(pty: string): string {
  const map: Record<string, string> = {
    "0": "",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
  };
  return map[pty] ?? "";
}

/** 위·경도 → 지역명 (역지오코딩, Nominatim) */
async function getLocationName(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "ko");
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "WeatherApp/1.0 (contact@example.com)",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return "현재 위치";
    const data = (await res.json()) as {
      address?: {
        suburb?: string;
        village?: string;
        town?: string;
        city?: string;
        state?: string;
        country?: string;
      };
      display_name?: string;
    };
    const addr = data?.address;
    if (addr) {
      const parts = [
        addr.suburb ?? addr.village ?? addr.town,
        addr.city ?? addr.state,
        addr.country,
      ].filter(Boolean) as string[];
      if (parts.length > 0) return parts.slice(0, 2).join(", ");
    }
    if (data?.display_name) {
      const parts = data.display_name.split(",").map((s: string) => s.trim());
      return parts.slice(0, 2).join(", ") || "현재 위치";
    }
  } catch {
    // ignore
  }
  return "현재 위치";
}

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
    const grid = dfsXYConv("toXY", latitude, longitude);
    if ("lat" in grid) {
      return { ok: false, error: "격자 변환 실패", data: null };
    }
    const nx = grid.x;
    const ny = grid.y;
    const baseDate = getKstDate();
    const namePromise = (async () => {
      const kakaoName = await getRegionFromCoords(latitude, longitude);
      if (
        kakaoName &&
        kakaoName !== "지역 정보 없음" &&
        kakaoName !== "지역 정보 조회 실패"
      ) {
        return kakaoName;
      }
      return getLocationName(latitude, longitude);
    })();
    const ultraBaseTime = getUltraSrtBaseTime();
    const vilageBaseTime = getVilageBaseTime();

    // Encoding 키(% 포함)는 그대로, Decoding 키(+,/ 등)는 URL 인코딩 후 사용
    const rawKey = apiKey.trim();
    const serviceKey = rawKey.includes("%")
      ? rawKey
      : encodeURIComponent(rawKey);
    const commonParams = {
      pageNo: 1,
      numOfRows: 1000,
      dataType: "JSON",
      base_date: baseDate,
      nx,
      ny,
    };

    // 1) 초단기실황: 현재 기온(T1H)
    const ultraUrl = buildKmaUrl("/getUltraSrtNcst", serviceKey, {
      ...commonParams,
      base_time: ultraBaseTime,
    });
    const ultraRes = await fetch(ultraUrl, { next: { revalidate: 600 } });
    const ultraText = await ultraRes.text();
    if (!ultraRes.ok) {
      const msg =
        ultraText.includes("Unauthorized") || ultraRes.status === 401
          ? "인증키가 올바르지 않습니다. 공공데이터포털 → 마이페이지 → 기상청_단기예보 활용신청 후 발급된 '일반인증키(Encoding)'을 .env.local의 NEXT_PUBLIC_WEATHER_KEY에 넣어 주세요. Decoding 키를 쓰는 경우 복사 시 공백/줄바꿈이 들어가지 않도록 확인하세요."
          : ultraText.slice(0, 100) || `API 오류 (${ultraRes.status})`;
      return { ok: false, error: msg, data: null };
    }
    let ultraJson: {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: { items?: { item?: unknown } };
      };
    };
    try {
      ultraJson = JSON.parse(ultraText);
    } catch {
      return { ok: false, error: "기상청 API 응답 형식 오류", data: null };
    }
    const resultCode = ultraJson?.response?.header?.resultCode;
    if (resultCode && resultCode !== "00") {
      const msg = ultraJson?.response?.header?.resultMsg ?? "기상청 API 오류";
      return { ok: false, error: msg, data: null };
    }
    const ultraItem = ultraJson?.response?.body?.items?.item;
    const ultraList = Array.isArray(ultraItem)
      ? ultraItem
      : ultraItem
        ? [ultraItem]
        : [];

    const t1h = ultraList.find(
      (i: { category: string }) => i.category === "T1H"
    );
    const temp = t1h ? Number(t1h.obsrValue) : null;

    // 2) 단기예보: 하늘상태(SKY), 습도(REH), 강수형태(PTY) - 같은 격자, 가장 최근 base_time
    const vilageUrl = buildKmaUrl("/getVilageFcst", serviceKey, {
      ...commonParams,
      base_time: vilageBaseTime,
    });
    const vilageRes = await fetch(vilageUrl, { next: { revalidate: 600 } });
    const vilageText = await vilageRes.text();
    if (!vilageRes.ok) {
      const msg =
        vilageText.includes("Unauthorized") || vilageRes.status === 401
          ? "인증키가 올바르지 않습니다. 공공데이터포털 → 마이페이지 → 기상청_단기예보 활용신청 후 발급된 '일반인증키(Encoding)'을 .env.local의 NEXT_PUBLIC_WEATHER_KEY에 넣어 주세요. Decoding 키를 쓰는 경우 복사 시 공백/줄바꿈이 들어가지 않도록 확인하세요."
          : vilageText.slice(0, 100) || `API 오류 (${vilageRes.status})`;
      return { ok: false, error: msg, data: null };
    }
    let vilageJson: { response?: { body?: { items?: { item?: unknown } } } };
    try {
      vilageJson = JSON.parse(vilageText);
    } catch {
      return { ok: false, error: "기상청 API 응답 형식 오류", data: null };
    }
    const vilageItem = vilageJson?.response?.body?.items?.item;
    const vilageList = Array.isArray(vilageItem)
      ? vilageItem
      : vilageItem
        ? [vilageItem]
        : [];

    const fcstDate = baseDate;
    const skyItem = vilageList.find(
      (i: { category: string; fcstDate: string }) =>
        i.category === "SKY" && i.fcstDate === fcstDate
    );
    const rehItem = vilageList.find(
      (i: { category: string; fcstDate: string }) =>
        i.category === "REH" && i.fcstDate === fcstDate
    );
    const ptyItem = vilageList.find(
      (i: { category: string; fcstDate: string }) =>
        i.category === "PTY" && i.fcstDate === fcstDate
    );

    const sky = skyItem?.fcstValue ?? "1";
    const reh = rehItem ? Number(rehItem.fcstValue) : 0;
    const pty = ptyItem?.fcstValue ?? "0";

    let description = skyToDescription(sky);
    const ptyDesc = ptyToDescription(pty);
    if (ptyDesc) description = ptyDesc;

    const name = await namePromise;
    const data = {
      name,
      coords: { latitude, longitude },
      main: {
        temp: temp ?? 0,
        feels_like: temp ?? 0,
        humidity: reh,
      },
      weather: [{ description, main: sky }],
    };
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
