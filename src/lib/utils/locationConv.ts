// 기본 상수 정의
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0; // 투영 위도1(degree)
const SLAT2 = 60.0; // 투영 위도2(degree)
const OLON = 126.0; // 기준점 경도(degree)
const OLAT = 38.0; // 기준점 위도(degree)
const XO = 43; // 기준점 X좌표(GRID)
const YO = 136; // 기준점 Y좌표(GRID)

// 입력 및 출력 타입 정의
interface LatLng {
  lat: number;
  lng: number;
}

interface GridXY {
  x: number;
  y: number;
}

type ConversionCode = "toXY" | "toLL";

export default function dfsXYConv(
  code: ConversionCode,
  v1: number | undefined,
  v2: number | undefined
): LatLng | GridXY {
  if (v1 === undefined || v2 === undefined) {
    throw new Error("dfsXYConv: v1 and v2 must be numbers");
  }
  const DEGRAD = Math.PI / 180.0;
  const RADDEG = 180.0 / Math.PI;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  const sn =
    Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(
      Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
        Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    );
  const sf =
    (Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn) * Math.cos(slat1)) /
    sn;
  const ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);

  let result: LatLng | GridXY;

  if (code === "toXY") {
    const ra =
      (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + v1 * DEGRAD * 0.5), sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    result = {
      x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
      y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
    };
  } else {
    // code === "toLL"
    const xn = v1 - XO;
    const yn = ro - v2 + YO;
    const ra = Math.sqrt(xn * xn + yn * yn);
    const alat =
      2.0 * Math.atan(Math.pow((re * sf) / ra, 1.0 / sn)) - Math.PI * 0.5;

    let theta = 0.0;
    if (Math.abs(xn) > 0.0) {
      theta = Math.atan2(xn, yn);
    }
    const alon = theta / sn + olon;

    result = {
      lat: alat * RADDEG,
      lng: alon * RADDEG,
    };
  }

  return result;
}
