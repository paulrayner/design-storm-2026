"""Write map/strontia-profile.json, the data behind the Strontia depth panel.

Reads analysis/out/grid_best.npz (fill_best.py: the Phase 5 fill-in winner, which also
won on the lockbox) and analysis/out/storm_numbers.json
(storm_trace.py), plus the 15-minute gage series and plant lab values (read-only).
Oxygen saturation (odo_pct_sat, % of the most the water could hold at its temperature) is not
one of the fill-in experiment's parameters, so it is not in grid_best.npz: it comes from
analysis/out/grid.npz (grid_sonde.py, the Phase 2 linear fill between casts). The map panel
does not show it; the pop-out page (map/strontia.html) does.
Values are rounded and gaps are null. The season view is averaged to 3-hour steps
to keep the file small; the storm view keeps 1-hour steps.

Denver Water provisional data; its terms travel with the file (the "terms" field,
and map/DATA-TERMS.md next to it).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
TEAM = HERE.parent
REPO = TEAM.parents[1]
OUT = HERE / "out"
DEST = TEAM / "map" / "strontia-profile.json"
sys.path.insert(0, str(HERE))
from storm_trace import gage_15min, daily  # noqa: E402

PARAMS = [  # column, label, units, log scale, decimals
    ("temp_c", "Temperature", "°C", False, 1),
    ("turb_ntu", "Turbidity", "NTU", True, 2),
    ("spcond_us_cm", "Specific conductance", "µS/cm", False, 0),
    ("odo_mg_l", "Dissolved oxygen", "mg/L", False, 2),
    ("chl_ug_l", "Chlorophyll", "µg/L", False, 2),
]
LINEAR_PARAMS = [  # from grid.npz (linear fill), not in grid_best.npz
    ("odo_pct_sat", "Oxygen saturation", "%", False, 1),
]
SEASON_STEP_H = 3
STORM = ("2026-08-10", "2026-08-20")

TERMS = (
    "Sonde readings and Foothills lab values: Denver Water, provisional and subject to change, "
    "provided \"as is\" with no warranty of any kind; not QA/QC reviewed. Copyright 2026, "
    "Denver Water. Any sale, reproduction or distribution of this information, or products "
    "derived therefrom, in any format is expressly prohibited. Full terms: data/TERMS.md. "
    "Gage readings: USGS 06707525, provisional (flag P), public domain."
)


def pack(grid, decimals):
    """Time-major flat list, rounded, NaN -> None."""
    a = np.round(grid.T, decimals)
    return [None if not np.isfinite(v) else (int(v) if decimals == 0 else float(v))
            for v in a.ravel()]


def domain(values, log):
    v = values[np.isfinite(values)]
    lo, hi = np.percentile(v, [1, 99])
    if log:
        lo = max(lo, 0.1)
    return [float(np.round(lo, 3)), float(np.round(hi, 3))]


def block_mean(grid, step):
    n = grid.shape[1] // step * step
    g = grid[:, :n].reshape(grid.shape[0], -1, step)
    with np.errstate(all="ignore"):
        return np.nanmean(g, axis=2)


def main():
    z = np.load(OUT / "grid_best.npz")
    zlin = np.load(OUT / "grid.npz")
    assert (zlin["hours"] == z["hours"]).all() and (zlin["depths"] == z["depths"]).all()
    hours = pd.DatetimeIndex(z["hours"])
    depths = z["depths"].tolist()
    N = json.loads((OUT / "storm_numbers.json").read_text())

    s_hours = hours[: len(hours) // SEASON_STEP_H * SEASON_STEP_H : SEASON_STEP_H]
    sel = (hours >= STORM[0]) & (hours < STORM[1])
    views = {
        "season": {"start": s_hours[0].isoformat(), "step_h": SEASON_STEP_H, "n": len(s_hours),
                   "label": "Apr 7 to Aug 19, 2026", "params": {}},
        "storm": {"start": hours[sel][0].isoformat(), "step_h": 1, "n": int(sel.sum()),
                  "label": "Aug 10 to 19, 2026", "params": {}},
    }
    meta = {}
    for col, label, units, log, dec in PARAMS + LINEAR_PARAMS:
        g = z[col] if col in z.files else zlin[col]
        season = block_mean(g, SEASON_STEP_H)
        storm = g[:, sel]
        views["season"]["params"][col] = {"domain": domain(season, log), "values": pack(season, dec)}
        views["storm"]["params"][col] = {"domain": domain(storm, log), "values": pack(storm, dec)}
        meta[col] = {"label": label, "units": units, "log": log}

    g15, _ = gage_15min()
    inf = daily("FoothillsInfluent.csv", "DATE").loc[STORM[0]:STORM[1]]
    df = pd.read_csv(OUT / "sonde_clean.csv", parse_dates=["time"])
    service = [t.isoformat() for t in df.groupby("segment")["time"].min().sort_index().iloc[1:]]

    G, R, RX, P = N["gage"], N["reservoir"], N["reservoir_extra"], N["plant"]
    S = N["season"]
    t = lambda s: pd.Timestamp(s)
    findings = [
        f"The storm's muddy water passed the river gage overnight on Aug 14 to 15 "
        f"(peak {G['peak_turb_fnu']:.0f} FNU at {t(G['peak_time']):%H:%M} on "
        f"{t(G['peak_time']):%b %d}).",
        f"In the reservoir it slid in as a layer, not at the surface or the bottom: typically "
        f"{R['layer_top_median']:.0f} to {R['layer_bottom_median']:.0f} m deep, strongest at "
        f"{R['peak_depth']:.0f} m ({R['peak_ntu']:.0f} NTU, about {R['peak_ratio']:.0f} times "
        f"normal) on {t(R['peak_cast']):%b %d}, {R['hours_gage_peak_to_reservoir_peak']:.0f} hours "
        f"after the gage peak.",
        f"The layer sank as it faded, to about {RX['peak_depth_by_day']['2026-08-19']:.0f} m, and "
        f"was still there when the record ends on Aug 19. The surface and the bottom barely changed.",
        f"The Foothills plant's organic carbon went from {P['toc_baseline_aug10_15'][1]:.1f} to "
        f"{P['toc_max_after']:.1f} mg/L on {t(P['toc_first_day_above_baseline']):%b %d}, a jump "
        f"seen in under 1% of summer days. Alkalinity did not clearly move.",
        f"All season the reservoir was layered: warm on top, cool below (up to "
        f"{S['dt_max']:.1f} °C apart). Oxygen at depth never ran low (lowest daily median "
        f"{S['deep_do_min_mg_l'][1]:.1f} mg/L).",
    ]
    caveats = [
        "Provisional readings, one season, one storm. A description, not a forecast.",
        "Depth assumes the sonde's 'vertical position' is metres below the surface; "
        "Denver Water has not confirmed it.",
        "The depth of the Foothills intake is unknown, so whether the plant drew from the storm "
        "layer is not established.",
        "Dotted lines mark sensor servicing; chlorophyll and conductance can step there "
        "without the water changing.",
        "Between casts (every 6 hours, fewer after mid-July) values are filled in, allowing for "
        "the daily warming cycle, and turbidity and chlorophyll are lightly smoothed down each "
        "cast; blank means no reading for over a day. The numbers in the findings come from the "
        "raw casts, so a hover value can differ slightly.",
    ]
    out = {
        "title": "Strontia Springs Reservoir, by depth",
        "terms": TERMS,
        "generated_by": "teams/team-education/analysis/build_profile_json.py",
        "depths": depths,
        "params": meta,
        "views": views,
        "service_events": service,
        "gage": {"site": "06707525",
                 "turb": [[ts.isoformat(), float(v)] for ts, v in g15["turb"].items()]},
        "plant_toc": [[d.date().isoformat(), float(v)] for d, v in inf["TOC_mg_L"].items()],
        "marks": {"gage_peak": G["peak_time"], "reservoir_peak": R["peak_cast"],
                  "reservoir_peak_depth": R["peak_depth"]},
        "findings": findings,
        "caveats": caveats,
    }
    DEST.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {DEST} ({DEST.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
