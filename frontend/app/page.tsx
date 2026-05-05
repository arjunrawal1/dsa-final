import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";
import { AuthCard } from "@/components/auth";
export default async function Home() {
  // Check if user is authenticated
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-muted/40 p-4">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            NCSSM Food Ordering
          </h1>
          <p className="text-muted-foreground">
            Sign in to order food!
          </p>
        </div>

        <AuthCard />
      </main>
    );
  }


  return (
    <>
      <p>Logged in as {session.user.email}</p>

      {/* Display user info (name, email, etc.) */}
      <h1>User Profile</h1>
      <pre>{JSON.stringify(session.user, null, 2)}</pre>

      {/* Ends the session and redirects to Auth0 to log out */}
      <a href="/auth/logout">Logout</a>
    </>
  );
}
