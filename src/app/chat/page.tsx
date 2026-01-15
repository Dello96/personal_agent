"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import { useAuthStore } from "@/app/stores/authStore";
import {
  getMessages,
  sendMessage,
  Message,
  deleteMessage,
} from "@/lib/api/chat";
import { formatRelativeTime } from "@/lib/utils/dateFormat";
import Image from "next/image";
import { getTeamMembers, TeamMember } from "@/lib/api/users";

const ChatPage = () => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // 메시지 목록 조회
  const fetchMessages = async (loadMore = false) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await getMessages(50, loadMore ? nextCursor || undefined : undefined);
      
      if (loadMore) {
        setMessages((prev) => [...response.messages, ...prev]);
      } else {
        setMessages(response.messages);
      }
      
      setHasMore(response.hasMore);
      setNextCursor(response.nextCursor);
    } catch (error: any) {
      console.error("메시지 조회 실패:", error);
      setError(error.message || "메시지를 불러오는데 실패했습니다.");
      // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록
      if (!loadMore) {
        setMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지 전송
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      await sendMessage(messageContent);
      // 메시지 전송 후 목록 새로고침
      await fetchMessages(false);
      scrollToBottom();
    } catch (error: any) {
      console.error("메시지 전송 실패:", error);
      const errorMessage = error.message || "메시지 전송에 실패했습니다.";
      alert(errorMessage);
      setNewMessage(messageContent); // 실패 시 입력 내용 복원
      setError(errorMessage);
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
        const otherMembers = members.filter((m) => m.id !== user.id);
        setTeamMembers([currentUserMember, ...otherMembers]);
      } else {
        setTeamMembers(members);
      }
    } catch (error) {
      console.error("팀원 목록 조회 실패:", error);
      setTeamMembers([]);
    }
  };

  // 초기 메시지 로드 및 폴링 설정
  useEffect(() => {
    fetchMessages(false);
    fetchTeamMembers();

    // 3초마다 새 메시지 확인 (폴링)
    pollIntervalRef.current = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [user]);

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
          container.scrollTop =
            container.scrollHeight - previousScrollHeight;
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
              팀 채팅
            </h2>
            {/* 참여자 목록 */}
            <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide">
              {teamMembers.length > 0 ? (
                teamMembers.map((member) => {
                  const isCurrentUser = member.id === user?.id;
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 ${
                        isCurrentUser
                          ? "bg-[#7F55B1] text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
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
                    </div>
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
              disabled={!newMessage.trim() || isSending}
              className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? "전송 중..." : "전송"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default ChatPage;
