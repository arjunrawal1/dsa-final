"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type PaymentMethod = "cash" | "venmo" | "paypal" | "zelle" | "other";
type PaymentTiming = "before" | "after";

const HANDLE_LABELS: Partial<Record<PaymentMethod, string>> = {
  venmo:  "Venmo @handle",
  paypal: "PayPal email or @handle",
  zelle:  "Zelle phone or email",
  other:  "Payment details",
};

export default function NewGroupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("venmo");
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>("before");
  const [paymentHandle, setPaymentHandle] = useState("");
  const [notes, setNotes] = useState("");

  const needsHandle = paymentMethod !== "cash";

  async function handleSubmit() {
    setError(null);

    if (!restaurant.trim()) return setError("Restaurant name is required.");
    if (!orderBy) return setError("Order-by time is required.");
    if (!arrivalTime) return setError("Estimated arrival time is required.");

    const orderByDate = new Date(orderBy);
    const arrivalDate = new Date(arrivalTime);

    if (isNaN(orderByDate.getTime())) return setError("Invalid order deadline.");
    if (isNaN(arrivalDate.getTime())) return setError("Invalid arrival time.");
    if (orderByDate >= arrivalDate)
      return setError("Order deadline must be before the arrival time.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: restaurant.trim(),
          order_by: orderByDate.toISOString(),
          arrival_time: arrivalDate.toISOString(),
          payment_method: paymentMethod,
          payment_timing: paymentTiming,
          payment_handle: needsHandle ? paymentHandle.trim() || null : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? "Something went wrong.");
      }

      const { group_id } = await res.json();
      router.push(`/groups/${group_id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-lg mx-auto space-y-6">

        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to groups
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Start a Group Order</CardTitle>
            <CardDescription>
              Fill in the details — people can join and add their items once you create the group.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">

            {/* Restaurant */}
            <div className="space-y-1.5">
              <Label htmlFor="restaurant">Restaurant</Label>
              <Input
                id="restaurant"
                placeholder="e.g. Chipotle, Raising Cane's…"
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
              />
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="order-by">Order deadline</Label>
                <Input
                  id="order-by"
                  type="datetime-local"
                  value={orderBy}
                  onChange={(e) => setOrderBy(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Last moment to add an item</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="arrival">Est. arrival time</Label>
                <Input
                  id="arrival"
                  type="datetime-local"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">When food should arrive</p>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment handle */}
            {needsHandle && (
              <div className="space-y-1.5">
                <Label htmlFor="handle">{HANDLE_LABELS[paymentMethod] ?? "Handle"}</Label>
                <Input
                  id="handle"
                  placeholder={paymentMethod === "venmo" ? "@yourhandle" : ""}
                  value={paymentHandle}
                  onChange={(e) => setPaymentHandle(e.target.value)}
                />
              </div>
            )}

            {/* Payment timing */}
            <div className="space-y-1.5">
              <Label>When do you need payment?</Label>
              <Select
                value={paymentTiming}
                onValueChange={(v) => setPaymentTiming(v as PaymentTiming)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before I place the order</SelectItem>
                  <SelectItem value="after">After food arrives</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="e.g. Minimum order is $20, tip not included, text me when you pay…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : "Create Group"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}