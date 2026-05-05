import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";
import { AuthCard } from "@/components/auth";
export default async function Home() {
  // Check if user is authenticated
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AuthCard />

      </div>
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
