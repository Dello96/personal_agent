const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../db/prisma");

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

//회원가입
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. 필수 필드 검증
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "필수 정보를 모두 입력해주세요.",
      });
    }

    // 2. 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "올바른 이메일 형식이 아닙니다." });
    }

    // 3. 비밀번호 길이 검증
    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "비밀번호는 최소 8자 이상이어야 합니다." });
    }

    // 4. 역할 검증
    const validRoles = [
      "INTERN",
      "STAFF",
      "ASSOCIATE",
      "ASSISTANT_MANAGER",
      "TEAM_LEAD",
    ];
    const userRole = role && validRoles.includes(role) ? role : "INTERN";

    // 5. 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "이미 가입된 이메일입니다." });
    }

    // 6. 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 7. 사용자 생성
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    // 8. JWT 토큰 생성
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // 9. 비밀번호 제외하고 응답
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: "회원가입이 완료되었습니다.",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "회원가입 중 오류가 발생했습니다." });
  }
});

//회원가입 후 로그인
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. 필수 필드 검증
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "이메일과 비밀번호를 입력해주세요." });
    }

    // 2. 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(401)
        .json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
    }

    // 3. 소셜 로그인 사용자 체크
    if (!user.password) {
      return res.status(400).json({
        error: "소셜 로그인으로 가입된 계정입니다. 소셜 로그인을 이용해주세요.",
      });
    }

    // 4. 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res
        .status(401)
        .json({ error: "이메일 또는 비밀번호가 일치하지 않습니다." });
    }

    // 5. JWT 토큰 생성
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // 6. 비밀번호 제외하고 응답
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: "로그인 성공",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "로그인 중 오류가 발생했습니다." });
  }
});

// ============ 이메일 중복 확인 ============
router.get("/check-email", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "이메일을 입력해주세요." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    res.json({ available: !existingUser });
  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).json({ error: "이메일 확인 중 오류가 발생했습니다." });
  }
});

module.exports = router;
