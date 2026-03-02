"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SIZE_CLASS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export interface ModalProps {
  /** 모달 내용 */
  children: React.ReactNode;
  /** 닫기 콜백. 없으면 라우트 모달일 때 router.back() 사용 */
  onClose?: () => void;
  /** 컨텐츠 박스 추가 클래스 */
  className?: string;
  /**
   * 상태 기반 모달일 때 사용. false면 아무것도 렌더하지 않음.
   * 없으면 항상 렌더 (라우트 모달용).
   */
  open?: boolean;
  /** 컨텐츠 최대 너비: sm(24rem), md(28rem), lg(42rem), xl(56rem). 기본 md */
  size?: keyof typeof SIZE_CLASS;
  /** 우측 상단 X 버튼 표시 여부. 기본 true */
  showCloseButton?: boolean;
}

/**
 * 공통 모달 UI.
 *
 * 1) 라우트 모달 (예: 로그인): open 안 넘김 → 항상 렌더, onClose 없으면 ESC/배경 클릭 시 router.back()
 * 2) 상태 모달 (예: 캘린더): open={isOpen} onClose={handleClose} → open이 true일 때만 렌더
 */
export default function Modal({
  children,
  onClose,
  className = "",
  open = true,
  size = "md",
  showCloseButton = true,
}: ModalProps) {
  const router = useRouter();

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  if (open === false) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`
          relative z-10
          bg-white rounded-lg shadow-xl
          w-full ${SIZE_CLASS[size]} mx-2 sm:mx-4
          max-h-[90vh] overflow-y-auto
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="닫기"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
