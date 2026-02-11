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
  } | null;
}

const WEATHER_REFRESH_MS = 10 * 60 * 1000; // 10분

export default function Weather() {
  const [location, setLocation] = useState<Latlng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<WeatherResult | null>(null);

  // 위치 정확히 파악 (고정밀 + 캐시 짧게)
  useEffect(() => {
    setLocationError(null);
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
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
        setResult(res);
        console.log(res);
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
      <div className="flex bg-black/40"></div>
      {loading && !result?.data && (
        <p className="mt-2 text-gray-400 text-sm">위치·날씨 불러오는 중...</p>
      )}
      {locationError && (
        <p className="mt-2 text-red-500 text-sm">{locationError}</p>
      )}
      {result?.ok === false && result.error && (
        <p className="mt-2 text-red-500 text-sm">{result.error}</p>
      )}
      {result?.ok === true && result.data && (
        <div className="mt-3 p-3 bg-black/20 rounded-lg">
          <p className="font-medium">{result.data.name}</p>
          <p className="text-2xl font-bold">
            {Math.round(result.data.main?.temp ?? 0)}°C
          </p>
          <p className="text-gray-300">
            {result.data.weather?.[0]?.description ?? "-"}
          </p>
          <p className="text-sm text-gray-400">
            체감 {Math.round(result.data.main?.feels_like ?? 0)}°C · 습도{" "}
            {result.data.main?.humidity ?? 0}%
          </p>
        </div>
      )}
    </div>
  );
}
