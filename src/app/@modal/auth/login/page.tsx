import Modal from "@/app/components/ui/Modal";
import LoginContent from "@/app/components/features/auth/LoginContent";

export default function LoginModalPage() {
  return (
    <Modal>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">로그인</h2>
        <LoginContent />
      </div>
    </Modal>
  );
}
