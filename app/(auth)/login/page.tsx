import { isLocalMode } from "@/lib/config";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { redirectIfAuthenticated } from "@/lib/auth";
import { BookOpen } from "lucide-react";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (isLocalMode()) {
    redirect("/dashboard");
  }

  await redirectIfAuthenticated();
  const { error } = await searchParams;

  return (
    <div className="auth-layout">
      <div className="brand">
        <BookOpen className="h-7 w-7 text-blue-600" />
        Google DSA Prep
      </div>
      <AuthForm mode="login" initialError={error === "auth" ? "Google sign-in could not be completed. Please try again." : null} />
    </div>
  );
}
