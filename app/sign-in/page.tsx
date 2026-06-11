import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInWithGoogleButton } from "@/components/auth-controls";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="grid two">
      <section className="panel">
        <p className="eyebrow">Team access</p>
        <h1>Sign in to The Slop Cannon</h1>
        <p className="muted">
          Use your team Google account. New users are created as members; owners/admins can adjust roles in the database for now.
        </p>
        <div className="split-actions">
          <SignInWithGoogleButton />
        </div>
      </section>
      <aside className="panel">
        <h2>Setup needed</h2>
        <p className="muted">
          Hosting requires `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and the correct callback URL in Google Cloud.
        </p>
      </aside>
    </div>
  );
}
