"""LOCKED HARNESS. Score autoresearch/interpolate.py on the hidden blocks.

    .venv/bin/python autoresearch/evaluate.py            # dev score, one number
    .venv/bin/python autoresearch/evaluate.py --detail   # plus per-parameter RMSE
    .venv/bin/python autoresearch/evaluate.py --lockbox  # final check only; not in the loop

Score: RMSE on the hidden readings, divided per parameter by that parameter's
standard deviation in the training readings, then averaged over parameters.
Turbidity is scored as log10(NTU), because its spikes would otherwise dominate.
Lower is better. interpolate.predict() only ever sees the training readings.
"""
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
DATA = HERE / "data"
PARAMS = ["temp_c", "cond_us_cm", "turb_ntu", "odo_mg_l", "chl_ug_l"]
LOG = {"turb_ntu"}


def transform(col, v):
    return np.log10(np.clip(v, 0.05, None)) if col in LOG else v


def score(train, target, pred, detail=False):
    parts = {}
    for c in PARAMS:
        ok = target[c].notna() & pred[c].notna()
        if (target[c].notna() & pred[c].isna()).any():
            raise SystemExit(f"interpolate.predict returned blanks for {c}")
        sd = np.nanstd(transform(c, train[c].to_numpy()))
        err = transform(c, pred.loc[ok, c].to_numpy()) - transform(c, target.loc[ok, c].to_numpy())
        parts[c] = float(np.sqrt(np.mean(err ** 2)) / sd)
    total = float(np.mean(list(parts.values())))
    if detail:
        for c, v in parts.items():
            print(f"  {c:12s} {v:.4f}")
    return total


def main():
    which = "lockbox" if "--lockbox" in sys.argv else "dev"
    train = pd.read_csv(DATA / "train.csv", parse_dates=["time"])
    target = pd.read_csv(DATA / f"{which}.csv", parse_dates=["time"])
    import interpolate
    queries = target[["time", "depth_m"]].copy()
    t = time.time()
    pred = interpolate.predict(train.copy(), queries.copy())
    elapsed = time.time() - t
    pred = pd.DataFrame(pred).reset_index(drop=True)
    if len(pred) != len(target):
        raise SystemExit("predict must return one row per query, in order")
    s = score(train, target.reset_index(drop=True), pred, "--detail" in sys.argv)
    if "--detail" in sys.argv:
        print(f"  ({which}, {elapsed:.1f} s)")
    print(f"{s:.5f}")


if __name__ == "__main__":
    main()
