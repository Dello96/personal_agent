"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  Notification,
} from "@/lib/api/notifications";
import { formatRelativeTime } from "@/lib/utils/dateFormat";

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ limit: 50 });
      setNotifications(data);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("알림 조회 실패:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    const handler = () => loadNotifications();
    window.addEventListener("notification_update", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification_update", handler);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = filterUnread
      ? notifications.filter((n) => !n.isRead)
      : notifications;

    const searched = term
      ? base.filter((n) => {
          const target = `${n.title} ${n.message ?? ""}`.toLowerCase();
          return target.includes(term);
        })
      : base;

    const sorted = [...searched].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === "new" ? bTime - aTime : aTime - bTime;
    });

    return sorted;
  }, [notifications, filterUnread, searchTerm, sortOrder]);

  const handleRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, isRead: true } : item
        )
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("알림 읽음 처리 실패:", error);
      }
    }
  };

  const handleOpen = async () => {
    setOpen((v) => !v);
    if (!open) {
      await loadNotifications();
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("전체 읽음 실패:", error);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
        aria-label="알림"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 text-xs bg-red-500 text-white rounded-full px-2 py-0.5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">알림</h4>
              <button
                onClick={handleMarkAll}
                className="text-xs text-[#7F55B1] hover:text-[#6B479A]"
              >
                모두 읽음
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="알림 검색"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "new" | "old")}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="new">최신순</option>
                <option value="old">오래된순</option>
              </select>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setFilterUnread(false)}
                className={`text-xs px-2 py-1 rounded-full ${
                  !filterUnread
                    ? "bg-[#7F55B1] text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setFilterUnread(true)}
                className={`text-xs px-2 py-1 rounded-full ${
                  filterUnread
                    ? "bg-[#7F55B1] text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                미읽음
              </button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-gray-400 text-sm">로딩 중...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-gray-400 text-sm">
                표시할 알림이 없습니다.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filtered.map((n) => (
                  <li
                    key={n.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      n.isRead ? "" : "bg-purple-50/50"
                    }`}
                    onClick={() => {
                      handleRead(n);
                      if (n.link) router.push(n.link);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                      </div>
                      {!n.isRead && (
                        <span className="text-[10px] text-white bg-[#7F55B1] px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-2">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
