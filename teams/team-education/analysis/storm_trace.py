"""Follow the Aug 14 to 15, 2026 storm: river gage -> reservoir by depth -> Foothills plant.
Also measures the season: stratification, oxygen at depth, chlorophyll.

Reads analysis/out/sonde_clean.csv (run clean_sonde.py first) plus, read-only:
  strontia-brief/series/06707525-turbidity-conductance-aug14-15.json  (15-min gage)
  data/USGS_South_Platte.csv, data/FoothillsInfluent.csv, data/SouthPlatteFlow.csv,
  data/USC00058022.csv

Writes analysis/out/storm_numbers.json (every number FINDINGS.md quotes),
analysis/out/storm_casts.csv (the storm layer, cast by cast) and
analysis/out/storm_timeline.png.

All inputs are provisional (USGS flag "P"; Denver Water terms in data/TERMS.md).
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
OUT = HERE / "out"
TZ = "America/Denver"   # USGS series carry -06:00; sonde casts run on local clock hours

PRE = ("2026-08-10", "2026-08-14")      # pre-storm reference window for the reservoir
WINDOW = ("2026-08-10", "2026-08-20")
LAYER_RATIO = 2.0      # a depth is in the storm layer when turbidity >= this x its pre-storm median
LAYER_MIN_NTU = 1.0    # ... and at least this many NTU above it
GAGE_ONSET_X = 3.0     # gage onset: first 15-min turbidity >= this x the pre-storm gage median
STRAT_DT = 1.0         # surface minus bottom temperature that counts as stratified (general rule of thumb)


def gage_15min():
    f = REPO / "strontia-brief/series/06707525-turbidity-conductance-aug14-15.json"
    d = json.loads(f.read_text())
    out = {}
    for ts in d["value"]["timeSeries"]:
        code = ts["variable"]["variableCode"][0]["value"]
        v = ts["values"][0]["value"]
        s = pd.Series([float(x["value"]) for x in v],
                      index=pd.to_datetime([x["dateTime"] for x in v]).tz_convert(TZ).tz_localize(None))
        out[{"63680": "turb", "00095": "spcond"}[code]] = s
    g = pd.DataFrame(out)
    # One sample (13:00 Aug 14) reads 38 uS/cm between 296 and 299, and turbidity jumps to 16
    # at the same instant and back: a single-sample glitch in both, so drop that timestamp.
    glitch = g["spcond"] < 100
    return g[~glitch], g[glitch]


def daily(name, date_col):
    d = pd.read_csv(REPO / "data" / name)
    d[date_col] = pd.to_datetime(d[date_col], format="%m/%d/%Y")
    return d.set_index(date_col)


def cast_bins(df):
    """Each cast's readings averaged into whole-metre bins (no interpolation)."""
    d = df.copy()
    d["z"] = d["depth_m"].round().astype(int)
    g = d.groupby(["cast", "z"])
    b = g[["turb_ntu", "spcond_us_cm", "temp_c", "odo_mg_l", "ph"]].mean()
    b["t"] = g["time"].min()
    return b.reset_index()


def contiguous_layer(c):
    """The run of consecutive flagged depths (1 m gaps bridged) around the strongest one."""
    flagged = c[c["in_layer"]]
    if flagged.empty:
        return flagged
    zs = flagged["z"].to_numpy()
    runs = np.split(np.arange(len(zs)), np.where(np.diff(zs) > 2)[0] + 1)
    peak_i = int(np.argmax(flagged["turb_ntu"].to_numpy()))
    run = next(r for r in runs if peak_i in r)
    return flagged.iloc[run]


