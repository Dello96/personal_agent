const dotenv = require("dotenv");

// 상대 경로 먼저 시도 (로컬 환경)
dotenv.config({ path: "../.env.local" });

// 환경 변수가 없으면 절대 경로 시도 (EC2 환경)
if (!process.env.BACKEND_URL) {
  dotenv.config({ path: "/home/ubuntu/personal_agent/.env.local" });
}

console.log("✅ BACKEND_URL:", process.env.BACKEND_URL || "not set");
const jwt = require("jsonwebtoken");
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const googleClientId =
  "613918756468-a4q4drq2bblikpv1v4j63nh4g101bc5s.apps.googleusercontent.com";
const googlePassWord = process.env.GOOGLE_CLIENT_SECRET;
const kakaoClientId = process.env.KAKAO_CLIENT_ID;
const kakaoSecret = process.env.KAKAO_CLIENT_SECRET;

// 백엔드 URL (환경 변수에서 가져오거나 기본값 사용)
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
const GOOGLE_REDIRECT_URI = `${BACKEND_URL}/login/redirect`;

app.get("/", function (req, res) {
  res.send(`
        <h1>Log in</h1>
        <a href="/login">Log in</a>
    `);
});

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

const tasksRoutes = require("./routes/tasks");
const teamRoutes = require("./routes/team");
const usersRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");

app.use("/api/tasks", tasksRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);

const uploadRoutes = require("./routes/upload");
app.use("/api/upload", uploadRoutes);

const calendarRoutes = require("./routes/calendar");
app.use("/api/calendar", calendarRoutes);

const chatRoutes = require("./routes/chat");
app.use("/api/chat", chatRoutes);

// Prisma 클라이언트 import
const prisma = require("./db/prisma");

app.get("/login", (req, res) => {
  let url = "https://accounts.google.com/o/oauth2/v2/auth";
  url += `?client_id=${googleClientId}`;
  url += `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}`;
  url += "&response_type=code";
  url += "&scope=email profile";
  res.redirect(url);
});

app.get("/auth/kakao", (req, res) => {
  const KAKAO_REDIRECT_URI = `${BACKEND_URL}/auth/kakao/callback`;

  let url = "https://kauth.kakao.com/oauth/authorize";
  url += `?client_id=${kakaoClientId}`;
  url += `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}`;
  url += "&response_type=code";
  url += "&scope=profile_nickname,profile_image,account_email"; // Kakao 권한 범위

  res.redirect(url);
});

app.get("/health", async (req, res) => {
  try {
    // DB 연결 테스트
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error.message,
    });
  }
});

app.get("/login/redirect", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=no_code`);
    return;
  }

  try {
    // 1. Google Access Token 받기
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: googleClientId,
        client_secret: googlePassWord,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }
    );

    // 2. 사용자 정보 가져오기
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      }
    );

    const googleUser = userResponse.data;

    // 3. DB에서 사용자 찾기 또는 생성
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      // 사용자가 없으면 생성 (teamName는 null로 시작)
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          role: "MEMBER", // 기본값
          teamName: null, // 처음에는 팀 없음
        },
      });
    }
    if (user && user.teamName) {
      const userWithTeam = await prisma.user.findUnique({
        where: { id: user.id },
        include: { team: true },
      });
      if (userWithTeam) {
        user = userWithTeam;
      }
    }

    // 4. JWT 토큰 생성
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    // 5. 프론트엔드로 전달할 사용자 정보
    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      teamName: user.teamName || null,
    };

    // 사용자 정보를 JSON 문자열로 인코딩하여 전달
    const encodedUserInfo = encodeURIComponent(JSON.stringify(userInfo));

    // 성공 시 메인 페이지로 리디렉션
    res.redirect(
      `${FRONTEND_URL}/?login=success&token=${token}&user=${encodedUserInfo}`
    );
  } catch (error) {
    console.error("Login error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=login_failed`);
  }
});

app.get("/auth/kakao/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=kakao_denied`);
    return;
  }

  if (!code) {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=no_code`);
    return;
  }

  try {
    const KAKAO_REDIRECT_URI = "http://localhost:8080/auth/kakao/callback";

    // 1. Kakao Access Token 받기
    const tokenResponse = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: kakaoClientId,
        client_secret: kakaoSecret,
        redirect_uri: KAKAO_REDIRECT_URI,
        code: code.toString(),
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // 2. Kakao 사용자 정보 가져오기
    const userResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`,
      },
    });

    const kakaoUser = userResponse.data;

    // 3. Kakao 사용자 정보 파싱
    const email = kakaoUser.kakao_account?.email;
    const name =
      kakaoUser.kakao_account?.profile?.nickname ||
      kakaoUser.properties?.nickname;
    const picture =
      kakaoUser.kakao_account?.profile?.profile_image_url ||
      kakaoUser.properties?.profile_image;

    if (!email) {
      throw new Error("이메일 정보를 가져올 수 없습니다.");
    }

    // 4. DB에서 사용자 찾기 또는 생성 (Google과 동일한 로직)
    let user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email,
          name: name || "Kakao User",
          picture: picture,
          role: "MEMBER",
          teamName: null,
        },
      });
    }

    // 5. JWT 토큰 생성 (Google과 동일)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    // 6. 프론트엔드로 전달할 사용자 정보
    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      teamName: user.teamName || null,
    };

    const encodedUserInfo = encodeURIComponent(JSON.stringify(userInfo));

    // 7. 성공 시 메인 페이지로 리디렉션
    res.redirect(
      `${FRONTEND_URL}/?login=success&token=${token}&user=${encodedUserInfo}`
    );
  } catch (error) {
    console.error("Kakao login error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=login_failed`);
  }
});

app.listen(8080, () => {
  console.log("server is running at 8080");
});
