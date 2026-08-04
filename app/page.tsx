import { redirect } from "next/navigation";
import { isLocalMode } from "@/lib/config";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  if (isLocalMode()) {
    redirect("/dashboard");
  }

  const user = await getUser();
  if (user) redirect("/dashboard");
  redirect("/login");
}