def main():
    OUT.mkdir(exist_ok=True)
    N = {}
    df = pd.read_csv(OUT / "sonde_clean.csv", parse_dates=["time"])

    # ---- river gage -------------------------------------------------------------
    g15, glitch = gage_15min()
    usgs = daily("USGS_South_Platte.csv", "Date")
    pre_gage = usgs.loc["2026-08-10":"2026-08-12", "Turbidity_Median"].median()
    turb = g15["turb"]
    onset = turb[turb >= GAGE_ONSET_X * pre_gage].index.min()
    peak_t, peak_v = turb.idxmax(), turb.max()
    above10 = turb[turb >= 10]
    sc = g15["spcond"]
    sc_clean = sc
    N["gage"] = {
        "series_start": str(turb.index.min()), "series_end": str(turb.index.max()),
        "pre_storm_daily_median_turb_fnu": pre_gage,
        "onset_threshold_fnu": GAGE_ONSET_X * pre_gage,
        "onset": str(onset),
        "peak_turb_fnu": peak_v, "peak_time": str(peak_t),
        "hours_onset_to_peak": (peak_t - onset).total_seconds() / 3600,
        "first_above_10": str(above10.index.min()), "last_above_10": str(above10.index.max()),
        "turb_at_series_end": float(turb.iloc[-1]),
        "spcond_min": float(sc_clean.min()), "spcond_min_time": str(sc_clean.idxmin()),
        "spcond_before_onset_median": float(sc_clean[sc_clean.index < onset].median()),
        "dropped_glitch_samples": [(str(t), float(r.spcond), float(r.turb)) for t, r in glitch.iterrows()],
        "turb_at_series_start": float(turb.iloc[0]),
        "spcond_first_below_293": str(sc[sc < 293].index.min()),
        "daily_turb_max_aug14_15_16": usgs.loc["2026-08-14":"2026-08-16", "Turbidity_Max"].tolist(),
        "daily_temp_mean_aug14_15": usgs.loc["2026-08-14":"2026-08-15", "Temp_C_Mean"].tolist(),
    }
    flow = daily("SouthPlatteFlow.csv", "measDate")["Flow_CFS"]
    N["flow_cfs_aug10_19"] = {str(k.date()): float(v) for k, v in flow["2026-08-10":"2026-08-19"].items()}
    rain = daily("USC00058022.csv", "DATE")["PRCP"]
    N["rain_in_aug10_19"] = {str(k.date()): float(v) for k, v in rain["2026-08-10":"2026-08-19"].items()}

    # ---- reservoir by depth -----------------------------------------------------
    w = df[(df["time"] >= WINDOW[0]) & (df["time"] < WINDOW[1])]
    b = cast_bins(w)
    pre = b[b["t"] < PRE[1]].groupby("z")[["turb_ntu", "spcond_us_cm", "temp_c"]].median()
    b = b.join(pre, on="z", rsuffix="_pre")
    b["ratio"] = b["turb_ntu"] / b["turb_ntu_pre"]
    b["in_layer"] = (b["ratio"] >= LAYER_RATIO) & (b["turb_ntu"] - b["turb_ntu_pre"] >= LAYER_MIN_NTU)

    rows = []
    for cast, c in b.groupby("cast"):
        c = c.sort_values("z")
        lay = contiguous_layer(c)
        row = {"cast": cast, "t": c["t"].min(), "depth_top": c["z"].min(), "depth_bottom": c["z"].max()}
        if len(lay) >= 2:
            pk = lay.loc[lay["turb_ntu"].idxmax()]
            row.update(layer_top=lay["z"].min(), layer_bottom=lay["z"].max(), layer_n=len(lay),
                       peak_ntu=pk["turb_ntu"], peak_depth=pk["z"], peak_ratio=pk["ratio"],
                       layer_spcond_change=(lay["spcond_us_cm"] - lay["spcond_us_cm_pre"]).mean(),
                       layer_temp_change=(lay["temp_c"] - lay["temp_c_pre"]).mean(),
                       layer_temp=lay["temp_c"].mean())
        rows.append(row)
    sc_ = pd.DataFrame(rows).sort_values("t")
    sc_.to_csv(OUT / "storm_casts.csv", index=False, float_format="%.3f")
    full = sc_[sc_["depth_bottom"] >= 30]
    after = sc_[sc_["t"] >= PRE[1]]
    first = after.dropna(subset=["layer_top"]).iloc[0]
    storm_full = full[full["t"] >= PRE[1]].dropna(subset=["layer_top"])
    peak = storm_full.loc[storm_full["peak_ntu"].idxmax()]
    last_cast = sc_.iloc[-1]
    pre_casts = sc_[sc_["t"] < PRE[1]]
    half = storm_full["peak_ntu"].max() / 2
    half_arrival = storm_full[storm_full["peak_ntu"] >= half].iloc[0]
    N["reservoir_extra"] = {
        "half_max_ntu": float(half),
        "half_max_arrival_cast": str(half_arrival["t"]),
        "hours_gage_peak_to_half_max_arrival": (half_arrival["t"] - peak_t).total_seconds() / 3600,
        "peak_depth_by_day": {str(k.date()): float(v) for k, v in
                              storm_full.set_index("t")["peak_depth"].resample("D").median().dropna().items()},
        "peak_ntu_by_day": {str(k.date()): float(v) for k, v in
                            storm_full.set_index("t")["peak_ntu"].resample("D").max().dropna().items()},
    }
    N["reservoir"] = {
        "pre_window": PRE,
        "pre_casts_with_layer": int(pre_casts["layer_top"].notna().sum()),
        "pre_casts": len(pre_casts),
        "pre_median_turb_by_band": {
            "1-6 m": float(pre.loc[1:6, "turb_ntu"].median()),
            "7-22 m": float(pre.loc[7:22, "turb_ntu"].median()),
            "23-44 m": float(pre.loc[23:44, "turb_ntu"].median())},
        "first_layer_cast": str(first["t"]),
        "first_layer_depths": [float(first["layer_top"]), float(first["layer_bottom"])],
        "first_layer_peak_ntu": float(first["peak_ntu"]),
        "hours_gage_onset_to_first_layer": (first["t"] - onset).total_seconds() / 3600,
        "hours_gage_peak_to_first_layer": (first["t"] - peak_t).total_seconds() / 3600,
        "peak_cast": str(peak["t"]), "peak_ntu": float(peak["peak_ntu"]),
        "peak_depth": float(peak["peak_depth"]), "peak_ratio": float(peak["peak_ratio"]),
        "peak_layer_depths": [float(peak["layer_top"]), float(peak["layer_bottom"])],
        "hours_gage_peak_to_reservoir_peak": (peak["t"] - peak_t).total_seconds() / 3600,
        "layer_depth_range_all_storm_full_casts": [float(storm_full["layer_top"].min()),
                                                    float(storm_full["layer_bottom"].max())],
        "layer_top_median": float(storm_full["layer_top"].median()),
        "layer_bottom_median": float(storm_full["layer_bottom"].median()),
        "layer_spcond_change_median": float(storm_full["layer_spcond_change"].median()),
        "layer_temp_change_median": float(storm_full["layer_temp_change"].median()),
        "layer_temp_median": float(storm_full["layer_temp"].median()),
        "last_cast": str(last_cast["t"]),
        "last_cast_layer": [None if pd.isna(last_cast.get("layer_top")) else float(last_cast["layer_top"]),
                            None if pd.isna(last_cast.get("layer_bottom")) else float(last_cast["layer_bottom"])],
        "last_cast_peak_ntu": None if pd.isna(last_cast.get("peak_ntu")) else float(last_cast["peak_ntu"]),
        "casts_after_onset": int(len(after)),
        "surface_1_3m_max_ratio_after_onset": float(b[(b["t"] >= PRE[1]) & (b["z"] <= 3)]["ratio"].max()),
        "bottom_35_44m_max_ratio_after_onset": float(b[(b["t"] >= PRE[1]) & (b["z"] >= 35)]["ratio"].max()),
    }
    # the record's gap and service event inside the window
    times = w.sort_values("time")["time"]
    gaps = times.diff()
    big = gaps[gaps > pd.Timedelta(hours=12)]
    N["reservoir"]["gaps_over_12h"] = [(str(times[i - 1] if i - 1 in times.index else ""), str(times[i]))
                                        for i in big.index]
    svc = df.groupby("segment")["time"].min().sort_index().iloc[1:]
    N["reservoir"]["service_events_in_window"] = [str(t) for t in svc if WINDOW[0] <= str(t) < WINDOW[1]]
    # where river water of that temperature would sit (interpretation input)
    river_t = float(np.mean(N["gage"]["daily_temp_mean_aug14_15"]))
    pre_t = pre["temp_c"]
    N["reservoir"]["depth_where_prestorm_reservoir_matches_river_temp"] = \
        float(pre_t.index[np.argmin(np.abs(pre_t.to_numpy() - river_t))])
    N["reservoir"]["river_temp_mean_aug14_15"] = river_t
    N["reservoir"]["prestorm_temp_surface_1m"] = float(pre_t.loc[1])
    N["reservoir"]["prestorm_temp_44m"] = float(pre_t.loc[pre_t.index.max()])

    # ---- Foothills plant --------------------------------------------------------
    inf = daily("FoothillsInfluent.csv", "DATE")
    win = inf["2026-08-10":"2026-08-19"]
    base = inf["2026-08-10":"2026-08-15"]
    toc_rise = inf["TOC_mg_L"].diff()
    summer = toc_rise[(toc_rise.index.month.isin([6, 7, 8]))].dropna()
    first_up = win[win["TOC_mg_L"] > base["TOC_mg_L"].max()].index.min()
    alk_base = base["Alk_mg_L"]
    N["plant"] = {
        "toc_aug10_19": {str(k.date()): float(v) for k, v in win["TOC_mg_L"].items()},
        "alk_aug10_19": {str(k.date()): float(v) for k, v in win["Alk_mg_L"].items()},
        "toc_baseline_aug10_15": [float(base["TOC_mg_L"].min()), float(base["TOC_mg_L"].max())],
        "toc_first_day_above_baseline": str(first_up.date()),
        "toc_max_after": float(win["TOC_mg_L"].max()),
        "toc_step_on_first_day": float(toc_rise.loc[first_up]),
        "share_of_summer_daily_toc_changes_at_least_that_big": float((summer.abs() >= toc_rise.loc[first_up]).mean()),
        "summer_daily_toc_changes_n": int(len(summer)),
        "alk_baseline_range_aug10_15": [float(alk_base.min()), float(alk_base.max())],
        "alk_range_aug16_19": [float(win.loc["2026-08-16":, "Alk_mg_L"].min()),
                               float(win.loc["2026-08-16":, "Alk_mg_L"].max())],
        "days_gage_peak_to_toc_rise": (first_up - peak_t.normalize()).days,
    }

    # ---- season -----------------------------------------------------------------
    N["season"] = season(df)

    (OUT / "storm_numbers.json").write_text(json.dumps(N, indent=2, default=str))
    timeline(g15, usgs, sc_, inf, onset, peak_t)
    print(json.dumps(N, indent=2, default=str))


