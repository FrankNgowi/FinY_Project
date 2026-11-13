import { BrandHeader } from "@/components/BrandHeader";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6">
          <BrandHeader />
        </div>
        <h1 className="text-2xl font-bold text-ink">Create account</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Doctor accounts only. Patients register in the Dikonekti mobile app.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
