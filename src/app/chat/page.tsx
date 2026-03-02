"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import { useAuthStore } from "@/app/stores/authStore";
import {
  getMessages,
  Message,
  deleteMessage,
  getDirectChatRoom,
  getChatRoom,
  uploadChatFiles,
} from "@/lib/api/chat";
import { formatRelativeTime } from "@/lib/utils/dateFormat";
import Image from "next/image";
import { TeamMember } from "@/lib/api/users";
import { getCurrentTeamMembers } from "@/lib/api/team";
import { chatWebSocketClient } from "@/lib/websocket/chatClient";
import { useNotificationStore } from "@/app/stores/notificationStore";
import {
  markChatRoomNotificationsRead,
  getChatUnreadCounts,
} from "@/lib/api/notifications";
import { getLinkPreview } from "@/lib/api/links";

const ChatPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<
    Array<{
      url: string;
      type: "image" | "video";
      name?: string;
      size?: number;
    }>
  >([]);
  const [attachedPreviews, setAttachedPreviews] = useState<
    Array<{ url: string; type: "image" | "video"; name: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [imageModal, setImageModal] = useState<{
    url: string;
    name?: string;
  } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chatType, setChatType] = useState<"TEAM" | "DIRECT">("TEAM");
  const [currentChatRoomId, setCurrentChatRoomId] = useState<string | null>(
    null
  );
  const [teamChatRoomId, setTeamChatRoomId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [directRoomIds, setDirectRoomIds] = useState<Record<string, string>>(
    {}
  );
  const [unreadByRoomId, setUnreadByRoomId] = useState<Record<string, number>>(
    {}
  );

  const queryRoomId = searchParams.get("roomId");
  const queryType = searchParams.get("type") as "TEAM" | "DIRECT" | null;
  const queryUserId = searchParams.get("userId");
  const resolvedDirectName = useMemo(() => {
    if (!queryUserId) return null;
    const found = teamMembers.find((m) => m.id === queryUserId);
    return found?.name ?? null;
  }, [teamMembers, queryUserId]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wsClientRef = useRef(chatWebSocketClient);
  const currentChatRoomIdRef = useRef<string | null>(null);
  const chatTypeRef = useRef<"TEAM" | "DIRECT">("TEAM");
  const setHasNewMessage = useNotificationStore(
    (state) => state.setHasNewMessage
  );
  const clearNewMessage = useNotificationStore(
    (state) => state.clearNewMessage
  );

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
    } else if (menu === "팀 관리") {
      router.push("/manager/team");
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
    const messageContent = newMessage.trim();
    if (
      (!messageContent && attachedFiles.length === 0) ||
      isSending ||
      !isConnected
    )
      return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = messageContent.match(urlRegex) || [];

    let attachmentsPayload = uploadedAttachments;
    if (attachedFiles.length > 0 && uploadedAttachments.length === 0) {
      try {
        setIsUploading(true);
        const uploadResult = await uploadChatFiles(attachedFiles);
        attachmentsPayload = uploadResult.files;
        setUploadedAttachments(uploadResult.files);
      } catch (error: any) {
        console.error("첨부파일 업로드 실패:", error);
        alert(error.message || "첨부파일 업로드에 실패했습니다.");
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const linkPreviews = [];
    for (const url of urls.slice(0, 3)) {
      try {
        const preview = await getLinkPreview(url);
        linkPreviews.push(preview);
      } catch (previewError) {
        linkPreviews.push({ url });
      }
    }

    // 낙관적 업데이트: 전송한 메시지를 즉시 화면에 표시
    const tempMessage: Message = {
      id: tempId,
      chatRoomId: currentChatRoomId || "",
      senderId: user?.id || "",
      content: messageContent,
      clientMessageId: tempId,
      attachments: attachmentsPayload.length > 0 ? attachmentsPayload : null,
      links: linkPreviews.length > 0 ? linkPreviews : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || "",
        picture: user?.picture || null,
      },
    };

    // 즉시 메시지 추가 및 스크롤
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    setIsSending(true);

    // 스크롤을 다음 프레임에서 실행 (상태 업데이트 후)
    setTimeout(() => {
      scrollToBottom();
    }, 0);

    try {
      // WebSocket으로 메시지 전송
      wsClientRef.current.sendMessage(
        messageContent,
        currentChatRoomId,
        chatType,
        attachmentsPayload.length > 0 ? attachmentsPayload : null,
        linkPreviews.length > 0 ? linkPreviews : null,
        tempId
      );

      // 전송 성공 (서버에서 브로드캐스트된 메시지가 오면 임시 메시지가 자동으로 교체됨)
      setAttachedFiles([]);
      setUploadedAttachments([]);
    } catch (error: any) {
      console.error("메시지 전송 실패:", error);
      const errorMessage = error.message || "메시지 전송에 실패했습니다.";

      // 낙관적 업데이트 롤백: 임시 메시지 제거
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      // 입력 내용 복원
      setNewMessage(messageContent);
      setError(errorMessage);
      alert(errorMessage);
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

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    const nextFiles = Array.from(files);
    setAttachedFiles((prev) => [...prev, ...nextFiles].slice(0, 5));
    setUploadedAttachments([]);
  };

  useEffect(() => {
    const previews = attachedFiles.map((file) => {
      const type: "image" | "video" = file.type.startsWith("video/")
        ? "video"
        : "image";
      return {
        url: URL.createObjectURL(file),
        type,
        name: file.name,
      };
    });
    setAttachedPreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [attachedFiles]);

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const renderMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={`${part}-${idx}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={`${part}-${idx}`}>{part}</span>;
    });
  };

  const normalizeFilename = (name?: string) => {
    if (!name || typeof name !== "string") return "";
    try {
      const bytes = Uint8Array.from(name, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      if (decoded && decoded !== name) {
        return decoded;
      }
    } catch (error) {
      // ignore
    }
    return name;
  };

  const getSafeFilename = (name?: string) => {
    const fallback = "attachment";
    const normalized = normalizeFilename(name) || fallback;
    const trimmed = normalized.trim();
    if (!trimmed) return `${fallback}.jpg`;
    // Windows/URL 금지 문자 제거
    const sanitized = trimmed.replace(/[\\/:*?"<>|]/g, "_");
    return sanitized;
  };

  const handleDownloadImage = async (url: string, name?: string) => {
    try {
      if (!token) {
        throw new Error("인증 정보가 없습니다.");
      }
      const params = new URLSearchParams({
        url,
        name: getSafeFilename(name),
      });
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const response = await fetch(
        `${apiBase}/api/upload/download?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("파일을 불러오는데 실패했습니다.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getSafeFilename(name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("다운로드 실패:", error);
      alert("다운로드에 실패했습니다.");
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
      const members = await getCurrentTeamMembers();
      // 본인을 가장 앞에 추가
      if (user) {
        const currentUserMember: TeamMember = {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture ?? null,
          role: user.role,
          createdAt: user.createdAt ?? new Date().toISOString(),
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

  // 팀원 목록이 바뀌면 개인 채팅방 id 미리 확보 (읽음 배지용)
  useEffect(() => {
    const prefetchDirectRooms = async () => {
      if (!user || teamMembers.length === 0) return;
      try {
        const members = teamMembers.filter((m) => m.id !== user.id);
        const results = await Promise.all(
          members.map(async (m) => {
            const room = await getDirectChatRoom(m.id);
            return [m.id, room.id] as const;
          })
        );
        const map = results.reduce(
          (acc, [userId, roomId]) => {
            acc[userId] = roomId;
            return acc;
          },
          {} as Record<string, string>
        );
        setDirectRoomIds(map);
      } catch (error) {
        console.error("개인 채팅방 프리로드 실패:", error);
      }
    };

    prefetchDirectRooms();
  }, [user, teamMembers]);

  const openTeamChat = async () => {
    if (!isConnected) {
      alert("WebSocket 연결이 필요합니다. 잠시만 기다려주세요.");
      return;
    }

    if (currentChatRoomId) {
      wsClientRef.current.leaveRoom(currentChatRoomId);
    }

    setChatType("TEAM");
    setSelectedUserId(null);
    setSelectedUserName(null);
    setCurrentChatRoomId(null);
    setMessages([]);

    try {
      const teamRoom = await getChatRoom();
      setTeamChatRoomId(teamRoom.id);
      setCurrentChatRoomId(teamRoom.id);
      await fetchMessages(false, teamRoom.id, "TEAM");
      wsClientRef.current.joinRoom("", "TEAM");
    } catch (error) {
      console.error("팀 채팅방 로드 실패:", error);
    }
  };

  const openSelfChat = async () => {
    if (!isConnected || !user) {
      alert("WebSocket 연결이 필요합니다. 잠시만 기다려주세요.");
      return;
    }

    if (currentChatRoomId) {
      wsClientRef.current.leaveRoom(currentChatRoomId);
    }

    try {
      const room = await getDirectChatRoom(user.id);
      setChatType("DIRECT");
      setSelectedUserId(user.id);
      setSelectedUserName("내게 쓰기");
      setCurrentChatRoomId(room.id);
      setMessages([]);
      await fetchMessages(false, room.id, "DIRECT");
      wsClientRef.current.joinRoom(room.id, "DIRECT");
    } catch (error: any) {
      console.error("내게 쓰기 채팅방 생성 실패:", error);
      alert(error.message || "내게 쓰기 채팅방을 생성하는데 실패했습니다.");
    }
  };

  // 참여자 클릭 핸들러
  const handleMemberClick = async (memberId: string, memberName: string) => {
    if (!isConnected) {
      alert("WebSocket 연결이 필요합니다. 잠시만 기다려주세요.");
      return;
    }

    if (currentChatRoomId) {
      wsClientRef.current.leaveRoom(currentChatRoomId);
    }

    try {
      const room = await getDirectChatRoom(memberId);
      setChatType("DIRECT");
      setSelectedUserId(memberId);
      setSelectedUserName(memberName);
      setCurrentChatRoomId(room.id);
      setMessages([]);
      await fetchMessages(false, room.id, "DIRECT");
      wsClientRef.current.joinRoom(room.id, "DIRECT");
    } catch (error: any) {
      console.error("개인 채팅방 생성 실패:", error);
      alert(error.message || "개인 채팅방을 생성하는데 실패했습니다.");
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

    // 전역 연결이 이미 있으면 재연결하지 않음 (AppLayout에서 관리)
    // 채팅 페이지에서는 채팅방 참여/나가기만 처리

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
          // 현재 채팅방이 아니면 알림 표시 (본인이 보낸 메시지가 아닌 경우만)
          if (newMsg.senderId !== user?.id) {
            console.log("🔔 새 메시지 알림 설정");
            setHasNewMessage(true);
          }
          return;
        }

        // 현재 채팅방의 메시지를 받으면 알림 제거
        if (isCurrentRoomMessage && newMsg.senderId !== user?.id) {
          console.log("✅ 현재 채팅방 메시지 수신 - 알림 제거");
          clearNewMessage();
        }

        setMessages((prev) => {
          // 중복 방지: 이미 있는 메시지는 추가하지 않음
          if (prev.some((m) => m.id === newMsg.id)) {
            return prev;
          }

          // 같은 내용의 임시 메시지 찾기 (내가 보낸 메시지인 경우)
          const tempMessageIndex = prev.findIndex((m) => {
            if (!m.id.startsWith("temp-")) return false;
            if (m.senderId !== newMsg.senderId) return false;
            if (newMsg.clientMessageId && m.id === newMsg.clientMessageId) {
              return true;
            }
            const sameContent = m.content === newMsg.content;
            const sameAttachments =
              JSON.stringify(m.attachments || []) ===
              JSON.stringify(newMsg.attachments || []);
            const sameLinks =
              JSON.stringify(m.links || []) ===
              JSON.stringify(newMsg.links || []);
            return sameContent && sameAttachments && sameLinks;
          });

          if (tempMessageIndex !== -1) {
            // 임시 메시지를 실제 메시지로 교체
            const updated = [...prev];
            updated[tempMessageIndex] = newMsg;
            return updated;
          }

          // 임시 메시지가 없으면 새로 추가
          return [...prev, newMsg];
        });

        // 스크롤을 다음 프레임에서 실행
        setTimeout(() => {
          scrollToBottom();
        }, 0);
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

    // WebSocket 연결 (이미 연결되어 있으면 스킵, AppLayout에서 관리)
    if (!wsClient.isConnected()) {
      console.log("🔌 채팅 페이지: WebSocket 연결 시작...");
      wsClient.connect(token);
    } else {
      console.log("🔌 채팅 페이지: 전역 WebSocket 연결 사용");
      setIsConnected(true);
    }

    // 컴포넌트 언마운트 시 연결 종료하지 않음 (전역 연결 유지)
    return () => {};
  }, [token, user]);

  // 팀/개인 채팅방을 실제로 열었을 때 읽음 처리
  useEffect(() => {
    const markChatNotificationsRead = async () => {
      if (!user || !currentChatRoomId) return;
      try {
        await markChatRoomNotificationsRead(currentChatRoomId);
        setUnreadByRoomId((prev) => ({
          ...prev,
          [currentChatRoomId]: 0,
        }));
        // 채팅방을 열었으면 배지는 해제
        clearNewMessage();
        window.dispatchEvent(new CustomEvent("notification_update"));
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("채팅 알림 읽음 처리 실패:", error);
        }
      }
    };

    markChatNotificationsRead();
  }, [user, currentChatRoomId, chatType, clearNewMessage]);

  // 채팅방별 미읽음 개수 동기화
  useEffect(() => {
    const syncUnreadCounts = async () => {
      try {
        const data = await getChatUnreadCounts();
        setUnreadByRoomId(data.counts || {});
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("채팅 미읽음 동기화 실패:", error);
        }
      }
    };

    syncUnreadCounts();
    const handler = () => syncUnreadCounts();
    const interval = setInterval(syncUnreadCounts, 30000);
    window.addEventListener("notification_update", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification_update", handler);
    };
  }, []);

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
        setTeamChatRoomId(teamRoom.id);
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

  // 알림에서 진입한 채팅방 즉시 오픈
  useEffect(() => {
    if (!isConnected || !queryRoomId || !queryType) return;
    const openFromNotification = async () => {
      try {
        if (currentChatRoomId) {
          wsClientRef.current.leaveRoom(currentChatRoomId);
        }

        if (queryType === "TEAM") {
          setChatType("TEAM");
          setSelectedUserId(null);
          setSelectedUserName(null);
          setTeamChatRoomId(queryRoomId);
          setCurrentChatRoomId(queryRoomId);
          setMessages([]);
          await fetchMessages(false, queryRoomId, "TEAM");
          wsClientRef.current.joinRoom("", "TEAM");
        } else {
          setChatType("DIRECT");
          setSelectedUserId(queryUserId);
          setSelectedUserName(
            queryUserId === user?.id ? "내게 쓰기" : resolvedDirectName
          );
          setCurrentChatRoomId(queryRoomId);
          setMessages([]);
          await fetchMessages(false, queryRoomId, "DIRECT");
          wsClientRef.current.joinRoom(queryRoomId, "DIRECT");
        }
      } catch (error) {
        console.error("알림 기반 채팅방 오픈 실패:", error);
      }
    };

    openFromNotification();
  }, [
    isConnected,
    queryRoomId,
    queryType,
    queryUserId,
    resolvedDirectName,
    currentChatRoomId,
  ]);

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

  const isRecentMessageGroup = (
    currentMessage: Message,
    previousMessage: Message | null
  ): boolean => {
    if (!previousMessage) return false;

    const currentTime = new Date(currentMessage.createdAt).getTime();
    const previousTime = new Date(previousMessage.createdAt).getTime();
    const diffMs = currentTime - previousTime;
    const diffMinutes = diffMs / (1000 * 60);

    // 1분 미만이고 같은 사람이 보낸 메시지인 경우
    return (
      diffMinutes < 1 && currentMessage.senderId === previousMessage.senderId
    );
  };

  // 메시지 타입 정의 (그룹 정보 포함)
  type MessageGroup = {
    messages: Message[];
    senderId: string;
    sender: Message["sender"];
    isOwnGroup: boolean;
  };

  // 메시지들을 그룹으로 묶는 함수
  const groupMessages = (
    messages: Message[],
    currentUserId: string
  ): MessageGroup[] => {
    if (messages.length === 0) return [];

    const groups: MessageGroup[] = [];
    let currentGroup: Message[] = [messages[0]];

    for (let i = 1; i < messages.length; i++) {
      const currentMessage = messages[i];
      const previousMessage = messages[i - 1];

      // 같은 사람이 보낸 메시지이고 1분 미만 차이인 경우
      const isGrouped = isRecentMessageGroup(currentMessage, previousMessage);

      if (isGrouped) {
        // 같은 그룹에 추가
        currentGroup.push(currentMessage);
      } else {
        // 현재 그룹을 저장하고 새 그룹 시작
        groups.push({
          messages: currentGroup,
          senderId: currentGroup[0].senderId,
          sender: currentGroup[0].sender,
          isOwnGroup: currentGroup[0].senderId === currentUserId,
        });
        currentGroup = [currentMessage];
      }
    }

    // 마지막 그룹 추가
    if (currentGroup.length > 0) {
      groups.push({
        messages: currentGroup,
        senderId: currentGroup[0].senderId,
        sender: currentGroup[0].sender,
        isOwnGroup: currentGroup[0].senderId === currentUserId,
      });
    }

    return groups;
  };

  return (
    <AppLayout
      activeMenu={activeMenu}
      onMenuClick={handleLeftMenu}
      sidebarVariant="default"
    >
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm flex flex-col min-h-[300px] h-[calc(100vh-10rem)] md:h-[calc(100vh-200px)] w-full min-w-0">
        {/* 채팅 헤더 */}
        <div className="border-b border-gray-200 p-3 md:p-4 space-y-2 md:space-y-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-4 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate">
              {chatType === "TEAM"
                ? "팀 채팅"
                : selectedUserName
                  ? selectedUserName
                  : "개인 채팅"}
            </h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                chatType === "TEAM"
                  ? "bg-blue-50 text-blue-700"
                  : selectedUserId === user?.id
                    ? "bg-violet-50 text-violet-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {chatType === "TEAM"
                ? "팀 채팅"
                : selectedUserId === user?.id
                  ? "내게 쓰기"
                  : "개인 채팅"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openTeamChat}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                chatType === "TEAM"
                  ? "bg-[#7F55B1] text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              팀 채팅
            </button>
            <button
              onClick={openSelfChat}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                chatType === "DIRECT" && selectedUserId === user?.id
                  ? "bg-[#7F55B1] text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {user?.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#7F55B1] text-white flex items-center justify-center text-[10px] font-semibold">
                  {user?.name?.charAt(0) || "나"}
                </div>
              )}
              내게 쓰기
            </button>
            <div className="text-xs text-gray-400 ml-1">개인 채팅</div>
            <div className="flex items-center gap-2 overflow-x-auto flex-1 scrollbar-hide">
              {teamMembers.length > 0 ? (
                teamMembers
                  .filter((member) => member.id !== user?.id)
                  .map((member) => {
                    const roomId = directRoomIds[member.id];
                    const unreadCount = roomId
                      ? unreadByRoomId[roomId] || 0
                      : 0;
                    return (
                      <button
                        key={member.id}
                        onClick={() =>
                          handleMemberClick(member.id, member.name)
                        }
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0 transition-colors ${
                          selectedUserId === member.id
                            ? "bg-[#7F55B1] text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {member.picture ? (
                          <Image
                            src={member.picture}
                            alt={member.name}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#7F55B1] text-white flex items-center justify-center text-xs font-medium">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {member.name}
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
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
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4">
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

          {groupMessages(messages, user?.id || "").map((group, groupIndex) => {
            const isOwnGroup = group.isOwnGroup;
            const senderName = group.sender?.name || "알 수 없음";
            const senderPicture = group.sender?.picture;

            return (
              <div
                key={`group-${groupIndex}-${group.messages[0].id}`}
                className={`flex gap-3 ${
                  isOwnGroup ? "flex-row-reverse" : "flex-row"
                } mt-4`}
              >
                {/* 프로필 이미지 - 그룹의 첫 번째 메시지에만 표시 */}
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

                {/* 메시지 그룹 컨테이너 */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  {/* 그룹 내 첫 번째 메시지에만 이름 표시 */}
                  {!isOwnGroup && (
                    <span className="text-xs text-gray-500 mb-1">
                      {senderName}
                    </span>
                  )}

                  {/* 그룹 내 모든 메시지 렌더링 */}
                  {group.messages.map((message, msgIndex) => {
                    const isLastInGroup =
                      msgIndex === group.messages.length - 1;

                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          isOwnGroup ? "items-end" : "items-start"
                        }`}
                      >
                        {/* 메시지 버블 - 텍스트 길이에 맞게 조절 */}
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            isOwnGroup
                              ? "bg-[#7F55B1] text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                          style={{
                            display: "inline-block",
                            maxWidth: "70%",
                          }}
                        >
                          {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {renderMessageContent(message.content)}
                            </p>
                          )}
                          {message.attachments &&
                            message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((file, fileIdx) => (
                                  <div key={`${message.id}-file-${fileIdx}`}>
                                    {file.type === "image" ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={file.url}
                                        alt={
                                          normalizeFilename(file.name) ||
                                          "attachment"
                                        }
                                        className="max-w-full sm:max-w-[220px] rounded-lg cursor-pointer hover:opacity-90"
                                        onClick={() =>
                                          setImageModal({
                                            url: file.url,
                                            name: normalizeFilename(file.name),
                                          })
                                        }
                                      />
                                    ) : (
                                      <video
                                        src={file.url}
                                        controls
                                        className="max-w-full sm:max-w-[220px] rounded-lg"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          {message.links && message.links.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.links.map((link, linkIdx) => (
                                <a
                                  key={`${message.id}-link-${linkIdx}`}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`block rounded-lg border ${
                                    isOwnGroup
                                      ? "border-white/30"
                                      : "border-gray-200"
                                  } p-3`}
                                >
                                  {link.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={link.image}
                                      alt={link.title || "link preview"}
                                      className="w-full max-w-full sm:max-w-[220px] rounded-md mb-2"
                                    />
                                  )}
                                  <p className="text-sm font-semibold break-words">
                                    {link.title || link.url}
                                  </p>
                                  {link.description && (
                                    <p className="text-xs opacity-80 mt-1 line-clamp-2">
                                      {link.description}
                                    </p>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 시간 표시 - 그룹의 마지막 메시지에만 표시 */}
                        {isLastInGroup && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(message.createdAt)}
                            </span>
                            {isOwnGroup && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="text-xs text-gray-400 hover:text-red-500"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
          {attachedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs"
                >
                  {attachedPreviews[idx]?.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attachedPreviews[idx].url}
                      alt={attachedPreviews[idx].name}
                      className="w-8 h-8 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-gray-300 flex items-center justify-center text-[10px] text-gray-700">
                      VIDEO
                    </div>
                  )}
                  <span className="max-w-[80px] sm:max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg cursor-pointer text-sm text-gray-600 hover:bg-gray-200">
              📎
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
                className="hidden"
              />
            </label>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              disabled={isSending || isUploading}
            />
            <button
              type="submit"
              disabled={
                (!newMessage.trim() && attachedFiles.length === 0) ||
                isSending ||
                isUploading ||
                !isConnected
              }
              className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isConnected
                ? "연결 중..."
                : isUploading
                  ? "업로드 중..."
                  : isSending
                    ? "전송 중..."
                    : "전송"}
            </button>
          </div>
        </form>
      </div>
      {imageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setImageModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm text-gray-700 truncate">
                {imageModal.name || "첨부 이미지"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleDownloadImage(imageModal.url, imageModal.name)
                  }
                  className="text-sm text-[#7F55B1] hover:underline"
                >
                  다운로드
                </button>
                <button
                  onClick={() => setImageModal(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageModal.url}
                alt={imageModal.name || "첨부 이미지"}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ChatPage;
