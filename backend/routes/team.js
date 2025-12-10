const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

// 팀 대시보드 (팀장만)
router.get("/dashboard", async (req, res) => {
  try {
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(req.user.role)) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }

    // 팀 통계 조회
    const stats = await prisma.task.groupBy({
      by: ["status"],
      where: { teamName: req.user.teamName },
      _count: true,
    });

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

// 팀 생성 (팀장급 이상만 가능)
router.post("/create", async (req, res) => {
  try {
    const { name } = req.body;
    const { userId, role, teamName } = req.user;

    // 1. 권한 체크: 팀장급 이상만 팀 생성 가능
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res.status(403).json({
        error:
          "팀 생성 권한이 없습니다. 팀장급 이상만 팀을 생성할 수 있습니다.",
      });
    }

    // 2. 이미 팀에 속해있는지 체크
    if (teamName) {
      return res.status(400).json({
        error: "이미 팀에 속해있습니다. 팀을 나간 후 다시 시도해주세요.",
      });
    }

    // 3. 팀 이름 검증
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "팀 이름을 입력해주세요." });
    }

    if (name.trim().length > 50) {
      return res.status(400).json({ error: "팀 이름은 50자 이하여야 합니다." });
    }

    // 4. 팀 이름 중복 체크
    const existingTeam = await prisma.team.findFirst({
      where: { name: name.trim() },
    });

    if (existingTeam) {
      return res.status(409).json({ error: "이미 존재하는 팀 이름입니다." });
    }

    // 5. 트랜잭션으로 팀 생성 및 사용자 teamName 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 팀 생성
      const team = await tx.team.create({
        data: {
          name: name.trim(),
        },
      });

      // 생성자의 teamName 업데이트
      await tx.user.update({
        where: { id: userId },
        data: { teamName: team.teamName },
      });

      return team;
    });

    res.status(201).json({
      message: "팀이 성공적으로 생성되었습니다.",
      team: result,
    });
  } catch (error) {
    console.error("팀 생성 오류:", error);

    // Prisma 에러 처리
    if (error.code === "P2002") {
      return res.status(409).json({ error: "팀 이름이 이미 존재합니다." });
    }

    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});
// 팀 가입 (모든 사용자 가능)
router.post("/join", async (req, res) => {
  try {
    const { teamName } = req.body;
    const { userId, teamName: userTeamName } = req.user;

    // 1. teamName 검증
    if (!teamName || typeof teamName !== "string") {
      return res.status(400).json({ error: "팀 ID를 입력해주세요." });
    }

    // 2. 이미 팀에 속해있는지 체크
    if (userTeamName) {
      return res.status(400).json({
        error: "이미 팀에 속해있습니다. 팀을 나간 후 다시 시도해주세요.",
      });
    }

    // 3. 팀 존재 여부 확인 (ID 또는 이름으로 찾기)
    const team = await prisma.team.findFirst({
      where: {
        OR: [
          { id: teamName }, // UUID인 경우
          { name: teamName }, // 이름인 경우
        ],
      },
      include: {
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: "존재하지 않는 팀입니다." });
    }

    // 4. 이미 해당 팀의 멤버인지 체크 (중복 가입 방지)
    const isAlreadyMember = team.members.some((member) => member.id === userId);
    if (isAlreadyMember) {
      return res.status(400).json({ error: "이미 해당 팀의 멤버입니다." });
    }

    // 5. 사용자의 teamName 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { teamName: team.teamName },
    });

    // 6. 업데이트된 팀 정보 반환
    const updatedTeam = await prisma.team.findUnique({
      where: { id: team.teamName },
      include: {
        members: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(200).json({
      message: "팀에 성공적으로 가입했습니다.",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("팀 가입 오류:", error);

    // Prisma 에러 처리
    if (error.code === "P2025") {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 가입 가능한 팀 목록 조회
router.get("/", async (req, res) => {
  try {
    const { userId, teamName } = req.user;

    // 모든 팀 목록 조회
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        members: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 현재 사용자가 속한 팀이 있는지 표시
    const teamsWithStatus = teams.map((team) => ({
      ...team,
      isMember: team.id === teamName,
      memberCount: team._count.members,
      taskCount: team._count.tasks,
    }));

    res.json({
      teams: teamsWithStatus,
      currentTeamName: teamName,
    });
  } catch (error) {
    console.error("팀 목록 조회 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 팀 나가기
router.post("/leave", async (req, res) => {
  try {
    const { userId, teamName } = req.user;

    // 1. 팀에 속해있지 않은 경우
    if (!teamName) {
      return res.status(400).json({ error: "속해있는 팀이 없습니다." });
    }

    // 2. 팀 정보 조회
    const team = await prisma.team.findUnique({
      where: { id: teamName },
    });

    if (!team) {
      return res.status(404).json({ error: "팀을 찾을 수 없습니다." });
    }

    // 4. 사용자의 teamName을 null로 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { teamName: null },
    });

    res.json({
      message: "팀에서 나갔습니다.",
    });
  } catch (error) {
    console.error("팀 나가기 오류:", error);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;
