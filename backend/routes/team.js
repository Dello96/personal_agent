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
      where: { teamId: req.user.teamName },
      _count: true,
    });

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: "서버 오류" });
  }
});

// 팀원 역할 변경 (팀장 이상)
router.put("/members/:memberId/role", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    const { teamName, role: requesterRole, userId } = req.user;

    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(requesterRole)) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }
    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }
    const allowedRoles = ["MEMBER", "TEAM_LEAD", "MANAGER", "DIRECTOR"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "유효하지 않은 역할입니다." });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, teamName: true, role: true },
    });
    if (!targetUser || targetUser.teamName !== teamName) {
      return res.status(404).json({ error: "팀원을 찾을 수 없습니다." });
    }

    if (targetUser.id === userId && role === "MEMBER") {
      return res.status(400).json({
        error: "본인의 역할을 팀원으로 변경할 수 없습니다.",
      });
    }

    const updated = await prisma.user.update({
      where: { id: memberId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamName: true,
      },
    });

    return res.json({ message: "역할이 변경되었습니다.", member: updated });
  } catch (error) {
    console.error("팀원 역할 변경 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 팀명 변경 (팀장 이상)
router.put("/rename", async (req, res) => {
  try {
    const { newName } = req.body;
    const { teamName, role } = req.user;

    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }
    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }
    if (!newName || typeof newName !== "string" || newName.trim() === "") {
      return res.status(400).json({ error: "새 팀명을 입력해주세요." });
    }
    const trimmedName = newName.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ error: "팀 이름은 50자 이하여야 합니다." });
    }
    if (trimmedName === teamName) {
      return res.status(400).json({ error: "현재 팀명과 동일합니다." });
    }

    const exists = await prisma.team.findUnique({
      where: { teamName: trimmedName },
      select: { teamName: true },
    });
    if (exists) {
      return res.status(409).json({ error: "이미 존재하는 팀 이름입니다." });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { teamName },
        data: { teamName: trimmedName },
      });

      await tx.user.updateMany({
        where: { teamName },
        data: { teamName: trimmedName },
      });

      await tx.task.updateMany({
        where: { teamId: teamName },
        data: { teamId: trimmedName },
      });

      await tx.calendarEvent.updateMany({
        where: { teamId: teamName },
        data: { teamId: trimmedName },
      });

      await tx.chatRoom.updateMany({
        where: { teamId: teamName },
        data: { teamId: trimmedName },
      });

      await tx.githubRepository.updateMany({
        where: { teamId: teamName },
        data: { teamId: trimmedName },
      });

      await tx.figmaTeamConnection.updateMany({
        where: { teamId: teamName },
        data: { teamId: trimmedName },
      });

      const updatedTeam = await tx.team.findUnique({
        where: { teamName: trimmedName },
        select: { id: true, teamName: true, createdAt: true, updatedAt: true },
      });

      return updatedTeam;
    });

    return res.json({ message: "팀명이 변경되었습니다.", team: result });
  } catch (error) {
    console.error("팀명 변경 오류:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "이미 존재하는 팀 이름입니다." });
    }
    return res.status(500).json({ error: "서버 오류가 발생했습니다." });
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
      where: { teamName: name.trim() },
    });

    if (existingTeam) {
      return res.status(409).json({ error: "이미 존재하는 팀 이름입니다." });
    }

    // 5. 트랜잭션으로 팀 생성 및 사용자 teamName 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 팀 생성
      const team = await tx.team.create({
        data: {
          teamName: name.trim(),
        },
      });

      // 생성자의 teamName 업데이트
      await tx.user.update({
        where: { id: userId },
        data: { teamName: team.teamName },
      });
      const teamWithMembers = await tx.team.findUnique({
        where: { teamName: team.teamName },
        include: {
          members: {
            select: {
              id: true,
              name: true, // ✅ 팀원 이름 포함
              picture: true,
              email: true,
              role: true,
              teamName: true,
            },
          },
        },
      });

      return teamWithMembers;
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
  let responseSent = false;

  const sendResponse = (status, data) => {
    if (responseSent || res.headersSent) {
      console.error(
        "응답이 이미 전송되었습니다. 상태:",
        status,
        "데이터:",
        data
      );
      return null;
    }
    responseSent = true;
    return res.status(status).json(data);
  };
  try {
    const { teamName } = req.body;
    const { userId, teamName: userTeamName } = req.user;

    // 1. teamName 검증
    if (!teamName || typeof teamName !== "string") {
      return sendResponse(400, { error: "팀 ID를 입력해주세요." }); // ✅ sendResponse 사용
    }

    // 2. 이미 팀에 속해있는지 체크
    if (userTeamName) {
      return sendResponse(400, {
        // ✅ sendResponse 사용
        error: "이미 팀에 속해있습니다. 팀을 나간 후 다시 시도해주세요.",
      });
    }

    // 3. 팀 존재 여부 확인
    let team;
    try {
      team = await prisma.team.findFirst({
        where: {
          OR: [{ id: teamName }, { teamName: teamName }],
        },
        include: {
          members: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    } catch (findError) {
      console.error("팀 조회 오류:", findError);
      if (!res.headersSent) {
        return sendResponse(500, { error: "팀 조회 중 오류가 발생했습니다." }); // ✅ sendResponse 사용
      }
      return;
    }

    if (!team) {
      return sendResponse(404, { error: "존재하지 않는 팀입니다." }); // ✅ sendResponse 사용
    }

    // 4. 이미 해당 팀의 멤버인지 체크
    const isAlreadyMember = team.members.some((member) => member.id === userId);
    if (isAlreadyMember) {
      return sendResponse(400, { error: "이미 해당 팀의 멤버입니다." }); // ✅ sendResponse 사용
    }

    // 5. 사용자의 teamName 업데이트
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { teamName: team.teamName },
      });
    } catch (updateError) {
      console.error("사용자 업데이트 오류:", updateError);
      console.error("에러 코드:", updateError.code);
      console.error("에러 메시지:", updateError.message);

      if (res.headersSent) {
        return;
      }

      if (updateError.code === "P2025") {
        return sendResponse(404, { error: "사용자를 찾을 수 없습니다." }); // ✅ sendResponse 사용
      }

      if (updateError.code === "P2003") {
        return sendResponse(400, { error: "존재하지 않는 팀입니다." }); // ✅ sendResponse 사용
      }

      return sendResponse(500, {
        // ✅ sendResponse 사용
        error: "사용자 정보 업데이트 중 오류가 발생했습니다.",
        details:
          process.env.NODE_ENV === "development"
            ? updateError.message
            : undefined,
      });
    }

    // 6. 업데이트된 팀 정보 반환
    let updatedTeam;
    try {
      updatedTeam = await prisma.team.findUnique({
        where: { teamName: team.teamName },
        include: {
          members: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              picture: true,
              teamName: true,
            },
          },
        },
      });
    } catch (findError) {
      console.error("팀 정보 조회 오류:", findError);
      console.error("에러 코드:", findError.code);
      console.error("에러 메시지:", findError.message);

      if (res.headersSent) {
        return;
      }

      return sendResponse(500, {
        // ✅ sendResponse 사용
        error: "팀 정보 조회 중 오류가 발생했습니다.",
        details:
          process.env.NODE_ENV === "development"
            ? findError.message
            : undefined,
      });
    }

    if (!updatedTeam) {
      if (res.headersSent) {
        return;
      }
      return sendResponse(500, { error: "팀 정보를 불러올 수 없습니다." });
    }

    if (res.headersSent) {
      console.error("응답이 이미 전송되었습니다.");
      return;
    }

    return sendResponse(200, {
      // ✅ sendResponse 사용
      message: "팀에 성공적으로 가입했습니다.",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("팀 가입 오류:", error);
    console.error("에러 메시지:", error.message);
    console.error("에러 코드:", error.code);
    console.error("에러 스택:", error.stack);

    // ✅ 이미 응답을 보냈는지 확인 (가장 중요!)
    if (res.headersSent) {
      console.error(
        "응답이 이미 전송되었습니다. 추가 응답을 보낼 수 없습니다."
      );
      return;
    }

    // Prisma 에러 처리
    if (error.code === "P2025") {
      return sendResponse(404, { error: "사용자를 찾을 수 없습니다." }); // ✅ sendResponse 사용
    }

    if (error.code === "P2003") {
      return sendResponse(400, { error: "존재하지 않는 팀입니다." }); // ✅ sendResponse 사용
    }

    sendResponse(500, {
      // ✅ sendResponse 사용
      error: "서버 오류가 발생했습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 가입 가능한 팀 목록 조회
router.get("/getTeam", async (req, res) => {
  try {
    const { userId, teamName } = req.user;

    // 모든 팀 목록 조회
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        teamName: true,
        createdAt: true,
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
      isMember: team.teamName === teamName,
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
      where: { teamName: teamName },
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
