const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

const ROLE_RANK = {
  INTERN: 1,
  STAFF: 2,
  ASSOCIATE: 3,
  ASSISTANT_MANAGER: 4,
  TEAM_LEAD: 5,
};

const isManagerOrAbove = (role) => (ROLE_RANK[role] || 0) >= ROLE_RANK.ASSISTANT_MANAGER;

const deleteUserAccountWithRelatedData = async (userId) => {
  return prisma.$transaction(async (tx) => {
    // 사용자 참조 데이터 정리
    await tx.notification.deleteMany({ where: { userId } });
    await tx.chatRoomParticipant.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.taskParticipant.deleteMany({ where: { userId } });
    await tx.taskDiscussionNote.deleteMany({ where: { authorId: userId } });
    await tx.meetingNote.deleteMany({ where: { authorId: userId } });
    await tx.taskStatusHistory.deleteMany({ where: { changedBy: userId } });

    // 사용자가 승인자로만 들어간 일정은 승인자 null 처리
    await tx.calendarEvent.updateMany({
      where: { approvedBy: userId, NOT: { requestedBy: userId } },
      data: { approvedBy: null },
    });
    // 사용자가 생성한 일정은 삭제
    await tx.calendarEvent.deleteMany({ where: { requestedBy: userId } });

    // 사용자가 담당자/지시자인 업무는 함께 삭제
    const ownedTasks = await tx.task.findMany({
      where: {
        OR: [{ assigneeId: userId }, { assignerId: userId }],
      },
      select: { id: true },
    });
    const ownedTaskIds = ownedTasks.map((task) => task.id);
    if (ownedTaskIds.length > 0) {
      await tx.taskStatusHistory.deleteMany({
        where: { taskId: { in: ownedTaskIds } },
      });
      await tx.task.deleteMany({
        where: { id: { in: ownedTaskIds } },
      });
    }

    // 마지막으로 사용자 삭제
    await tx.user.delete({
      where: { id: userId },
    });
  });
};

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
        roleSetupCompleted: true,
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

// 로그인 사용자 직급 설정 (소셜 가입 후 1회 설정)
router.put("/me/role", async (req, res) => {
  try {
    const { role } = req.body || {};
    const validRoles = [
      "INTERN",
      "STAFF",
      "ASSOCIATE",
      "ASSISTANT_MANAGER",
      "TEAM_LEAD",
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "유효하지 않은 직급입니다." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        role,
        roleSetupCompleted: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        roleSetupCompleted: true,
        teamName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(updatedUser);
  } catch (error) {
    console.error("직급 설정 오류:", error);
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
      select: {
        id: true,
        name: true,
        email: true,
        picture: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
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

// 현재 팀원 온라인 상태 조회
router.get("/team-members/online", async (req, res) => {
  try {
    const teamName = req.user.teamName;
    if (!teamName || typeof teamName !== "string" || teamName.trim() === "") {
      return res.status(400).json({
        error: "팀에 속해있지 않습니다. 먼저 팀에 가입해주세요.",
      });
    }

    const normalizedTeamName = teamName.trim();
    const members = await prisma.user.findMany({
      where: { teamName: normalizedTeamName },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    const chatWSS = require("../server").chatWSS;
    const onlineMap =
      chatWSS && typeof chatWSS.getOnlineStatusMap === "function"
        ? chatWSS.getOnlineStatusMap(memberIds)
        : memberIds.reduce((acc, id) => {
            acc[id] = false;
            return acc;
          }, {});

    return res.json({ onlineMap });
  } catch (error) {
    console.error("팀원 온라인 상태 조회 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 본인 팀 탈퇴 (모든 팀원 가능)
router.post("/team/withdraw", async (req, res) => {
  try {
    const { userId } = req.user;
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        teamName: true,
      },
    });

    if (!currentUser) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    if (!currentUser.teamName) {
      return res.status(400).json({ error: "이미 팀에 속해있지 않습니다." });
    }

    await deleteUserAccountWithRelatedData(userId);

    return res.json({
      ok: true,
      message: "회원 탈퇴가 완료되었습니다.",
    });
  } catch (error) {
    console.error("본인 팀 탈퇴 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

// 팀원 강제 탈퇴 (매니저급 이상만 가능)
router.post("/team-members/:memberId/withdraw", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;
    const { memberId } = req.params;

    if (!isManagerOrAbove(role)) {
      return res.status(403).json({
        error: "권한이 없습니다. 매니저급 이상만 팀원을 탈퇴시킬 수 있습니다.",
      });
    }

    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }

    if (memberId === userId) {
      return res.status(400).json({
        error:
          "본인 탈퇴는 /api/users/team/withdraw를 사용해주세요.",
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamName: true,
      },
    });

    if (!target) {
      return res.status(404).json({ error: "대상 사용자를 찾을 수 없습니다." });
    }

    if (target.teamName !== teamName) {
      return res.status(403).json({ error: "같은 팀원만 탈퇴시킬 수 있습니다." });
    }

    await deleteUserAccountWithRelatedData(memberId);

    return res.json({
      ok: true,
      message: `${target.name}님의 회원 탈퇴 처리가 완료되었습니다.`,
      memberId,
    });
  } catch (error) {
    console.error("팀원 강제 탈퇴 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
