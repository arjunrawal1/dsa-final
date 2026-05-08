from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics.pairwise import cosine_similarity

TASTE_GRAPH_DIR = Path(__file__).parent / "taste_graph"

class TasteGraph:
    def __init__(self):
        self.df = pd.read_parquet(TASTE_GRAPH_DIR / "processed_items.parquet")
        data = torch.load(
            TASTE_GRAPH_DIR / "embeddings" / "gnn_embeddings.pt",
            weights_only=False,
            map_location="cpu",
        )
        self.embeddings = data["item_embeddings"].numpy()

    def similar_items(self, item_id: int, top_k: int = 10):
        query = self.embeddings[item_id:item_id + 1]
        sims = cosine_similarity(query, self.embeddings)[0]
        sims[item_id] = -1

        top_indices = np.argsort(sims)[::-1][:top_k]

        return [
            {
                "similarity": float(sims[idx]),
                **self.df[self.df["item_id"] == idx].iloc[0].to_dict(),
            }
            for idx in top_indices
        ]
