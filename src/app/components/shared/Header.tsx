import Link from "next/link";

export default function Header() {
  return (
    <header>
      <div className="bg-blue-100 flex flex-row justify-between">
        <h1 className="m-8">Home</h1>
        <div className="bg-red-100 flex flex-row justify-between">
          <Link href="/auth/login" className="m-8">
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
