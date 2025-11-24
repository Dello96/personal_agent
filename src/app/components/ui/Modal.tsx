"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function Modal({
  children,
  onClose,
  className = "",
}: ModalProps) {
  const router = useRouter();

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    // 스크롤 방지
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back(); // 기본적으로 뒤로가기
    }
  };

  // 배경 클릭으로 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 모달 컨텐츠 */}
      <div
        className={`
          relative z-10 
          bg-white rounded-lg shadow-xl 
          w-full max-w-md mx-4 
          max-h-[90vh] overflow-y-auto
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
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

        {children}
      </div>
    </div>
  );
}
