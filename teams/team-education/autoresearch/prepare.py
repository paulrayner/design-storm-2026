"""LOCKED HARNESS. Build fixed held-out sets for the fill-in experiments.

Hides contiguous 6-hour blocks of sonde readings (usually one whole cast each),
not scattered readings: neighbouring readings are nearly identical, so random
holdout would flatter every method. Half the blocks are **dev** (the loop sees its
score), half are the **lockbox** (scored once, at the end).

Writes autoresearch/data/{train,dev,lockbox}.csv. Rerunning with the same seed
gives the same split. Denver Water provisional data; terms in data/TERMS.md.
"""
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "analysis" / "out" / "sonde_clean.csv"
DATA = HERE / "data"

PARAMS = ["temp_c", "cond_us_cm", "turb_ntu", "odo_mg_l", "chl_ug_l"]
BLOCK_H = 6
N_BLOCKS = 120
CONTEXT_H = 18   # a block needs unhidden readings within this many hours on both sides
SEED = 20260924


def main():
    DATA.mkdir(exist_ok=True)
    df = pd.read_csv(SRC, parse_dates=["time"])
    df = df[["time", "cast", "segment", "depth_m"] + PARAMS]
    df = df.dropna(subset=PARAMS, how="all").reset_index(drop=True)

    rng = np.random.default_rng(SEED)
    t0, t1 = df["time"].min(), df["time"].max()
    starts = pd.date_range(t0.ceil("h"), t1 - pd.Timedelta(hours=BLOCK_H), freq="h")
    times = df["time"].to_numpy()
    chosen, taken = [], []
    for s in rng.permutation(starts):
        s = pd.Timestamp(s)
        e = s + pd.Timedelta(hours=BLOCK_H)
        inside = (times >= np.datetime64(s)) & (times < np.datetime64(e))
        if inside.sum() < 20:
            continue
        # keep blocks apart by at least one block so each has real neighbours
        if any(abs((s - c).total_seconds()) < 3 * BLOCK_H * 3600 for c in taken):
            continue
        before = (times < np.datetime64(s)) & (times >= np.datetime64(s - pd.Timedelta(hours=CONTEXT_H)))
        after = (times >= np.datetime64(e)) & (times < np.datetime64(e + pd.Timedelta(hours=CONTEXT_H)))
        if before.sum() == 0 or after.sum() == 0:
            continue
        taken.append(s)
        chosen.append((s, e))
        if len(chosen) == N_BLOCKS:
            break

    df["block"] = -1
    for i, (s, e) in enumerate(chosen):
        df.loc[(df["time"] >= s) & (df["time"] < e), "block"] = i
    order = rng.permutation(len(chosen))
    dev_ids = set(order[: len(chosen) // 2])
    df["split"] = np.where(df["block"] < 0, "train",
                           np.where(df["block"].isin(dev_ids), "dev", "lockbox"))
    for name in ["train", "dev", "lockbox"]:
        df[df["split"] == name].drop(columns=["split"]).to_csv(DATA / f"{name}.csv", index=False)
    counts = df["split"].value_counts()
    print(f"{len(chosen)} blocks of {BLOCK_H} h; readings: " +
          ", ".join(f"{k} {counts.get(k, 0)}" for k in ["train", "dev", "lockbox"]))


if __name__ == "__main__":
    main()