def season(df):
    S = {}
    d = df[df["cast_kind"] == "full"].copy()
    top = d[d["depth_m"] <= 3].groupby("cast").agg(t=("time", "min"), top=("temp_c", "mean"))
    bot = d[d["depth_m"] >= 40].groupby("cast")["temp_c"].mean().rename("bot")
    s = top.join(bot).dropna()
    s["dt"] = s["top"] - s["bot"]
    daily_dt = s.set_index("t")["dt"].resample("D").median().dropna()
    strat = daily_dt >= STRAT_DT
    # first day from which every later observed day stays stratified
    run_start = None
    for day in daily_dt.index:
        if strat.loc[day:].all():
            run_start = day
            break
    S["first_day_stratified_for_rest_of_record"] = str(run_start.date()) if run_start is not None else None
    S["first_day_any_stratification"] = str(daily_dt[strat].index.min().date())
    S["dt_max"] = float(daily_dt.max()); S["dt_max_day"] = str(daily_dt.idxmax().date())
    S["dt_first_observed_day"] = [str(daily_dt.index[0].date()), float(daily_dt.iloc[0])]
    S["dt_monthly_median"] = {k.strftime("%b"): round(float(v), 2)
                              for k, v in daily_dt.resample("MS").median().items()}
    # thermocline: depth of steepest temperature drop, per full cast, from 2 m down
    def thermo(c):
        c = c.dropna(subset=["temp_c"]).groupby(c["depth_m"].round())["temp_c"].mean()
        c = c[c.index >= 2]
        grad = -c.diff().dropna()
        if grad.empty:
            return pd.Series({"z": np.nan, "g": np.nan})
        return pd.Series({"z": grad.idxmax(), "g": grad.max()})
    th = d.groupby("cast").apply(thermo)
    th["t"] = d.groupby("cast")["time"].min()
    th = th[th["g"] >= 0.3]  # only casts with a real gradient (0.3 °C per m)
    S["thermocline_depth_monthly_median"] = {k.strftime("%b"): float(v) for k, v in
                                             th.set_index("t")["z"].resample("MS").median().dropna().items()}
    deep = d[d["depth_m"] >= 40]
    do = deep.groupby(deep["time"].dt.normalize())[["odo_mg_l", "odo_pct_sat", "temp_c"]].median()
    S["deep_do_min_mg_l"] = [str(do["odo_mg_l"].idxmin().date()), float(do["odo_mg_l"].min())]
    S["deep_do_pct_sat_min"] = [str(do["odo_pct_sat"].idxmin().date()), float(do["odo_pct_sat"].min())]
    S["deep_do_monthly_median_mg_l"] = {k.strftime("%b"): round(float(v), 2)
                                        for k, v in do["odo_mg_l"].resample("MS").median().items()}
    S["deep_all_readings_min_do_mg_l_after_qc"] = float(deep["odo_mg_l"].min())
    # early-August deep-water change
    a = do.loc["2026-08-01":"2026-08-12"]
    S["deep_aug1_12"] = {str(k.date()): [round(float(r.temp_c), 2), round(float(r.odo_mg_l), 2)]
                         for k, r in a.iterrows()}
    usgs = daily("USGS_South_Platte.csv", "Date")
    S["river_temp_mean_aug1_12"] = {str(k.date()): v for k, v in
                                    usgs.loc["2026-08-01":"2026-08-12", "Temp_C_Mean"].items()}
    flow = daily("SouthPlatteFlow.csv", "measDate")["Flow_CFS"]
    S["flow_cfs_aug1_12"] = {str(k.date()): float(v) for k, v in flow["2026-08-01":"2026-08-12"].items()}
    # chlorophyll, within segments where the sensor reads above its floor
    chl = []
    for seg, g in df.groupby("segment"):
        med = g["chl_ug_l"].median()
        if med <= 0:
            continue
        prof = g.groupby(g["depth_m"].round())["chl_ug_l"].median()
        chl.append({"segment": int(seg), "from": str(g["time"].min().date()), "to": str(g["time"].max().date()),
                    "median": float(med), "max_depth": float(prof.idxmax()), "max_median": float(prof.max()),
                    "median_1_5m": float(prof.loc[1:5].median()), "median_30_44m": float(prof.loc[30:44].median()),
                    "p99": float(g["chl_ug_l"].quantile(0.99))})
    S["chlorophyll_segments_above_floor"] = chl
    S["phyco_p99"] = float(df["phyco"].quantile(0.99))
    # spring: specific conductance and turbidity at the surface vs gage
    return S


