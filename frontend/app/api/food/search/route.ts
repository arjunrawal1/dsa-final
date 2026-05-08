import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const API = process.env.BACKEND_URL ?? "http://localhost:8000";

type FoodItem = {
  image_path?: string | null;
  remote_image_url?: string | null;
  image_url?: string | null;
};

type Restaurant = {
  items?: FoodItem[];
};

export async function GET(req: Request) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const params = new URLSearchParams({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? "18",
    items_per_restaurant: url.searchParams.get("items_per_restaurant") ?? "6",
  });

  const res = await fetch(`${API}/food/search?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await res.json();

  if (Array.isArray(data.restaurants)) {
    data.restaurants = data.restaurants.map((restaurant: Restaurant) => ({
      ...restaurant,
      items: (restaurant.items ?? []).map((item) => ({
        ...item,
        image_url: item.image_path
          ? `${API}${item.image_path}`
          : item.remote_image_url ?? null,
      })),
    }));
  }

  return NextResponse.json(data, { status: res.status });
}
