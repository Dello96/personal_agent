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
      include: { team: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

// 팀원 목록 조회 (팀장만)
router.get("/team-members", async (req, res) => {
  try {
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(req.user.role)) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }

    const members = await prisma.user.findMany({
      where: { teamId: req.user.teamId },
      select: { id: true, name: true, email: true, role: true },
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
