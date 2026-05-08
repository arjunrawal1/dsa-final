import json
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Optional


TASTE_GRAPH_DIR = Path(__file__).parent / "taste_graph"
TOKEN_RE = re.compile(r"[a-z0-9]+")


class TasteGraph:
    def __init__(self, data_dir: Path = TASTE_GRAPH_DIR):
        self.data_dir = data_dir
        self._items: Optional[list[dict]] = None
        self._search_docs: Optional[list[dict]] = None
        self._restaurant_counts: Optional[dict[str, int]] = None
        self._embeddings = None
        self._model_error: Optional[str] = None

    def search(self, query: str = "", limit: int = 18, items_per_restaurant: int = 6) -> dict:
        self._load_items()

        limit = max(1, min(limit, 40))
        items_per_restaurant = max(1, min(items_per_restaurant, 12))
        query = query.strip()

        if not query:
            return self._browse(limit, items_per_restaurant)

        lexical = self._lexical_scores(query)
        candidates = [score for score in lexical if score[1] > 0]
        if not candidates:
            return {
                "query": query,
                "model_used": False,
                "model_error": None,
                "restaurants": [],
            }

        ranked_items, model_used = self._rank_with_model(candidates, limit * items_per_restaurant * 5)
        restaurants = self._group_by_restaurant(ranked_items, limit, items_per_restaurant)

        return {
            "query": query,
            "model_used": model_used,
            "model_error": self._model_error,
            "restaurants": restaurants,
        }

    def similar_items(self, item_id: int, top_k: int = 10):
        self._load_items()
        embeddings = self._load_embeddings()
        if embeddings is None:
            raise RuntimeError(self._model_error or "Taste graph embeddings are unavailable.")
        if item_id < 0 or item_id >= len(embeddings):
            raise ValueError(f"Unknown item_id '{item_id}'.")

        import numpy as np

        query = embeddings[item_id]
        sims = embeddings @ query
        sims[item_id] = -1
        top_indices = np.argsort(sims)[::-1][:top_k]
        return [self._serialize_item(int(idx), float(sims[idx])) for idx in top_indices]

    def _load_items(self) -> None:
        if self._items is not None:
            return

        data_path = self.data_dir / "processed_items.json"
        with data_path.open() as f:
            items = json.load(f)

        self._items = items
        self._search_docs = []
        counts: dict[str, int] = defaultdict(int)

        for idx, item in enumerate(items):
            restaurant = item.get("restaurant") or "Unknown"
            counts[restaurant] += 1
            fields = [
                item.get("name") or "",
                restaurant,
                item.get("cuisine") or "",
                item.get("section") or "",
                item.get("description") or "",
            ]
            self._search_docs.append(
                {
                    "idx": idx,
                    "name": fields[0].lower(),
                    "restaurant": fields[1].lower(),
                    "cuisine": fields[2].lower(),
                    "section": fields[3].lower(),
                    "description": fields[4].lower(),
                    "all": " ".join(fields).lower(),
                }
            )

        self._restaurant_counts = dict(counts)

    def _load_embeddings(self):
        if self._embeddings is not None or self._model_error is not None:
            return self._embeddings

        try:
            import numpy as np
            import torch

            data = torch.load(
                self.data_dir / "embeddings" / "gnn_embeddings.pt",
                weights_only=False,
                map_location="cpu",
            )
            embeddings = data["item_embeddings"]
            if hasattr(embeddings, "numpy"):
                embeddings = embeddings.numpy()
            embeddings = embeddings.astype("float32")
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            self._embeddings = embeddings / np.clip(norms, 1e-8, None)
        except Exception as exc:
            self._model_error = str(exc)
            self._embeddings = None

        return self._embeddings

    def _browse(self, limit: int, items_per_restaurant: int) -> dict:
        assert self._items is not None

        grouped: dict[str, list[tuple[int, float]]] = defaultdict(list)
        for idx, item in enumerate(self._items):
            restaurant = item.get("restaurant") or "Unknown"
            score = 1.0 if self._image_path(item.get("item_id", idx)).exists() else 0.25
            grouped[restaurant].append((idx, score))

        restaurants = []
        for restaurant in sorted(grouped):
            ranked = sorted(grouped[restaurant], key=lambda pair: pair[1], reverse=True)
            restaurants.append(
                self._restaurant_payload(restaurant, ranked[:items_per_restaurant])
            )
            if len(restaurants) >= limit:
                break

        return {
            "query": "",
            "model_used": False,
            "model_error": None,
            "restaurants": restaurants,
        }

    def _lexical_scores(self, query: str) -> list[tuple[int, float]]:
        assert self._search_docs is not None

        tokens = TOKEN_RE.findall(query.lower())
        if not tokens:
            return []

        scored = []
        full_query = " ".join(tokens)

        for doc in self._search_docs:
            score = 0.0
            if full_query in doc["name"]:
                score += 8.0
            if full_query in doc["restaurant"]:
                score += 6.0
            if full_query in doc["cuisine"]:
                score += 4.0
            if full_query in doc["section"]:
                score += 3.0

            for token in tokens:
                if token in doc["name"]:
                    score += 4.0
                if token in doc["restaurant"]:
                    score += 3.0
                if token in doc["cuisine"]:
                    score += 2.0
                if token in doc["section"]:
                    score += 1.5
                if token in doc["description"]:
                    score += 0.75

            if score > 0:
                scored.append((doc["idx"], score))

        scored.sort(key=lambda pair: pair[1], reverse=True)
        return scored[:250]

    def _rank_with_model(
        self, lexical_candidates: list[tuple[int, float]], max_items: int
    ) -> tuple[list[tuple[int, float]], bool]:
        embeddings = self._load_embeddings()
        if embeddings is None:
            return lexical_candidates[:max_items], False

        import numpy as np

        seed_count = min(16, len(lexical_candidates))
        seed_ids = np.array([idx for idx, _ in lexical_candidates[:seed_count]], dtype=np.int64)
        weights = np.array([score for _, score in lexical_candidates[:seed_count]], dtype=np.float32)
        weights = weights / max(float(weights.sum()), 1e-8)

        query_vec = (embeddings[seed_ids] * weights[:, None]).sum(axis=0)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return lexical_candidates[:max_items], False
        query_vec = query_vec / query_norm

        model_scores = embeddings @ query_vec
        lexical_by_idx = {idx: score for idx, score in lexical_candidates}
        max_lexical = max(lexical_by_idx.values())

        top_model_count = min(len(model_scores), max(max_items * 4, 120))
        top_model_ids = np.argpartition(model_scores, -top_model_count)[-top_model_count:]

        combined = []
        seen = set()
        for idx in top_model_ids.tolist() + [idx for idx, _ in lexical_candidates]:
            if idx in seen:
                continue
            seen.add(idx)
            lexical_score = lexical_by_idx.get(idx, 0.0) / max_lexical
            model_score = (float(model_scores[idx]) + 1.0) / 2.0
            score = (model_score * 0.72) + (lexical_score * 0.28)
            combined.append((idx, score))

        combined.sort(key=lambda pair: pair[1], reverse=True)
        return combined[:max_items], True

    def _group_by_restaurant(
        self, ranked_items: list[tuple[int, float]], limit: int, items_per_restaurant: int
    ) -> list[dict]:
        assert self._items is not None

        grouped: dict[str, list[tuple[int, float]]] = defaultdict(list)
        for idx, score in ranked_items:
            restaurant = self._items[idx].get("restaurant") or "Unknown"
            if len(grouped[restaurant]) < items_per_restaurant:
                grouped[restaurant].append((idx, score))

        restaurant_items = sorted(
            grouped.items(),
            key=lambda entry: max(score for _, score in entry[1]),
            reverse=True,
        )
        return [
            self._restaurant_payload(restaurant, items)
            for restaurant, items in restaurant_items[:limit]
        ]

    def _restaurant_payload(self, restaurant: str, items: list[tuple[int, float]]) -> dict:
        assert self._items is not None
        assert self._restaurant_counts is not None

        first_item = self._items[items[0][0]] if items else {}
        return {
            "name": restaurant,
            "cuisine": first_item.get("cuisine") or "Other",
            "item_count": self._restaurant_counts.get(restaurant, len(items)),
            "items": [
                self._serialize_item(idx, score)
                for idx, score in items
            ],
        }

    def _serialize_item(self, idx: int, score: float) -> dict:
        assert self._items is not None

        item = self._items[idx]
        price = item.get("price")
        if isinstance(price, float) and math.isnan(price):
            price = None

        image_path = self._image_path(item["item_id"])
        return {
            "item_id": item["item_id"],
            "name": item.get("name") or "Untitled item",
            "restaurant": item.get("restaurant") or "Unknown",
            "cuisine": item.get("cuisine") or "Other",
            "section": item.get("section") or "",
            "description": item.get("description") or "",
            "price": price,
            "score": round(float(score), 4),
            "remote_image_url": item.get("image_url"),
            "image_path": f"/taste-images/{item['item_id']}.jpg" if image_path.exists() else None,
        }

    def _image_path(self, item_id: int) -> Path:
        return self.data_dir / "images" / f"{item_id}.jpg"
