import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "owner" && user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}

export async function requireOwner() {
  const user = await requireUser();

  if (user.role !== "owner") {
    redirect("/admin");
  }

  return user;
}
