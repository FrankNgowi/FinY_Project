import Link from "next/link";
import { BrandHeader } from "@/components/BrandHeader";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6">
          <BrandHeader asHeading />
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted">
          New doctor?{" "}
          <Link href="/register" className="font-semibold text-steel underline underline-offset-2">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
