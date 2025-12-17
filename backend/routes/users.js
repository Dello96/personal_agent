const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

// 현재 사용자 정보 조회
router.get("/me", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        team: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                picture: true,
                email: true,
                role: true,
                teamName: true,
              },
            },
          },
        },
      },
    });
    // user가 null인 경우 체크
    if (!user) {
      console.error("사용자를 찾을 수 없음:", req.user.userId);
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    }
    res.json(user);
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    console.error("에러 메시지:", error.message);
    console.error("에러 스택:", error.stack);
    if (error.code) {
      console.error("Prisma 에러 코드:", error.code);
    }
    res.status(500).json({
      error: "서버 오류",
      message: error.message, // 개발 환경에서만 에러 메시지 포함
    });
  }
});

// 팀원 목록 조회 (같은 팀원이라면 모두 조회 가능)
router.get("/team-members", async (req, res) => {
  try {
    // teamName가 null인 경우 체크
    if (!req.user.teamName) {
      return res.status(400).json({
        error: "팀에 속해있지 않습니다. 먼저 팀에 가입해주세요.",
      });
    }

    const members = await prisma.user.findMany({
      where: { teamName: req.user.teamName },
      select: { id: true, name: true, email: true, role: true },
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
