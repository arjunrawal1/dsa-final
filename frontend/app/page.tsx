import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";
import { AuthCard } from "@/components/auth";
import { UtensilsCrossed, PlusCircle, LogOut } from "lucide-react";

const API = process.env.BACKEND_URL ?? "http://localhost:8000";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-8 bg-muted/40 p-4">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            NCSSM Food Ordering
          </h1>
          <p className="text-muted-foreground">Sign in to order food!</p>
        </div>
        <AuthCard />
      </main>
    );
  }

  // Ensure the user exists in MongoDB — safe to call on every page load
  // since the backend uses upsert (no duplicate risk, no counter reset).
  await fetch(`${API}/users/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.user.sub,
    },
    body: JSON.stringify({
      name: session.user.name ?? session.user.email,
      email: session.user.email,
    }),
  });

  const name = session.user.name ?? session.user.email;

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-lg mx-auto space-y-8">

        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              NCSSM Food Ordering
            </h1>
            <p className="text-muted-foreground mt-1">
              Welcome back,{" "}
              <span className="font-medium text-foreground">{name}</span>!
            </p>
          </div>
          <a href="/auth/logout">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </a>
        </div>

        <div className="grid gap-4">
          <Link href="/groups">
            <div className="group flex items-center gap-5 rounded-xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Browse Open Orders</p>
                <p className="text-sm text-muted-foreground">
                  Join a group and add your order before the cutoff.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/groups/new">
            <div className="group flex items-center gap-5 rounded-xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Start a Group Order</p>
                <p className="text-sm text-muted-foreground">
                  Pick a restaurant, set a deadline, and let others join.
                </p>
              </div>
            </div>
          </Link>
        </div>

      </div>
    </main>
  );
}