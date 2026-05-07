"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Clock, Wallet, Users, Plus, UtensilsCrossed, Home } from "lucide-react";

type PaymentMethod = "cash" | "venmo" | "paypal" | "zelle" | "other";
type PaymentTiming = "before" | "after";
type Tab = "all" | "mine";

interface Group {
  group_id: string;
  restaurant: string;
  leader_name: string;
  order_by: string;
  arrival_time: string;
  payment_method: PaymentMethod;
  payment_timing: PaymentTiming;
  payment_handle: string | null;
  member_count: number;
  has_ordered: boolean;
  is_member: boolean;
}

const PAYMENT_COLORS: Record<PaymentMethod, string> = {
  cash:   "bg-emerald-100 text-emerald-800",
  venmo:  "bg-sky-100 text-sky-800",
  paypal: "bg-blue-100 text-blue-800",
  zelle:  "bg-violet-100 text-violet-800",
  other:  "bg-zinc-100 text-zinc-700",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
      <UtensilsCrossed className="w-10 h-10 opacity-40" />
      {tab === "all" ? (
        <>
          <p className="text-lg font-medium">No open groups right now.</p>
          <p className="text-sm">Be the first — start a new one!</p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">You're not in any groups yet.</p>
          <p className="text-sm">Join one from the All Orders tab.</p>
        </>
      )}
    </div>
  );
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleJoin(groupId: string) {
    setJoining(groupId);
    await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
    setJoining(null);
    window.location.href = `/groups/${groupId}`;
  }

  const displayed = tab === "mine" ? groups.filter((g) => g.is_member) : groups;

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Home className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Browse open groups or check your active orders.
              </p>
            </div>
          </div>
          <Link href="/groups/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Group
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["all", "mine"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All Orders" : "My Orders"}
              {t === "mine" && groups.filter((g) => g.is_member).length > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 text-primary text-xs px-1.5 py-0.5">
                  {groups.filter((g) => g.is_member).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {displayed.map((g) => {
              const mins = minutesUntil(g.order_by);
              const urgent = mins <= 10;
              return (
                <Card key={g.group_id} className="overflow-hidden">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">{g.restaurant}</h2>
                      <p className="text-sm text-muted-foreground">
                        led by{" "}
                        <span className="font-medium text-foreground">{g.leader_name}</span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${urgent ? "border-red-400 text-red-600 bg-red-50" : ""}`}
                    >
                      {urgent ? `⚠ ${mins}m left` : `Order by ${fmt(g.order_by)}`}
                    </Badge>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Arrives ~{fmt(g.arrival_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {g.member_count} {g.member_count === 1 ? "person" : "people"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PAYMENT_COLORS[g.payment_method]}`}>
                          {g.payment_method.charAt(0).toUpperCase() + g.payment_method.slice(1)}
                        </span>
                        {g.payment_handle && (
                          <span className="text-xs">{g.payment_handle}</span>
                        )}
                        <span className="text-xs">· pay {g.payment_timing}</span>
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 gap-2">
                    {g.has_ordered ? (
                      <Link href={`/groups/${g.group_id}`} className="w-full">
                        <Button variant="outline" className="w-full">View My Order</Button>
                      </Link>
                    ) : g.is_member ? (
                      <Link href={`/groups/${g.group_id}`} className="w-full">
                        <Button className="w-full">Add Your Order</Button>
                      </Link>
                    ) : (
                      <>
                        <Button
                          className="flex-1"
                          onClick={() => handleJoin(g.group_id)}
                          disabled={joining === g.group_id}
                        >
                          {joining === g.group_id ? "Joining…" : "Join & Order"}
                        </Button>
                        <Link href={`/groups/${g.group_id}`}>
                          <Button variant="outline">Details</Button>
                        </Link>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}