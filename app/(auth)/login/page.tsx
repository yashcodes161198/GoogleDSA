import { AuthForm } from "@/components/AuthForm";
import { BookOpen } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="mb-8 flex items-center gap-2 text-2xl font-bold">
        <BookOpen className="h-7 w-7 text-blue-600" />
        Google DSA Prep
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
