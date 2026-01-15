"use client";

import Sidebar, { SidebarVariant } from "./Sidebar";
import AppHeader, { AppHeaderProps } from "./AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
  sidebarVariant?: SidebarVariant;
  headerProps?: AppHeaderProps;
}

export default function AppLayout({
  children,
  activeMenu,
  onMenuClick,
  sidebarVariant = "default",
  headerProps,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex">
      {/* 좌측 사이드바 */}
      <Sidebar
        activeMenu={activeMenu}
        onMenuClick={onMenuClick}
        variant={sidebarVariant}
      />

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 overflow-auto">
        {/* 상단바 */}
        <AppHeader {...headerProps} />

        {/* 컨텐츠 */}
        {children}
      </main>
    </div>
  );
}

