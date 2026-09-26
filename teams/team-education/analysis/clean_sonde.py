"""Clean the Strontia Springs profiling sonde record and rebuild its casts.

Reads data/Strontia 0407_0819.xlsx (Denver Water, provisional; see data/TERMS.md)
and writes:

  analysis/out/sonde_clean.csv   one row per reading, cleaned values plus flags
  analysis/out/casts.csv         one row per reconstructed cast
  analysis/QC.md                 every rule, how many values it removed, and why

Run from anywhere:  .venv/bin/python analysis/clean_sonde.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SRC = REPO / "data" / "Strontia 0407_0819.xlsx"
OUT = HERE / "out"

RENAME = {
    "Time stamp": "time",
    "Vertical Position": "depth_m",
    "Temp C": "temp_c",
    "Conductivity": "cond_us_cm",
    "pH": "ph",
    "ORP mV": "orp_mv",
    "Turbidity NTU": "turb_ntu",
    "Chl ug/L": "chl_ug_l",
    "Phycocyanin": "phyco",
    "ODO & sat": "odo_pct_sat",
    "ODO mg/L": "odo_mg_l",
}
PARAMS = ["temp_c", "cond_us_cm", "ph", "orp_mv", "turb_ntu", "chl_ug_l",
          "phyco", "odo_pct_sat", "odo_mg_l"]

# Physically possible ranges for a freshwater reservoir (general knowledge,
# deliberately wide: they catch sensor faults, not unusual water).
RANGES = {
    "temp_c": (0, 30),
    "cond_us_cm": (50, 1000),
    "ph": (6.0, 9.5),
    "orp_mv": (-500, 600),
    "turb_ntu": (0, 1000),
    "chl_ug_l": (-1, 100),
    "phyco": (-1, 100),
    "odo_pct_sat": (0, 150),
    "odo_mg_l": (0, 20),
}

NEW_CAST_RISE_M = 2.0      # position jumps back up by more than this: a new cast
NEW_CAST_GAP_MIN = 30      # or the logger paused this long
BOTTOM_M = 45.0            # below this the sonde is in or on the sediment (see QC.md)
FULL_CAST_SPAN_M = 30      # a cast covering at least this much of the column is "full"
HAMPEL_HALF = 2            # neighbours each side, by depth order within a cast
HAMPEL_K = 6               # robust sigmas a value may sit from its neighbours' median
# Minimum departure for a spike, so a flat quiet profile does not flag sensor noise.
HAMPEL_FLOOR = {"temp_c": 0.5, "cond_us_cm": 10, "ph": 0.15, "orp_mv": 30,
                "turb_ntu": 1.0, "chl_ug_l": 1.0, "phyco": 0.3,
                "odo_pct_sat": 5, "odo_mg_l": 0.5}
# A day-to-day step in the all-depth daily median of either of these marks servicing.
# Standard linear temperature compensation to 25 °C for natural waters (general knowledge;
# Standard Methods 2510). The sonde's "Conductivity" is not compensated: see QC.md.
COND_ALPHA = 0.0191
SERVICE_ORP_JUMP_MV = 100
SERVICE_CHL_JUMP = 0.7     # ug/L


def load():
    raw = pd.read_excel(SRC)
    raw.columns = [c.strip() for c in raw.columns]
    df = raw.rename(columns=RENAME)
    df["time"] = pd.to_datetime(df["time"])
    return raw, df


def build_casts(df):
    rise = df["depth_m"].diff()
    gap = df["time"].diff().dt.total_seconds() / 60
    new = (rise > NEW_CAST_RISE_M) | (gap > NEW_CAST_GAP_MIN) | rise.isna()
    df["cast"] = new.cumsum().astype(int)
    g = df.groupby("cast")
    casts = pd.DataFrame({
        "start": g["time"].min(),
        "end": g["time"].max(),
        "n": g.size(),
        "top_m": g["depth_m"].min(),
        "bottom_m": g["depth_m"].max(),
        "distinct_times": g["time"].nunique(),
    })
    casts["minutes"] = (casts["end"] - casts["start"]).dt.total_seconds() / 60
    casts["span_m"] = casts["bottom_m"] - casts["top_m"]
    casts["kind"] = np.where(casts["span_m"] >= FULL_CAST_SPAN_M, "full",
                             np.where(casts["n"] > 1, "shallow", "single"))
    # Cast time: its midpoint. Readings keep their own timestamps too.
    casts["mid"] = casts["start"] + (casts["end"] - casts["start"]) / 2
    df["cast_kind"] = df["cast"].map(casts["kind"])
    return casts


def depth_meaning(df, casts):
    """Evidence that position is depth below the surface: in full casts from
    June onward the shallowest readings should be the warmest."""
    full = casts.index[(casts["kind"] == "full") & (casts["start"] >= "2026-06-01")]
    d = df[df["cast"].isin(full)]
    top = d[d["depth_m"] < 3].groupby("cast")["temp_c"].mean()
    bot = d[d["depth_m"] > 40].groupby("cast")["temp_c"].mean()
    both = pd.concat([top, bot], axis=1, keys=["top", "bot"]).dropna()
    return {
        "casts": len(both),
        "warmer_at_small_position": int((both["top"] > both["bot"]).sum()),
        "median_top_c": both["top"].median(),
        "median_bottom_c": both["bot"].median(),
    }


def hampel_in_casts(df, col):
    """Flag readings far from the median of their neighbours in the same cast."""
    ordered = df.sort_values(["cast", "depth_m"])
    med = (ordered.groupby("cast")[col]
           .transform(lambda s: s.rolling(2 * HAMPEL_HALF + 1, center=True,
                                          min_periods=3).median()))
    resid = ordered[col] - med
    sigma = 1.4826 * (resid - resid.median()).abs().median()
    thresh = max(HAMPEL_K * sigma, HAMPEL_FLOOR[col])
    spike = resid.abs() > thresh
    return spike.reindex(df.index).fillna(False), thresh


def service_events(df):
    """Days on which ORP or chlorophyll shifts at every depth at once: servicing, not water."""
    daily = df.groupby(df["time"].dt.normalize())[["orp_mv", "chl_ug_l"]].median()
    jump = daily.diff().abs()
    hit = (jump["orp_mv"] > SERVICE_ORP_JUMP_MV) | (jump["chl_ug_l"] > SERVICE_CHL_JUMP)
    return list(jump.index[hit]), daily


def main():
    OUT.mkdir(exist_ok=True)
    raw, df = load()
    n_raw = len(df)
    log = []  # (rule, detail, values_or_rows_removed)

    dups = df.duplicated()
    df = df[~dups].reset_index(drop=True)
    log.append(("Exact duplicate rows", "identical in every column; dropped",
                f"{int(dups.sum())} rows"))

    casts = build_casts(df)
    evidence = depth_meaning(df, casts)

    for c in PARAMS:
        df[c + "_raw"] = df[c]
    df["qc"] = ""

    def remove(mask, cols, reason):
        mask = mask & df[cols].notna().any(axis=1)
        for c in cols:
            df.loc[mask, c] = np.nan
        df.loc[mask, "qc"] += reason + ";"
        return int(mask.sum())

    # Start-up cast: every reading carries one timestamp and turbidity is erratic.
    startup = casts.index[(casts["n"] > 1) & (casts["distinct_times"] == 1)]
    m = df["cast"].isin(startup)
    n = remove(m, PARAMS, "startup")
    su = df[m]
    log.append(("Start-up cast",
                f"cast(s) {list(startup)} at {su['time'].min()}: all {len(su)} readings share "
                f"one timestamp; turbidity {su['turb_ntu_raw'].min():.0f} to "
                f"{su['turb_ntu_raw'].max():.0f} NTU against a season median of "
                f"{df['turb_ntu_raw'].median():.2f}. Whole cast removed",
                f"{n} rows"))

    # Bottom contact.
    deep = df["depth_m"] > BOTTOM_M
    near = df["depth_m"].between(40, BOTTOM_M)
    msg = (f"readings deeper than {BOTTOM_M} m (only {df.loc[deep, 'time'].min():%b %d} to "
           f"{df.loc[deep, 'time'].max():%b %d}, before the profiler was set to start at "
           f"~44 m). Median turbidity {df.loc[deep & ~m, 'turb_ntu_raw'].median():.1f} NTU "
           f"vs {df.loc[near & ~m, 'turb_ntu_raw'].median():.2f} at 40 to 45 m, and "
           f"{(df.loc[deep & ~m, 'turb_ntu_raw'] > 20).mean():.0%} of readings above 20 NTU "
           f"vs {(df.loc[near & ~m, 'turb_ntu_raw'] > 20).mean():.1%}; "
           f"minimum oxygen {df.loc[deep, 'odo_mg_l_raw'].min():.2f} mg/L; maximum "
           f"conductivity {df.loc[deep, 'cond_us_cm_raw'].max():.0f} uS/cm. Consistent with "
           f"the sonde touching sediment. All parameters removed")
    n = remove(deep, PARAMS, "bottom")
    log.append(("Bottom contact", msg, f"{n} rows"))

    # Physical ranges.
    for c, (lo, hi) in RANGES.items():
        bad = (df[c] < lo) | (df[c] > hi)
        n = remove(bad, [c], f"range:{c}")
        log.append((f"Range check {c}", f"outside {lo} to {hi}", f"{n} values"))

    # Spikes within a cast.
    thresholds = {}
    for c in PARAMS:
        spike, thr = hampel_in_casts(df, c)
        thresholds[c] = thr
        n = remove(spike, [c], f"spike:{c}")
        log.append((f"Spike {c}",
                    f"more than {thr:.3g} from the median of its {2*HAMPEL_HALF} depth "
                    f"neighbours in the same cast", f"{n} values"))

    # Derived: specific conductance at 25 °C, comparable with the USGS gage.
    df["spcond_us_cm"] = df["cond_us_cm"] / (1 + COND_ALPHA * (df["temp_c"] - 25))
    full = df[df["cast_kind"] == "full"]
    corr_raw = full.groupby("cast").apply(lambda c: c["temp_c"].corr(c["cond_us_cm"])).median()
    corr_sc = full.groupby("cast").apply(lambda c: c["temp_c"].corr(c["spcond_us_cm"])).median()
    cond_evidence = (corr_raw, corr_sc)

    events, daily_orp = service_events(df)
    df["segment"] = np.searchsorted(np.array(events, dtype="datetime64[ns]"),
                                    df["time"].values, side="right")

    keep = ["time", "cast", "cast_kind", "depth_m"] + PARAMS + ["spcond_us_cm", "qc", "segment"] + \
           [c + "_raw" for c in PARAMS]
    df[keep].to_csv(OUT / "sonde_clean.csv", index=False, float_format="%.4g")
    casts.to_csv(OUT / "casts.csv", float_format="%.3f")

    write_qc(n_raw, df, casts, evidence, log, events, daily_orp, cond_evidence)
    print(f"{n_raw} raw rows -> {len(df)} rows, {len(casts)} casts; "
          f"wrote {OUT/'sonde_clean.csv'} and QC.md")


def write_qc(n_raw, df, casts, ev, log, events, daily_orp, cond_ev):
    full = casts[(casts["kind"] == "full") & (casts["distinct_times"] > 1)]
    per_day = casts.groupby(casts["start"].dt.date).size()
    full_per_day = full.groupby(full["start"].dt.date).size()
    kinds = casts["kind"].value_counts()
    removed = {c: int(df[c].isna().sum() - df[c + "_raw"].isna().sum()) for c in PARAMS}
    shallow_from = casts[casts["kind"] == "shallow"]["start"].min()

    chl_by_seg = df.groupby("segment")["chl_ug_l"].median()
    seg_bounds = [df["time"].min()] + list(events) + [df["time"].max()]

    L = []
    L.append("# Sonde QC\n")
    L.append("Generated by `analysis/clean_sonde.py`; do not edit by hand. Source: "
             "`data/Strontia 0407_0819.xlsx`, Denver Water provisional data under the terms "
             "in `data/TERMS.md`. Every number below is computed by the script.\n")
    L.append(f"{n_raw} raw readings, {df['time'].min()} to {df['time'].max()}.\n")

    L.append("## What `Vertical Position` means\n")
    L.append(f"Treated as **depth below the water surface, in metres**. Evidence: in "
             f"{ev['casts']} full casts from June onward, the readings at position < 3 were "
             f"warmer than those at position > 40 in {ev['warmer_at_small_position']} "
             f"(median {ev['median_top_c']:.1f} °C near position 0 vs "
             f"{ev['median_bottom_c']:.1f} °C near position 44). Warm water floats, so small "
             f"positions are near the surface. Each cast starts deep and rises to about "
             f"{casts['top_m'].median():.1f} m. The deepest point stays near 44 m all season "
             f"while the reservoir level changes, which fits a profiler hung from a float, "
             f"measuring down from the surface. **Denver Water should confirm this**, and say "
             f"where the sonde sits relative to the dam and the Foothills intake.\n")

    L.append("## `Conductivity` is not temperature-compensated\n")
    L.append(f"Within each full cast, conductivity tracks temperature almost exactly (median "
             f"correlation {cond_ev[0]:.2f}). After the standard linear correction to 25 °C "
             f"(coefficient {COND_ALPHA} per °C, general knowledge), the correlation is "
             f"{cond_ev[1]:.2f} and the column matches the specific conductance reported by the "
             f"USGS gage at the reservoir inflow (see `analysis/storm_trace.py`). So the logged "
             f"value is raw conductivity at water temperature, and its apparent layering is mostly "
             f"temperature. The clean file adds `spcond_us_cm`, the compensated value; all "
             f"findings use it. Denver Water should confirm the sonde's setting.\n")
    L.append("## Casts\n")
    L.append(f"A new cast starts when the position jumps back up by more than "
             f"{NEW_CAST_RISE_M} m, or the logger pauses for more than {NEW_CAST_GAP_MIN} "
             f"minutes. Casts are classed as **full** (covering at least {FULL_CAST_SPAN_M} m), "
             f"**shallow** (several readings, less than that) or **single** (one reading).\n")
    L.append("| | count |\n|---|---|")
    for k in ["full", "shallow", "single"]:
        L.append(f"| {k} casts | {int(kinds.get(k, 0))} |")
    L.append(f"| all casts | {len(casts)} |")
    L.append(f"| days with any cast | {len(per_day)} |")
    L.append(f"| casts per day, median (range) | {per_day.median():.0f} "
             f"({per_day.min()} to {per_day.max()}) |")
    L.append(f"| full casts per day, median | {full_per_day.median():.0f} |")
    L.append(f"| full cast depth range, median | {full['top_m'].median():.1f} to "
             f"{full['bottom_m'].median():.1f} m |")
    L.append(f"| full cast duration, median (range) | {full['minutes'].median():.0f} min "
             f"({full['minutes'].min():.0f} to {full['minutes'].max():.0f}) |")
    L.append("")
    starts = full["start"].dt.hour.value_counts().sort_index()
    L.append("Full casts start on a six-hour schedule, by start hour: " +
             ", ".join(f"{h:02d}h {n}" for h, n in starts.items()) + ".")
    before = full[full["start"] < shallow_from]
    after = full[full["start"] >= shallow_from]
    per = lambda f: f.groupby(f["start"].dt.date).size().median()
    n_sh = int((casts["kind"] == "shallow").sum())
    L.append(f"From {shallow_from:%b %d} some slots stop short: {n_sh} shallow casts cover only "
             f"the top {casts.loc[casts['kind'] == 'shallow', 'bottom_m'].median():.0f} m or so, "
             f"and full casts per day drop from a median of {per(before):.0f} to "
             f"{per(after):.0f}. The start-up cast is left out of the duration figures.\n")

    L.append("## Rules applied, in order\n")
    L.append("Removed values become blank in the clean columns; the untouched readings are "
             "kept alongside as `<param>_raw`, and the `qc` column names every rule that hit "
             "the row.\n")
    L.append("| rule | detail | removed |\n|---|---|---|")
    for rule, detail, n in log:
        L.append(f"| {rule} | {detail} | {n} |")
    L.append("")
    L.append("Values removed per parameter, all rules together:\n")
    L.append("| parameter | removed | of |\n|---|---|---|")
    for c in PARAMS:
        L.append(f"| {c} | {removed[c]} | {int(df[c + '_raw'].notna().sum())} |")
    L.append("")
    L.append(f"The spike rule is a Hampel filter: each value is compared to the median of up "
             f"to {HAMPEL_HALF} neighbours either side in depth order within its own cast. On a "
             f"smooth or step-shaped profile (a thermocline) that median tracks the profile, so "
             f"only isolated departures are flagged.\n")

    L.append("## Sensor servicing: not corrected, but it limits interpretation\n")
    L.append(f"On these days the median across all depths jumped from the previous observed day, "
             f"by more than {SERVICE_ORP_JUMP_MV} mV of ORP or {SERVICE_CHL_JUMP} ug/L of "
             f"chlorophyll: " +
             ", ".join(f"{e:%b %d}" for e in events) + ". "
             "A change that appears at every depth on the same day is the instrument, "
             "most likely cleaning, recalibration or redeployment (several follow a gap in the "
             "record, when the sonde was presumably out of the water), not the water. The clean file carries a "
             "`segment` number that increases at each event, so analysis can compare within "
             "a segment.\n")
    L.append("| segment | from | to | median chlorophyll (ug/L) | median ORP (mV) |\n"
             "|---|---|---|---|---|")
    orp_by_seg = df.groupby("segment")["orp_mv"].median()
    for s in sorted(df["segment"].unique()):
        L.append(f"| {s} | {seg_bounds[s]:%b %d} | {seg_bounds[s+1]:%b %d} | "
                 f"{chl_by_seg[s]:.2f} | {orp_by_seg[s]:.0f} |")
    L.append("")
    L.append("Consequences: ORP is not comparable across segments and is left out of the "
             "findings. Chlorophyll sits at a flat negative floor in some segments, which "
             "reads as an offset, not an absence of algae, so chlorophyll and phycocyanin are "
             "only compared within a segment. Small negative chlorophyll values are kept as "
             "reported.\n")

    L.append("## Not checked\n")
    L.append("- Time zone. Timestamps are taken as local time as logged; the cast schedule "
             "(00, 06, 12, 18 h) suggests local clock time.\n"
             "- Calibration against grab samples. None are in the materials.\n"
             "- The units of `Phycocyanin` (no unit in the header; probably RFU or ug/L).")
    (HERE / "QC.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
