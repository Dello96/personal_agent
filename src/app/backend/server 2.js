const dotenv = require('dotenv')
dotenv.config();

const express = require('express');
const axios = require('axios');

const app = express();
const googleClientId = 'GOOGLE_CLIENT_ID =613918756468-a4q4drq2bblikpv1v4j63nh4g101bc5s.apps.googleusercontent.com';
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
    url += `&redirect_uri=${GOOGLE_REDIRECT_URI}`
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
    res.send('ok');
});

app.listen(8080, () => {
    console.log('server is running at 8080');
});