import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationState {
  hasNewMessage: boolean;
  setHasNewMessage: (hasNew: boolean) => void;
  clearNewMessage: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      hasNewMessage: false,
      setHasNewMessage: (hasNew: boolean) => set({ hasNewMessage: hasNew }),
      clearNewMessage: () => set({ hasNewMessage: false }),
    }),
    {
      name: "notification-storage",
    }
  )
);
