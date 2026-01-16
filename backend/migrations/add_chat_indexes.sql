-- 채팅 메시지 조회 성능 최적화를 위한 인덱스 추가
-- 실행 방법: psql -d your_database -f add_chat_indexes.sql

-- 메시지 조회 최적화 (채팅방별, 시간순)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_room_created 
ON "Message"(chatRoomId, createdAt DESC);

-- 메시지 ID 기반 증분 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_id 
ON "Message"(id);

-- 채팅방 참여자 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_participant_user 
ON "ChatRoomParticipant"(userId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_participant_room 
ON "ChatRoomParticipant"(chatRoomId);

-- 채팅방 타입별 조회 최적화
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_type 
ON "ChatRoom"(type);
