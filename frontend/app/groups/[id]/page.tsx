"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Clock,
  Wallet,
  Users,
  CheckCircle2,
  Circle,
  Lock,
  ShieldCheck,
} from "lucide-react";

type PaymentMethod = "cash" | "venmo" | "paypal" | "zelle" | "other";
type PaymentTiming = "before" | "after";
type GroupStatus = "open" | "locked" | "completed";

interface OrderItem {
  user_id: string;
  user_name: string;
  description: string;
  price: number;
  paid: boolean;
}

interface GroupDetail {
  group_id: string;
  status: GroupStatus;
  restaurant: string;
  leader_id: string;
  leader_name: string;
  order_by: string;
  arrival_time: string;
  payment_method: PaymentMethod;
  payment_timing: PaymentTiming;
  payment_handle: string | null;
  members: { user_id: string; user_name: string }[];
  orders: OrderItem[];
  current_user_id: string;   // injected by the API from the session
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

const STATUS_BADGE: Record<GroupStatus, { label: string; className: string }> = {
  open:      { label: "Open",      className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  locked:    { label: "Locked",    className: "bg-amber-100 text-amber-800 border-amber-300" },
  completed: { label: "Completed", className: "bg-zinc-100 text-zinc-600 border-zinc-300" },
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // order form state
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // leader actions
  const [locking, setLocking] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/groups/${id}`);
    if (!res.ok) { router.push("/groups"); return; }
    const data = await res.json();
    setGroup(data);
    // pre-fill order form if user already has one
    const existing = data.orders.find((o: OrderItem) => o.user_id === data.current_user_id);
    if (existing) {
      setDescription(existing.description);
      setPrice(String(existing.price));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleSubmitOrder() {
    setOrderError(null);
    if (!description.trim()) return setOrderError("Please describe your order.");
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setOrderError("Enter a valid price.");

    setSubmittingOrder(true);
    try {
      const res = await fetch(`/api/groups/${id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), price: parsedPrice }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit order.");
      }
      await load();
    } catch (e: any) {
      setOrderError(e.message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handleLock() {
    setLocking(true);
    await fetch(`/api/groups/${id}/lock`, { method: "POST" });
    await load();
    setLocking(false);
  }

  async function handleComplete() {
    setCompleting(true);
    await fetch(`/api/groups/${id}/complete`, { method: "POST" });
    await load();
    setCompleting(false);
  }

  async function handleMarkPaid(userId: string) {
    await fetch(`/api/groups/${id}/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-muted/40 p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!group) return null;

  const isLeader = group.current_user_id === group.leader_id;
  const isOpen = group.status === "open";
  const isLocked = group.status === "locked";
  const myOrder = group.orders.find((o) => o.user_id === group.current_user_id);
  const mins = minutesUntil(group.order_by);
  const urgent = isOpen && mins <= 10 && mins > 0;
  const { label: statusLabel, className: statusClass } = STATUS_BADGE[group.status];
  const total = group.orders.reduce((sum, o) => sum + o.price, 0);

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to groups
        </Link>

        {/* Header card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{group.restaurant}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  led by <span className="font-medium text-foreground">{group.leader_name}</span>
                </p>
              </div>
              <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <div>
                  <p className={`font-medium ${urgent ? "text-red-600" : "text-foreground"}`}>
                    {isOpen
                      ? mins > 0
                        ? urgent ? `⚠ ${mins} min left to order` : `Order by ${fmt(group.order_by)}`
                        : "Order window closed"
                      : `Ordered by ${fmt(group.order_by)}`}
                  </p>
                  <p className="text-xs">Arrives ~{fmt(group.arrival_time)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {group.payment_method}
                    {group.payment_handle && ` · ${group.payment_handle}`}
                  </p>
                  <p className="text-xs">Pay {group.payment_timing} ordering</p>
                </div>
              </div>
            </div>

            {/* Leader actions */}
            {isLeader && (
              <>
                <Separator />
                <div className="flex gap-2 flex-wrap">
                  {isOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleLock}
                      disabled={locking}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {locking ? "Locking…" : "Lock & Place Order"}
                    </Button>
                  )}
                  {isLocked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleComplete}
                      disabled={completing}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {completing ? "Completing…" : "Mark as Delivered"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Order form — only shown if group is open */}
        {isOpen && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {myOrder ? "Update Your Order" : "Add Your Order"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="item">What do you want?</Label>
                <Input
                  id="item"
                  placeholder="e.g. Chicken burrito bowl, no sour cream"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="max-w-[140px]"
                />
              </div>
              {group.payment_timing === "before" && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  💸 The leader needs payment <strong>before</strong> placing the order.
                  {group.payment_handle && ` Send to ${group.payment_handle} via ${group.payment_method}.`}
                </p>
              )}
              {orderError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {orderError}
                </p>
              )}
              <Button onClick={handleSubmitOrder} disabled={submittingOrder}>
                {submittingOrder ? "Saving…" : myOrder ? "Update Order" : "Submit Order"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Members & orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Orders ({group.orders.length}/{group.members.length})
              </CardTitle>
              {group.orders.length > 0 && (
                <span className="text-sm font-medium text-muted-foreground">
                  Total: ${total.toFixed(2)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.members.map((member) => {
              const order = group.orders.find((o) => o.user_id === member.user_id);
              const isCurrentUser = member.user_id === group.current_user_id;
              return (
                <div
                  key={member.user_id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${
                    isCurrentUser ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {order ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">
                        {member.user_name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>
                        )}
                      </span>
                      {order && (
                        <p className="text-muted-foreground text-xs truncate">{order.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {order && (
                      <span className="text-muted-foreground">${order.price.toFixed(2)}</span>
                    )}
                    {/* Leader can mark payments */}
                    {isLeader && order && (
                      order.paid ? (
                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50">
                          Paid
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleMarkPaid(member.user_id)}
                        >
                          Mark paid
                        </Button>
                      )
                    )}
                    {/* Non-leader sees their own paid status */}
                    {!isLeader && isCurrentUser && order && (
                      order.paid ? (
                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50">
                          Paid ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                          Unpaid
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {group.members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members yet.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}