def timeline(g15, usgs, sc_, inf, onset, peak_t):
    fig, axs = plt.subplots(3, 1, figsize=(11, 7.5), dpi=130, sharex=True,
                            gridspec_kw={"height_ratios": [1, 1.2, 1]})
    x0, x1 = pd.Timestamp(WINDOW[0]), pd.Timestamp(WINDOW[1])
    ink, muted, blue = "#2b2a27", "#6b6a66", "#256abf"
    # 1 gage
    ax = axs[0]
    d = usgs.loc[WINDOW[0]:WINDOW[1]]
    ax.step(d.index, d["Turbidity_Max"], where="post", color="#9ec5f4", lw=2, label="daily maximum")
    ax.plot(g15.index, g15["turb"], color=blue, lw=2, label="15-minute")
    ax.set_yscale("log"); ax.set_ylabel("FNU")
    ax.set_title("1. River gage above Strontia: turbidity", loc="left", fontsize=10, color=ink)
    ax.annotate(f"peak {g15['turb'].max():.0f} FNU\n{peak_t:%b %d %H:%M}", (peak_t, g15["turb"].max()),
                xytext=(10, -8), textcoords="offset points", fontsize=8, color=ink, va="top")
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    # 2 reservoir layer
    ax = axs[1]
    full = sc_[sc_["depth_bottom"] >= 30]
    lay = full.dropna(subset=["layer_top"])
    ax.vlines(lay["t"], lay["layer_top"], lay["layer_bottom"], color=blue, lw=3)
    ax.scatter(lay["t"], lay["peak_depth"], s=10 + 6 * lay["peak_ntu"], color="#0d366b", zorder=3,
               edgecolor="white", linewidth=1)
    no = full[full["layer_top"].isna()]
    ax.scatter(no["t"], np.full(len(no), 1.5), marker="|", color=muted, s=40)
    ax.set_ylim(44, 0); ax.set_ylabel("depth (m)")
    ax.set_title("2. Reservoir sonde: depths where turbidity is at least double its pre-storm level "
                 "(dot = peak, size = NTU; ticks = cast, no layer)", loc="left", fontsize=10, color=ink)
    # 3 plant
    ax = axs[2]
    t = inf.loc[WINDOW[0]:"2026-08-19", "TOC_mg_L"]
    ax.plot(t.index + pd.Timedelta(hours=12), t, color=blue, lw=2, marker="o", ms=5)
    ax.set_ylabel("TOC mg/L")
    ax.set_title("3. Foothills plant influent: organic carbon (daily lab value, sample time unknown)",
                 loc="left", fontsize=10, color=ink)
    for a in axs:
        a.axvspan(onset, peak_t, color="#f0efec", zorder=0)
        for s in ("top", "right"):
            a.spines[s].set_visible(False)
        a.tick_params(colors=muted, labelsize=8)
    axs[-1].set_xlim(x0, x1)
    axs[-1].xaxis.set_major_locator(mdates.DayLocator())
    axs[-1].xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    fig.text(0.01, 0.005, "Provisional data: USGS 06707525 (flag P); Denver Water sonde and lab values "
             "(data/TERMS.md). Shaded: gage onset to gage peak.", fontsize=7, color=muted)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(OUT / "storm_timeline.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
