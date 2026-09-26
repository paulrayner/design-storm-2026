"""Regrid with the Phase 5 winner (autoresearch/interpolate.py) for the map panel.

Reads analysis/out/sonde_clean.csv and analysis/out/grid.npz (grid_sonde.py) and writes:

  analysis/out/grid_best.npz            same axes as grid.npz, the five fill-in parameters
                                        refilled, plus spcond_us_cm derived from them
  analysis/out/compare_<param>.png      linear (Phase 2) vs best, storm window

The winner fills everywhere, so blanks are copied from the Phase 2 grid: no values
across gaps longer than a day. Denver Water provisional data (data/TERMS.md).
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
sys.path.insert(0, str(HERE.parent / "autoresearch"))
sys.path.insert(0, str(HERE))
import interpolate  # noqa: E402
from clean_sonde import COND_ALPHA  # noqa: E402
from grid_sonde import CMAP, PARAMS as LABELS, norm_for  # noqa: E402

CHUNK = 4   # depths per predict() call, to keep its cast-by-query matrix small


def main():
    df = pd.read_csv(OUT / "sonde_clean.csv", parse_dates=["time"])
    train = df[["time", "cast", "segment", "depth_m"] + interpolate.PARAMS]
    z = np.load(OUT / "grid.npz")
    hours = pd.DatetimeIndex(z["hours"])
    depths = z["depths"]
    best = {c: np.full((len(depths), len(hours)), np.nan) for c in interpolate.PARAMS}
    for k in range(0, len(depths), CHUNK):
        ds = depths[k:k + CHUNK]
        q = pd.DataFrame({"time": np.tile(hours.values, len(ds)),
                          "depth_m": np.repeat(ds.astype(float), len(hours))})
        pred = interpolate.predict(train.copy(), q)
        for c in interpolate.PARAMS:
            best[c][k:k + len(ds)] = pred[c].to_numpy().reshape(len(ds), len(hours))
    for c in best:
        best[c][~np.isfinite(z[c])] = np.nan
    best["spcond_us_cm"] = best["cond_us_cm"] / (1 + COND_ALPHA * (best["temp_c"] - 25))
    np.savez_compressed(OUT / "grid_best.npz", hours=z["hours"], depths=depths, **best)

    sel = (hours >= "2026-08-10") & (hours < "2026-08-20")
    for c in ["temp_c", "turb_ntu", "spcond_us_cm", "odo_mg_l", "chl_ug_l"]:
        a, b = z[c][:, sel], best[c][:, sel]
        norm = norm_for(c, np.concatenate([a.ravel(), b.ravel()]))
        fig, axs = plt.subplots(1, 3, figsize=(15, 3.6), dpi=110)
        for ax, g, t in [(axs[0], a, "Phase 2 linear"), (axs[1], b, "Phase 5 best")]:
            ax.imshow(np.ma.masked_invalid(g), aspect="auto", cmap=CMAP, norm=norm)
            ax.set_title(f"{LABELS[c][0]}: {t}", loc="left", fontsize=10)
        diff = b - a
        m = np.nanpercentile(np.abs(diff), 99) or 1
        im = axs[2].imshow(diff, aspect="auto", cmap="RdBu_r", vmin=-m, vmax=m)
        axs[2].set_title("best minus linear", loc="left", fontsize=10)
        fig.colorbar(im, ax=axs[2])
        fig.tight_layout()
        fig.savefig(OUT / f"compare_{c}.png")
        plt.close(fig)
        print(f"{c}: median |best - linear| {np.nanmedian(np.abs(diff)):.3g}, "
              f"99th pct {np.nanpercentile(np.abs(diff), 99):.3g}")


if __name__ == "__main__":
    main()
