import { useEffect, useState } from "react";
import Image from "next/image";
import cloudy from "../../../../../public/images/cloud.jpg";
import { getWeatherData } from "@/lib/api/weather";

export interface Latlng {
  latitude: number;
  longitude: number;
}

interface WeatherResult {
  ok: boolean;
  error: string | null;
  data: {
    name?: string;
    main?: { temp: number; feels_like: number; humidity: number };
    weather?: Array<{ description: string; main: string }>;
    /** 현재 요청에 사용한 위치(위·경도) */
    coords?: { latitude: number; longitude: number };
  } | null;
}

const WEATHER_REFRESH_MS = 10 * 60 * 1000; // 10분

export default function Weather() {
  const [location, setLocation] = useState<Latlng | undefined>(undefined);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const currentDateTime = new Date();
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(currentDateTime);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const hour = Number(hourStr);
  const isDaytime = hour >= 6 && hour < 18; // KST 기준 아침 6시 ~ 오후 6시 전까지
  // 낮/밤 이미지를 아직 준비하지 않은 경우, 임시로 동일 이미지 사용
  const bgImage = cloudy;

  const fetchLocation = () => {
    setLocationError(null);
    setLocation(undefined);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (response) => {
        const { latitude, longitude } = response.coords;
        setLocation({ latitude, longitude });
      },
      (error: GeolocationPositionError) => {
        setLocationError(
          error.code === 1
            ? "위치 권한이 거부되었습니다."
            : "위치를 가져올 수 없습니다."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 마운트 시 위치 한 번 조회 (캐시 없이 최신 위치 사용)
  useEffect(() => {
    fetchLocation();
  }, []);

  // 위치가 잡히면 자동으로 날씨 조회 + 주기적 갱신
  useEffect(() => {
    if (location?.latitude == null || location?.longitude == null) {
      if (!location && !locationError) return;
      setLoading(false);
      return;
    }

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const res = await getWeatherData(location.latitude, location.longitude);
        console.log("[Weather] response from getWeatherData", res);
        if (res.ok && res.data) {
          setResult(res);
          setWeatherError(null);
        } else if (res.error) {
          const msg = res.error.includes("NO_DATA")
            ? "현재 시각의 기상청 데이터가 아직 없습니다. 잠시 후 다시 시도해 주세요."
            : res.error;
          setWeatherError(msg);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();

    const interval = setInterval(fetchWeather, WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [location?.latitude, location?.longitude]);

  return (
    <div>
      {loading && !result?.data && (
        <p className="mt-2 text-gray-400 text-sm">위치·날씨 불러오는 중...</p>
      )}
      {locationError && (
        <p className="mt-2 text-red-500 text-sm">{locationError}</p>
      )}
      {weatherError && !loading && (
        <p className="mt-2 text-red-500 text-sm">{weatherError}</p>
      )}
      {result?.data && (
        <div className="relative mt-2 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/80 via-sky-600/80 to-slate-900/90 text-white shadow-lg">
          <div className="absolute inset-0 opacity-25">
            <Image
              src={bgImage}
              alt={isDaytime ? "Daytime sky" : "Night sky"}
              fill
              className="object-cover"
              priority
            />
          </div>

          <div className="relative p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-100/80">
                  {result.data.name ?? "현재 위치"}
                </p>
                <p className="text-3xl font-semibold leading-tight">
                  {Math.round(result.data.main?.temp ?? 0)}°C
                </p>
                <p className="text-sm text-slate-100/90">
                  체감 {Math.round(result.data.main?.feels_like ?? 0)}°C · 습도{" "}
                  {result.data.main?.humidity ?? 0}%
                </p>
              </div>

              <div className="shrink-0 text-5xl">
                {result.data.weather?.[0]?.description === "맑음" ? (
                  isDaytime ? (
                    <span>☀️</span>
                  ) : (
                    <span>🌕</span>
                  )
                ) : result.data.weather?.[0]?.description === "구름많음" ? (
                  isDaytime ? (
                    <span>⛅️</span>
                  ) : (
                    <span className="relative inline-flex items-center">
                      <span className="absolute left-1 top-0 z-0 text-3xl">
                        🌕
                      </span>
                      <span className="relative z-10 ml-1 text-5xl">☁️</span>
                    </span>
                  )
                ) : result.data.weather?.[0]?.description === "구름조금" ? (
                  isDaytime ? (
                    <span>🌤️</span>
                  ) : (
                    <span className="relative inline-flex items-center">
                      <span className="absolute left-1 top-0 z-0 text-4xl">
                        🌕
                      </span>
                      <span className="relative z-10 ml-1 text-5xl">☁️</span>
                    </span>
                  )
                ) : result.data.weather?.[0]?.description === "흐림" ? (
                  <span>☁️</span>
                ) : (
                  <span>-</span>
                )}
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-100/80">
              {result.data.weather?.[0]?.description ?? "-"}
            </p>

            {location && (
              <button
                type="button"
                onClick={fetchLocation}
                className="mt-3 text-xs text-slate-100/80 underline underline-offset-2 hover:text-white"
              >
                위치 새로고침
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
