"""Grid the cleaned sonde readings onto time x depth and draw heatmaps.

Reads analysis/out/sonde_clean.csv (run clean_sonde.py first) and writes:

  analysis/out/grid.npz                 hourly x 1 m grids, one array per parameter
  analysis/out/heat_<param>.png         full season
  analysis/out/heat_<param>_storm.png   Aug 10 to 19

Method (the Phase 2 baseline):
  1. within each cast, interpolate linearly in depth onto whole metres, only
     between the cast's own shallowest and deepest readings;
  2. at each depth, interpolate linearly in time between cast midpoints onto
     whole hours, only across gaps of at most MAX_GAP_H hours. Longer gaps stay blank.

Denver Water provisional data; terms in data/TERMS.md travel with every output.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.colors import LinearSegmentedColormap, LogNorm, Normalize
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

PARAMS = {  # column: (label, units, log scale)
    "temp_c": ("Temperature", "°C", False),
    "spcond_us_cm": ("Specific conductance", "µS/cm at 25 °C", False),
    "cond_us_cm": ("Conductivity, as logged", "µS/cm, not temperature-compensated", False),
    "turb_ntu": ("Turbidity", "NTU", True),
    "odo_mg_l": ("Dissolved oxygen", "mg/L", False),
    "odo_pct_sat": ("Dissolved oxygen", "% saturation", False),
    "ph": ("pH", "", False),
    "chl_ug_l": ("Chlorophyll", "µg/L", False),
    "phyco": ("Phycocyanin", "units as logged", False),
    "orp_mv": ("ORP", "mV", False),
}
DEPTHS = np.arange(1, 45)          # 1 m to 44 m
MAX_GAP_H = 24
STORM = ("2026-08-10", "2026-08-20")
TERMS = ("Denver Water provisional data, provided as is (data/TERMS.md). "
         "Strontia Springs profiling sonde.")

# One-hue sequential ramp, light = low, dark = high (dataviz reference palette, blue).
BLUES = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
CMAP = LinearSegmentedColormap.from_list("blues", BLUES)
CMAP.set_bad("#f0efec")            # blank = no data


def cast_profiles(df, col):
    """One row per cast: its midpoint time and values on DEPTHS (NaN outside its range)."""
    times, rows = [], []
    for _, c in df.groupby("cast"):
        c = c.dropna(subset=[col]).sort_values("depth_m")
        if len(c) < 2:
            continue
        z, v = c["depth_m"].to_numpy(), c[col].to_numpy()
        prof = np.interp(DEPTHS, z, v, left=np.nan, right=np.nan)
        # np.interp needs strictly increasing x; average any repeated depths first
        if np.any(np.diff(z) <= 0):
            g = c.groupby("depth_m")[col].mean()
            prof = np.interp(DEPTHS, g.index.to_numpy(), g.to_numpy(), left=np.nan, right=np.nan)
        times.append(c["time"].min() + (c["time"].max() - c["time"].min()) / 2)
        rows.append(prof)
    return pd.DatetimeIndex(times), np.array(rows)


def time_interp(times, profs, hours):
    """Linear in time at each depth, blank across gaps longer than MAX_GAP_H."""
    t = (times - hours[0]).total_seconds().to_numpy() / 3600
    h = (hours - hours[0]).total_seconds().to_numpy() / 3600
    grid = np.full((len(DEPTHS), len(hours)), np.nan)
    for j in range(len(DEPTHS)):
        ok = ~np.isnan(profs[:, j])
        tj, vj = t[ok], profs[ok, j]
        if len(tj) < 2:
            continue
        g = np.interp(h, tj, vj, left=np.nan, right=np.nan)
        # blank hours whose bracketing casts are too far apart
        idx = np.searchsorted(tj, h)
        lo, hi = np.clip(idx - 1, 0, len(tj) - 1), np.clip(idx, 0, len(tj) - 1)
        g[(tj[hi] - tj[lo]) > MAX_GAP_H] = np.nan
        grid[j] = g
    return grid


def build_grids(df):
    hours = pd.date_range(df["time"].min().ceil("h"), df["time"].max().floor("h"), freq="h")
    grids = {}
    for col in PARAMS:
        times, profs = cast_profiles(df, col)
        grids[col] = time_interp(times, profs, hours)
    return hours, grids


def norm_for(col, values):
    v = values[np.isfinite(values)]
    lo, hi = np.percentile(v, [1, 99])
    if PARAMS[col][2]:
        return LogNorm(vmin=max(lo, 0.1), vmax=hi)
    return Normalize(vmin=lo, vmax=hi)


def heatmap(hours, grid, col, path, title_extra="", window=None, service=None):
    label, units, _ = PARAMS[col]
    if window:
        sel = (hours >= window[0]) & (hours < window[1])
        hours, grid = hours[sel], grid[:, sel]
    fig, ax = plt.subplots(figsize=(12, 4.2), dpi=130)
    x = mdates.date2num(hours.to_pydatetime())
    im = ax.pcolormesh(np.append(x, x[-1] + 1 / 24) - 0.5 / 24,
                       np.append(DEPTHS, DEPTHS[-1] + 1) - 0.5,
                       np.ma.masked_invalid(grid), cmap=CMAP,
                       norm=norm_for(col, grid), shading="flat", rasterized=True)
    ax.invert_yaxis()
    ax.set_ylabel("Depth below surface (m)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    if window:
        ax.xaxis.set_major_locator(mdates.DayLocator())
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    if service is not None:
        for e in service:
            if hours[0] <= e <= hours[-1]:
                ax.axvline(mdates.date2num(e), color="#6b6a66", lw=1, ls=(0, (2, 2)))
    cb = fig.colorbar(im, ax=ax, pad=0.01)
    if PARAMS[col][2]:
        from matplotlib.ticker import FixedLocator, ScalarFormatter
        lo, hi = im.norm.vmin, im.norm.vmax
        ticks = [t for t in (0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200) if lo <= t <= hi]
        cb.ax.yaxis.set_major_locator(FixedLocator(ticks))
        cb.ax.yaxis.set_major_formatter(ScalarFormatter())
        cb.ax.yaxis.set_minor_locator(FixedLocator([]))
    cb.set_label(f"{label} ({units})" if units else label)
    ax.set_title(f"Strontia Springs Reservoir: {label.lower()} by depth{title_extra}",
                 loc="left", fontsize=11)
    fig.text(0.01, 0.01, TERMS + " Grey = no reading. Dotted line = sensor serviced "
             "(values either side may not be comparable; see QC.md).", fontsize=7,
             color="#6b6a66")
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(path)
    plt.close(fig)


def service_dates(df):
    firsts = df.groupby("segment")["time"].min().sort_index()
    return list(firsts.iloc[1:].dt.normalize())


def main():
    df = pd.read_csv(OUT / "sonde_clean.csv", parse_dates=["time"])
    hours, grids = build_grids(df)
    np.savez_compressed(OUT / "grid.npz", hours=hours.values.astype("datetime64[s]"),
                        depths=DEPTHS, **grids)
    svc = service_dates(df)
    for col in PARAMS:
        heatmap(hours, grids[col], col, OUT / f"heat_{col}.png", ", Apr 7 to Aug 19, 2026",
                service=svc)
        heatmap(hours, grids[col], col, OUT / f"heat_{col}_storm.png", ", Aug 10 to 19, 2026",
                window=STORM, service=svc)
    filled = {c: np.isfinite(g).mean() for c, g in grids.items()}
    print(f"grid {len(DEPTHS)} depths x {len(hours)} hours; filled fraction: " +
          ", ".join(f"{c} {f:.0%}" for c, f in filled.items()))


if __name__ == "__main__":
    main()
