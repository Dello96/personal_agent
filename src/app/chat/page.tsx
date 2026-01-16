"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import { useAuthStore } from "@/app/stores/authStore";
import {
  getMessages,
  Message,
  deleteMessage,
  getDirectChatRoom,
  getChatRoom,
} from "@/lib/api/chat";
import { formatRelativeTime } from "@/lib/utils/dateFormat";
import Image from "next/image";
import { getTeamMembers, TeamMember } from "@/lib/api/users";
import { chatWebSocketClient } from "@/lib/websocket/chatClient";

const ChatPage = () => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatType, setChatType] = useState<"TEAM" | "DIRECT">("TEAM");
  const [currentChatRoomId, setCurrentChatRoomId] = useState<string | null>(
    null
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wsClientRef = useRef(chatWebSocketClient);
  const currentChatRoomIdRef = useRef<string | null>(null);
  const chatTypeRef = useRef<"TEAM" | "DIRECT">("TEAM");

  // ref 업데이트
  useEffect(() => {
    currentChatRoomIdRef.current = currentChatRoomId;
    chatTypeRef.current = chatType;
  }, [currentChatRoomId, chatType]);

  const activeMenu = "채팅";

  const handleLeftMenu = (menu: string) => {
    if (menu === "진행중인 업무") {
      router.push("/");
    } else if (menu === "일정") {
      router.push("/calendar");
    } else if (menu === "채팅") {
      router.push("/chat");
    }
  };

  // ref로 최신 상태 관리
  const nextCursorRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // 메시지 목록 조회 (초기 로드 및 더보기용)
  const fetchMessages = async (
    loadMore = false,
    roomId?: string | null,
    type?: "TEAM" | "DIRECT"
  ) => {
    if (isLoadingRef.current) return;

    const targetRoomId = roomId !== undefined ? roomId : currentChatRoomId;
    const targetType = type !== undefined ? type : chatType;

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      const response = await getMessages(
        50,
        loadMore ? nextCursorRef.current || undefined : undefined,
        targetRoomId || undefined,
        targetType
      );

      if (loadMore) {
        setMessages((prev) => [...response.messages, ...prev]);
      } else {
        // 전체 조회: 메시지 교체
        setMessages(response.messages);
      }

      setHasMore(response.hasMore);
      nextCursorRef.current = response.nextCursor;
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      console.error("메시지 조회 실패:", error);
      setError(error.message || "메시지를 불러오는데 실패했습니다.");
      if (!loadMore) {
        setMessages([]);
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  // 메시지 전송 (WebSocket 사용)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !isConnected) return;

    const messageContent = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      // 낙관적 업데이트: 전송한 메시지를 즉시 화면에 표시
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        chatRoomId: currentChatRoomId || "",
        senderId: user?.id || "",
        content: messageContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: user?.id || "",
          name: user?.name || "",
          email: user?.email || "",
          picture: user?.picture || null,
        },
      };
      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      // WebSocket으로 메시지 전송
      wsClientRef.current.sendMessage(
        messageContent,
        currentChatRoomId,
        chatType
      );
    } catch (error: any) {
      console.error("메시지 전송 실패:", error);
      const errorMessage = error.message || "메시지 전송에 실패했습니다.";
      alert(errorMessage);
      setNewMessage(messageContent); // 실패 시 입력 내용 복원
      setError(errorMessage);
      // 낙관적 업데이트 롤백
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
    } finally {
      setIsSending(false);
    }
  };

  // 메시지 삭제
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("메시지를 삭제하시겠습니까?")) return;

    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error("메시지 삭제 실패:", error);
      alert("메시지 삭제에 실패했습니다.");
    }
  };

  // 스크롤을 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 더 많은 메시지 로드
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      fetchMessages(true);
    }
  };

  // 팀원 목록 조회
  const fetchTeamMembers = async () => {
    try {
      const members = await getTeamMembers();
      // 본인을 가장 앞에 추가
      if (user) {
        const currentUserMember: TeamMember = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
        // 본인이 이미 목록에 있으면 제거하고 맨 앞에 추가
        const otherMembers = members.filter(
          (m: TeamMember) => m.id !== user.id
        );
        setTeamMembers([currentUserMember, ...otherMembers]);
      } else {
        setTeamMembers(members);
      }
    } catch (error) {
      console.error("팀원 목록 조회 실패:", error);
      setTeamMembers([]);
    }
  };

  // 참여자 클릭 핸들러
  const handleMemberClick = async (memberId: string, memberName: string) => {
    if (!isConnected) {
      alert("WebSocket 연결이 필요합니다. 잠시만 기다려주세요.");
      return;
    }

    if (memberId === user?.id) {
      // 본인 클릭 시 팀 채팅으로
      // 기존 채팅방에서 나가기
      if (currentChatRoomId) {
        wsClientRef.current.leaveRoom(currentChatRoomId);
      }

      // 상태 변경
      setChatType("TEAM");
      setSelectedUserId(null);
      setSelectedUserName(null);
      setCurrentChatRoomId(null);

      // 메시지 초기화 및 팀 채팅방 로드
      setMessages([]);
      try {
        const teamRoom = await getChatRoom();
        setCurrentChatRoomId(teamRoom.id);
        await fetchMessages(false, teamRoom.id, "TEAM");
        // WebSocket으로 팀 채팅방 참여
        wsClientRef.current.joinRoom("", "TEAM");
      } catch (error) {
        console.error("팀 채팅방 로드 실패:", error);
      }
    } else {
      // 다른 사용자 클릭 시 개인 채팅
      try {
        // 기존 채팅방에서 나가기
        if (currentChatRoomId) {
          wsClientRef.current.leaveRoom(currentChatRoomId);
        }

        // 개인 채팅방 생성/조회
        const room = await getDirectChatRoom(memberId);

        // 상태 변경
        setChatType("DIRECT");
        setSelectedUserId(memberId);
        setSelectedUserName(memberName);
        setCurrentChatRoomId(room.id);

        // 메시지 초기화 및 개인 채팅방 로드
        setMessages([]);
        await fetchMessages(false, room.id, "DIRECT");

        // WebSocket으로 개인 채팅방 참여
        wsClientRef.current.joinRoom(room.id, "DIRECT");
      } catch (error: any) {
        console.error("개인 채팅방 생성 실패:", error);
        alert(error.message || "개인 채팅방을 생성하는데 실패했습니다.");
      }
    }
  };

  // WebSocket 연결 및 메시지 수신 설정
  useEffect(() => {
    if (!token) {
      console.log("⚠️ 사용자 토큰이 없습니다.");
      return;
    }

    if (!user) {
      console.log("⚠️ 사용자 정보가 없습니다.");
      return;
    }

    const wsClient = wsClientRef.current;

    // 연결 성공 핸들러
    wsClient.onConnect(() => {
      console.log("✅ WebSocket 연결됨");
      setIsConnected(true);
      setError(null);
    });

    // 연결 종료 핸들러
    wsClient.onDisconnect(() => {
      console.log("🔌 WebSocket 연결 종료");
      setIsConnected(false);
    });

    // 에러 핸들러
    wsClient.onError((error) => {
      console.error("❌ WebSocket 에러:", error);
      setError(
        error.message ||
          "연결 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요."
      );
      setIsConnected(false);
    });

    // 메시지 수신 핸들러
    wsClient.onMessage((message) => {
      console.log("📨 WebSocket 메시지:", message.type, message);
      if (message.type === "message" && message.data) {
        // 새 메시지 수신
        const newMsg = message.data as Message;

        // 현재 채팅방의 메시지만 표시 (ref를 사용하여 최신 상태 확인)
        const currentRoomId = currentChatRoomIdRef.current;
        const currentType = chatTypeRef.current;

        // 현재 채팅방의 메시지만 표시
        const isCurrentRoomMessage =
          (currentType === "TEAM" &&
            (!currentRoomId || newMsg.chatRoomId === currentRoomId)) || // 팀 채팅방
          (currentType === "DIRECT" && newMsg.chatRoomId === currentRoomId); // 개인 채팅방

        if (!isCurrentRoomMessage) {
          console.log("📨 다른 채팅방 메시지 무시:", {
            메시지채팅방: newMsg.chatRoomId,
            현재채팅방: currentRoomId,
            채팅방타입: currentType,
          });
          return;
        }

        setMessages((prev) => {
          // 중복 방지: 이미 있는 메시지는 추가하지 않음
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }
          // 임시 메시지 제거 (서버에서 받은 실제 메시지로 교체)
          const filtered = prev.filter((m) => !m.id.startsWith("temp-"));
          return [...filtered, newMsg];
        });
        scrollToBottom();
      } else if (message.type === "error") {
        console.error("❌ 서버 오류:", message.message);
        setError(message.message || "오류가 발생했습니다.");
      } else if (message.type === "joined") {
        console.log("✅ 채팅방 참여 완료:", message.roomId);
        // 팀 채팅방의 경우 roomId를 상태에 저장
        if (chatType === "TEAM" && message.roomId && !currentChatRoomId) {
          setCurrentChatRoomId(message.roomId);
        }
      } else if (message.type === "message_sent") {
        console.log("✅ 메시지 전송 확인:", message.messageId);
      } else if (message.type === "connected") {
        console.log("✅ WebSocket 연결 확인:", message.message);
        setIsConnected(true);
      }
    });

    // WebSocket 연결 (핸들러 등록 후)
    console.log("🔌 WebSocket 연결 시작...");
    wsClient.connect(token);

    // 컴포넌트 언마운트 시 연결 종료
    return () => {
      console.log("🔌 WebSocket 연결 종료 (컴포넌트 언마운트)");
      wsClient.disconnect();
    };
  }, [token, user]);

  // 초기 메시지 로드 및 팀원 목록 조회
  useEffect(() => {
    if (user) {
      fetchTeamMembers();
    }
  }, [user]);

  // 초기 로드 시 팀 채팅방 설정 (handleMemberClick에서 처리하지 않는 경우만)
  useEffect(() => {
    if (!user || !isConnected) return;
    // 이미 채팅방이 설정되어 있으면 스킵 (handleMemberClick에서 처리됨)
    if (currentChatRoomId || chatType !== "TEAM") return;

    const loadTeamChat = async () => {
      try {
        const teamRoom = await getChatRoom();
        setCurrentChatRoomId(teamRoom.id);
        await fetchMessages(false, teamRoom.id, "TEAM");
        wsClientRef.current.joinRoom("", "TEAM");
      } catch (error) {
        console.error("팀 채팅방 로드 실패:", error);
      }
    };

    loadTeamChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isConnected]);

  // 새 메시지가 추가되면 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 스크롤 위치에 따라 더 많은 메시지 로드
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMore && !isLoading) {
        const previousScrollHeight = container.scrollHeight;
        handleLoadMore();
        // 스크롤 위치 유지
        setTimeout(() => {
          container.scrollTop = container.scrollHeight - previousScrollHeight;
        }, 0);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading]);

  if (!user?.teamName) {
    return (
      <AppLayout
        activeMenu={activeMenu}
        onMenuClick={handleLeftMenu}
        sidebarVariant="default"
      >
        <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
          <p className="text-gray-600">팀에 가입되어 있지 않습니다.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      activeMenu={activeMenu}
      onMenuClick={handleLeftMenu}
      sidebarVariant="default"
    >
      <div className="bg-white rounded-3xl shadow-sm flex flex-col h-[calc(100vh-200px)]">
        {/* 채팅 헤더 */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap">
              {chatType === "TEAM"
                ? "팀 채팅"
                : selectedUserName
                  ? `${selectedUserName}님과의 채팅`
                  : "개인 채팅"}
            </h2>
            {/* 참여자 목록 */}
            <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide">
              {teamMembers.length > 0 ? (
                teamMembers.map((member) => {
                  const isCurrentUser = member.id === user?.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleMemberClick(member.id, member.name)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 transition-colors ${
                        isCurrentUser
                          ? "bg-[#7F55B1] text-white shadow-sm"
                          : selectedUserId === member.id
                            ? "bg-[#7F55B1] text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCurrentUser
                            ? "bg-white/20 text-white"
                            : "bg-[#7F55B1] text-white"
                        }`}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{member.name}</span>
                    </button>
                  );
                })
              ) : (
                <span className="text-sm text-gray-400">로딩 중...</span>
              )}
            </div>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                연결 중... 잠시만 기다려주세요.
                <br />
                <span className="text-xs text-yellow-600">
                  백엔드 서버가 실행 중인지 확인해주세요. (브라우저 콘솔에서
                  오류 확인)
                </span>
              </p>
            </div>
          )}

          {isLoading && messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p>메시지를 불러오는 중...</p>
            </div>
          )}

          {!isLoading && messages.length === 0 && !error && (
            <div className="text-center text-gray-500 py-8">
              <p>아직 메시지가 없습니다.</p>
              <p className="text-sm mt-2">첫 메시지를 보내보세요!</p>
            </div>
          )}

          {hasMore && messages.length > 0 && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                className="text-sm text-[#7F55B1] hover:underline"
                disabled={isLoading}
              >
                {isLoading ? "로딩 중..." : "이전 메시지 더보기"}
              </button>
            </div>
          )}

          {messages.map((message) => {
            const isOwnMessage = message.senderId === user?.id;
            const senderName = message.sender?.name || "알 수 없음";
            const senderPicture = message.sender?.picture;

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* 프로필 이미지 */}
                <div className="flex-shrink-0">
                  {senderPicture ? (
                    <Image
                      src={senderPicture}
                      alt={senderName}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#7F55B1] flex items-center justify-center text-white font-medium">
                      {senderName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* 메시지 내용 */}
                <div
                  className={`flex flex-col max-w-[70%] ${
                    isOwnMessage ? "items-end" : "items-start"
                  }`}
                >
                  {!isOwnMessage && (
                    <span className="text-xs text-gray-500 mb-1">
                      {senderName}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isOwnMessage
                        ? "bg-[#7F55B1] text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(message.createdAt)}
                    </span>
                    {isOwnMessage && (
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 메시지 입력 */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-gray-200 p-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || !isConnected}
              className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isConnected ? "연결 중..." : isSending ? "전송 중..." : "전송"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default ChatPage;
