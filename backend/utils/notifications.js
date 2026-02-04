const createNotificationsForUsers = async (prisma, userIds, payload) => {
  if (!userIds || userIds.length === 0) return;
  const data = userIds.map((userId) => ({
    userId,
    type: payload.type,
    title: payload.title,
    message: payload.message || null,
    link: payload.link || null,
    chatRoomId: payload.chatRoomId || null,
    chatType: payload.chatType || null,
  }));
  await prisma.notification.createMany({ data });
};

module.exports = { createNotificationsForUsers };
