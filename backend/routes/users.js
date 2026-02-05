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

// 현재 사용자 정보 업데이트 (닉네임/프로필 이미지)
router.put("/me", async (req, res) => {
  try {
    const { name, picture } = req.body || {};
    const data = {};

    if (typeof name === "string") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "닉네임을 입력해주세요." });
      }
      data.name = trimmedName;
    }

    if (picture === null) {
      data.picture = null;
    } else if (typeof picture === "string") {
      const trimmedPicture = picture.trim();
      if (!trimmedPicture) {
        return res
          .status(400)
          .json({ error: "프로필 이미지 URL이 비었습니다." });
      }
      data.picture = trimmedPicture;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "변경할 정보가 없습니다." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        teamName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(updatedUser);
  } catch (error) {
    console.error("사용자 정보 업데이트 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 팀원 목록 조회 (현재 로그인한 사용자의 팀에 속한 멤버만 반환)
router.get("/team-members", async (req, res) => {
  try {
    const teamName = req.user.teamName;
    // null, undefined, 빈 문자열이면 팀 없음
    if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
      return res.status(400).json({
        error: "팀에 속해있지 않습니다. 먼저 팀에 가입해주세요.",
      });
    }

    const normalizedTeamName = teamName.trim();

    // 해당 팀이 실제로 존재하는지 확인 (다른 팀 멤버가 유출되지 않도록)
    const teamExists = await prisma.team.findUnique({
      where: { teamName: normalizedTeamName },
      select: { teamName: true },
    });
    if (!teamExists) {
      return res.json([]);
    }

    const members = await prisma.user.findMany({
      where: { teamName: normalizedTeamName },
      select: { id: true, name: true, email: true, role: true },
    });

    console.log("[team-members] 필터 결과", {
      teamName: normalizedTeamName,
      userId: req.user.userId,
      count: members.length,
      names: members.map((m) => m.name),
    });
    res.json(members);
  } catch (error) {
    console.error("팀원 목록 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
