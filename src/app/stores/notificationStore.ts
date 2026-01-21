import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationState {
  hasNewMessage: boolean;
  setHasNewMessage: (hasNew: boolean) => void;
  clearNewMessage: () => void;
  hasPendingLeaveRequest: boolean;
  setHasPendingLeaveRequest: (hasNew: boolean) => void;
  clearPendingLeaveRequest: () => void;
  pendingLeaveRequestCount: number;
  setPendingLeaveRequestCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      hasNewMessage: false,
      setHasNewMessage: (hasNew: boolean) => set({ hasNewMessage: hasNew }),
      clearNewMessage: () => set({ hasNewMessage: false }),
      hasPendingLeaveRequest: false,
      setHasPendingLeaveRequest: (hasNew: boolean) =>
        set({ hasPendingLeaveRequest: hasNew }),
      clearPendingLeaveRequest: () =>
        set({ hasPendingLeaveRequest: false, pendingLeaveRequestCount: 0 }),
      pendingLeaveRequestCount: 0,
      setPendingLeaveRequestCount: (count: number) =>
        set({ pendingLeaveRequestCount: count }),
    }),
    {
      name: "notification-storage",
    }
  )
);
