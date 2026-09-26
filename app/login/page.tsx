import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Suspense fallback={<div className="h-96 w-96 animate-pulse rounded-2xl bg-surface" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
