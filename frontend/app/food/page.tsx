"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Plus, Search, Sparkles, UtensilsCrossed } from "lucide-react";

type FoodItem = {
  item_id: number;
  name: string;
  restaurant: string;
  cuisine: string;
  section: string;
  description: string;
  price: number | null;
  score: number;
  image_url: string | null;
};

type Restaurant = {
  name: string;
  cuisine: string;
  item_count: number;
  items: FoodItem[];
};

type FoodSearchResponse = {
  query: string;
  model_used: boolean;
  model_error: string | null;
  restaurants: Restaurant[];
  error?: string;
};

function priceLabel(price: number | null) {
  if (price == null) return null;
  return price.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function FoodImage({ item }: { item: FoodItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.image_url || failed) {
    return (
      <div className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:w-24">
        <UtensilsCrossed className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt=""
      onError={() => setFailed(true)}
      className="aspect-square w-20 shrink-0 rounded-lg object-cover sm:w-24"
      loading="lazy"
    />
  );
}

export default function FoodPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<FoodSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        q: debouncedQuery,
        limit: "18",
        items_per_restaurant: "5",
      });

      fetch(`/api/food/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((nextData) => setData(nextData))
        .catch((err) => {
          if (err.name !== "AbortError") {
            setData({
              query: debouncedQuery,
              model_used: false,
              model_error: String(err),
              restaurants: [],
            });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [debouncedQuery]);

  const restaurants = data?.restaurants ?? [];

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Nearby Food</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {restaurants.length} {restaurants.length === 1 ? "restaurant" : "restaurants"}
              </p>
            </div>
          </div>

          <Link href="/groups/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Start Group Order
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search biryani, burgers, boba, pizza..."
              className="h-11 rounded-lg pl-9"
            />
          </div>
          {data?.model_used ? (
            <Badge variant="secondary" className="h-8 gap-1.5 rounded-lg px-3">
              <Sparkles className="h-3.5 w-3.5" />
              Model ranked
            </Badge>
          ) : null}
        </div>

        {data?.error ? (
          <div className="rounded-xl border bg-background p-6 text-sm text-destructive">
            {data.error}
          </div>
        ) : null}

        {data?.model_error ? (
          <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            Model embeddings are unavailable, so results are using text search.
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-80 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
            <Search className="h-10 w-10 opacity-40" />
            <p className="text-lg font-medium">No food matched that search.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {restaurants.map((restaurant) => (
              <Card key={restaurant.name} className="min-h-0">
                <CardHeader className="pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold">{restaurant.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {restaurant.cuisine} · {restaurant.item_count} items
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 rounded-lg">
                      {restaurant.cuisine}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {restaurant.items.map((item) => (
                    <div key={item.item_id} className="flex gap-3 border-t pt-3 first:border-t-0 first:pt-0">
                      <FoodImage item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
                            {item.name}
                          </h3>
                          {priceLabel(item.price) ? (
                            <span className="shrink-0 text-sm font-semibold">
                              {priceLabel(item.price)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.section || item.cuisine}
                        </p>
                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
