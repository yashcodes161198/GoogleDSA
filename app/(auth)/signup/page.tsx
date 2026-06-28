import { AuthForm } from "@/components/AuthForm";
import { redirectIfAuthenticated } from "@/lib/auth";
import { BookOpen } from "lucide-react";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="mb-8 flex items-center gap-2 text-2xl font-bold">
        <BookOpen className="h-7 w-7 text-blue-600" />
        Google DSA Prep
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
