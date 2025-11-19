const dotenv = require('dotenv')
dotenv.config();

const express = require('express');
const axios = require('axios');

const app = express();
const googleClientId = '613918756468-a4q4drq2bblikpv1v4j63nh4g101bc5s.apps.googleusercontent.com';
const googlePassWord = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = 'http://localhost:8080/login/redirect';

app.get('/', function(req, res) {
    res.send(`
        <h1>Log in</h1>
        <a href="/login">Log in</a>
    `);
});

app.get('/login', (req, res) => {
    let url = 'https://accounts.google.com/o/oauth2/v2/auth';
	// client_id는 위 스크린샷을 보면 발급 받았음을 알 수 있음
	// 단, 스크린샷에 있는 ID가 아닌 당신이 직접 발급 받은 ID를 사용해야 함.
    url += `?client_id=${googleClientId}`
	// 아까 등록한 redirect_uri
    // 로그인 창에서 계정을 선택하면 구글 서버가 이 redirect_uri로 redirect 시켜줌
    // redirect_uri는 URL 인코딩이 필요함
    url += `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}`
    // 필수 옵션.
    url += '&response_type=code'
  	// 구글에 등록된 유저 정보 email, profile을 가져오겠다 명시
    url += '&scope=email profile'    
  	// 완성된 url로 이동
  	// 이 url이 위에서 본 구글 계정을 선택하는 화면임.
	res.redirect(url);
});

app.get('/login/redirect', (req, res) => {
    const { code } = req.query;
    
    // TODO: 여기서 code를 사용하여 Google Access Token 받기
    // 현재는 로그인 성공 후 프론트엔드로 리디렉션
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // 성공 시 메인 페이지로 리디렉션
    res.redirect(`${FRONTEND_URL}/?login=success`);
    
    // 에러가 있는 경우
    // if (req.query.error) {
    //     res.redirect(`${FRONTEND_URL}/auth/login?error=${req.query.error}`);
    // }
});

app.listen(8080, () => {
    console.log('server is running at 8080');
});