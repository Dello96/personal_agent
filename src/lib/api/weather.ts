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

type KmaObservationItem = {
  category: string;
  obsrValue?: string;
};

type KmaForecastItem = {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
};

/** 현재 시각을 KST 기준으로 반환 (UTC getter와 함께 사용) */
function getKstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** KST Date(shifted) -> YYYYMMDD */
function formatKstYmd(kst: Date): string {
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** 초단기실황용 base_date/base_time: 데이터 지연 고려해 1시간 전 정시 */
function getUltraSrtBaseDateTime(nowKst: Date): {
  baseDate: string;
  baseTime: string;
} {
  const target = new Date(nowKst.getTime() - 60 * 60 * 1000);
  const h = target.getUTCHours();
  return {
    baseDate: formatKstYmd(target),
    baseTime: `${String(h).padStart(2, "0")}00`,
  };
}

/** 단기예보용 base_date/base_time: 이미 발표된 가장 최근 시각(새벽은 전일 2300) */
function getVilageBaseDateTime(nowKst: Date): {
  baseDate: string;
  baseTime: string;
} {
  const h = nowKst.getUTCHours();
  const min = nowKst.getUTCMinutes();
  const currentHHMM = h * 100 + min;
  const past = VILAGE_BASE_TIMES.filter((t) => parseInt(t, 10) <= currentHHMM);
  if (past.length > 0) {
    return {
      baseDate: formatKstYmd(nowKst),
      baseTime: past[past.length - 1],
    };
  }

  const yesterdayKst = new Date(nowKst.getTime() - 24 * 60 * 60 * 1000);
  return {
    baseDate: formatKstYmd(yesterdayKst),
    baseTime: "2300",
  };
}

/** "YYYYMMDD"+"HHMM" 형태를 숫자 키로 변환 */
function toDateTimeKey(date: string, time: string): number {
  return Number(`${date}${time}`);
}

/** 현재 시각 기준 가장 가까운 예보 슬롯 선택(미래 우선, 없으면 가장 최신 과거) */
function pickForecastSlot(
  list: KmaForecastItem[],
  nowKst: Date
): { fcstDate: string; fcstTime: string } | null {
  const seen = new Set<string>();
  const slots = list
    .map((i) => ({ fcstDate: i.fcstDate, fcstTime: i.fcstTime }))
    .filter((s) => {
      const key = `${s.fcstDate}-${s.fcstTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (slots.length === 0) return null;

  const nowKey = toDateTimeKey(
    formatKstYmd(nowKst),
    `${String(nowKst.getUTCHours()).padStart(2, "0")}${String(
      nowKst.getUTCMinutes()
    ).padStart(2, "0")}`
  );

  let future: { fcstDate: string; fcstTime: string } | null = null;
  let futureKey = Number.POSITIVE_INFINITY;
  let latestPast: { fcstDate: string; fcstTime: string } | null = null;
  let latestPastKey = Number.NEGATIVE_INFINITY;

  for (const slot of slots) {
    const key = toDateTimeKey(slot.fcstDate, slot.fcstTime);
    if (key >= nowKey && key < futureKey) {
      future = slot;
      futureKey = key;
    }
    if (key <= nowKey && key > latestPastKey) {
      latestPast = slot;
      latestPastKey = key;
    }
  }

  return future ?? latestPast ?? slots[0];
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
    const nowKst = getKstNow();
    const grid = dfsXYConv("toXY", latitude, longitude);
    if ("lat" in grid) {
      return { ok: false, error: "격자 변환 실패", data: null };
    }
    const nx = grid.x;
    const ny = grid.y;
    const ultraBase = getUltraSrtBaseDateTime(nowKst);
    const vilageBase = getVilageBaseDateTime(nowKst);
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
    // Encoding 키(% 포함)는 그대로, Decoding 키(+,/ 등)는 URL 인코딩 후 사용
    const rawKey = apiKey.trim();
    const serviceKey = rawKey.includes("%")
      ? rawKey
      : encodeURIComponent(rawKey);
    const commonParams = {
      pageNo: 1,
      numOfRows: 1000,
      dataType: "JSON",
      nx,
      ny,
    };

    // 1) 초단기실황: 현재 기온(T1H)
    const ultraUrl = buildKmaUrl("/getUltraSrtNcst", serviceKey, {
      ...commonParams,
      base_date: ultraBase.baseDate,
      base_time: ultraBase.baseTime,
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
    const resultMsg = ultraJson?.response?.header?.resultMsg ?? "기상청 API 오류";
    if (resultCode && resultCode !== "00") {
      // NO_DATA 인 경우에는 현재 기온(T1H)이 없을 뿐이므로,
      // 다른 예보 데이터는 그대로 사용하고 temp만 null로 두고 계속 진행한다.
      if (!resultMsg.includes("NO_DATA")) {
        return { ok: false, error: resultMsg, data: null };
      }
    }
    const ultraItem = ultraJson?.response?.body?.items?.item;
    const ultraList: KmaObservationItem[] = Array.isArray(ultraItem)
      ? ultraItem
      : ultraItem
        ? [ultraItem]
        : [];

    const t1h = ultraList.find(
      (i) => i.category === "T1H"
    );
    const temp = t1h ? Number(t1h.obsrValue) : null;

    // 2) 단기예보: 하늘상태(SKY), 습도(REH), 강수형태(PTY) - 같은 격자, 가장 최근 base_time
    const vilageUrl = buildKmaUrl("/getVilageFcst", serviceKey, {
      ...commonParams,
      base_date: vilageBase.baseDate,
      base_time: vilageBase.baseTime,
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
    const vilageList: KmaForecastItem[] = Array.isArray(vilageItem)
      ? vilageItem
      : vilageItem
        ? [vilageItem]
        : [];

    const slot = pickForecastSlot(vilageList, nowKst);
    if (!slot) {
      return { ok: false, error: "예보 데이터가 없습니다.", data: null };
    }

    const skyItem = vilageList.find(
      (i) =>
        i.category === "SKY" &&
        i.fcstDate === slot.fcstDate &&
        i.fcstTime === slot.fcstTime
    );
    const rehItem = vilageList.find(
      (i) =>
        i.category === "REH" &&
        i.fcstDate === slot.fcstDate &&
        i.fcstTime === slot.fcstTime
    );
    const ptyItem = vilageList.find(
      (i) =>
        i.category === "PTY" &&
        i.fcstDate === slot.fcstDate &&
        i.fcstTime === slot.fcstTime
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
