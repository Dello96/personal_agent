const MEETING_TYPES = ["MEETING_ROOM", "MEETING"];

const buildReminderLink = (eventId, startDateISO, endDateISO) =>
  `/calendar?eventId=${eventId}&reminderAt=${encodeURIComponent(startDateISO)}&endAt=${encodeURIComponent(endDateISO)}`;

async function runMeetingReminderJob(prisma, chatWSS) {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 4 * 60 * 1000); // 4분 후
  const windowEnd = new Date(now.getTime() + 6 * 60 * 1000); // 6분 후

  const upcomingMeetings = await prisma.calendarEvent.findMany({
    where: {
      type: { in: MEETING_TYPES },
      status: "APPROVED",
      startDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      title: true,
      teamId: true,
      requestedBy: true,
      startDate: true,
      endDate: true,
    },
  });

  for (const event of upcomingMeetings) {
    const teamMembers = await prisma.user.findMany({
      where: { teamName: event.teamId },
      select: { id: true },
    });

    const targets = teamMembers
      .map((member) => member.id)
      .filter((id) => id !== event.requestedBy);

    if (targets.length === 0) continue;

    const startDateISO = event.startDate.toISOString();
    const endDateISO = event.endDate.toISOString();
    const reminderLink = buildReminderLink(event.id, startDateISO, endDateISO);

    const existing = await prisma.notification.findMany({
      where: {
        type: "meeting_reminder",
        link: reminderLink,
        userId: { in: targets },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existing.map((item) => item.userId));
    const missingTargets = targets.filter((id) => !existingUserIds.has(id));
    if (missingTargets.length === 0) continue;

    const title = "회의 시작 5분 전";
    const message = `${event.title} 회의가 곧 시작됩니다.`;

    await prisma.notification.createMany({
      data: missingTargets.map((userId) => ({
        userId,
        type: "meeting_reminder",
        title,
        message,
        link: reminderLink,
      })),
    });

    if (chatWSS) {
      missingTargets.forEach((userId) => {
        chatWSS.broadcastToUser(userId, { type: "notification_update" });
      });
    }
  }
}

function startMeetingReminderJob(prisma, chatWSS) {
  const intervalMs = 60 * 1000;

  const execute = async () => {
    try {
      await runMeetingReminderJob(prisma, chatWSS);
    } catch (error) {
      console.error("회의 리마인드 작업 오류:", error);
    }
  };

  execute();
  setInterval(execute, intervalMs);
}

module.exports = {
  startMeetingReminderJob,
};
