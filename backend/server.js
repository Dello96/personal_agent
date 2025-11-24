const dotenv = require("dotenv");
// 루트 폴더의 .env.local 파일 사용
dotenv.config({ path: "../.env.local" });

const express = require("express");
const axios = require("axios");

const app = express();
const googleClientId =
  "613918756468-a4q4drq2bblikpv1v4j63nh4g101bc5s.apps.googleusercontent.com";
const googlePassWord = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = "http://localhost:8080/login/redirect";

app.get("/", function (req, res) {
  res.send(`
        <h1>Log in</h1>
        <a href="/login">Log in</a>
    `);
});

app.get("/login", (req, res) => {
  let url = "https://accounts.google.com/o/oauth2/v2/auth";
  // client_id는 위 스크린샷을 보면 발급 받았음을 알 수 있음
  // 단, 스크린샷에 있는 ID가 아닌 당신이 직접 발급 받은 ID를 사용해야 함.
  url += `?client_id=${googleClientId}`;
  // 아까 등록한 redirect_uri
  // 로그인 창에서 계정을 선택하면 구글 서버가 이 redirect_uri로 redirect 시켜줌
  // redirect_uri는 URL 인코딩이 필요함
  url += `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}`;
  // 필수 옵션.
  url += "&response_type=code";
  // 구글에 등록된 유저 정보 email, profile을 가져오겠다 명시
  url += "&scope=email profile";
  // 완성된 url로 이동
  // 이 url이 위에서 본 구글 계정을 선택하는 화면임.
  res.redirect(url);
});

app.get("/login/redirect", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=no_code`);
    return;
  }

  try {
    // TODO: Google Access Token 받기
    // const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
    //   code,
    //   client_id: googleClientId,
    //   client_secret: googlePassWord,
    //   redirect_uri: GOOGLE_REDIRECT_URI,
    //   grant_type: 'authorization_code',
    // });

    // TODO: 사용자 정보 가져오기
    // const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    //   headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    // });

    // 임시 토큰과 사용자 정보 (실제로는 위의 API 호출 결과 사용)
    const token = "temp-token-" + Date.now();
    const user = {
      id: "user-123",
      email: "user@example.com",
      name: "Test User",
      picture: "https://via.placeholder.com/150",
    };

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    // 사용자 정보를 JSON 문자열로 인코딩하여 전달
    const userInfo = encodeURIComponent(JSON.stringify(user));

    // 성공 시 메인 페이지로 리디렉션 (토큰과 사용자 정보 포함)
    res.redirect(
      `${FRONTEND_URL}/?login=success&token=${token}&user=${userInfo}`
    );
  } catch (error) {
    console.error("Login error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${FRONTEND_URL}/auth/login?error=login_failed`);
  }
});

app.listen(8080, () => {
  console.log("server is running at 8080");
});
