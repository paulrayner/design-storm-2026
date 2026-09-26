"""Sonde and upstream data preparation shared by the Strontia pages.

Reads the profiling sonde export and the daily upstream series from the repository's data/ folder and
returns plain dicts ready to inline into a page. Imported by build.py beside it.

Choices made here, not in the data:
- Conductivity is compensated to 25 C with 1.91 percent per degree. The sonde
  export is raw conductivity at in-situ temperature; uncompensated it reads
  higher at the warm surface than at the cold bottom.
- Depth is the sonde's Vertical Position rounded to the nearest whole unit. The
  export does not say whether the unit is metres or feet.
- Values are the median across that day's casts (usually four) in each depth
  bin. Bins with no reading are filled by linear interpolation along depth;
  days with no cast are left empty, not filled.
- Chlorophyll below zero is sensor noise and is clamped to zero.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent


def repo_root():
    """The repository root: the nearest ancestor holding Denver Water's data folder."""
    for p in [HERE, *HERE.parents]:
        if (p / "data" / "FoothillsInfluent.csv").exists():
            return p
    raise FileNotFoundError("cannot find the repository root (a folder containing data/FoothillsInfluent.csv) above " + str(HERE))


ROOT = repo_root()
DATA = ROOT / "data"

PARAMS = {
    "temp": dict(col="Temp C", label="Temperature", unit="C", scale="linear", hue=55, decimals=1),
    "spc": dict(col="spc", label="Conductance", unit="uS/cm at 25 C", scale="linear", hue=255, decimals=0),
    "ph": dict(col="pH", label="pH", unit="", scale="linear", hue=300, decimals=2),
    "turb": dict(col="Turbidity NTU", label="Turbidity", unit="NTU", scale="log", hue=80, decimals=1),
    "chl": dict(col="Chl ug/L", label="Chlorophyll", unit="ug/L", scale="sqrt", hue=145, decimals=2),
    "phyco": dict(col="Phycocyanin", label="Phycocyanin", unit="as recorded", scale="sqrt", hue=185, decimals=2),
    "do": dict(col="ODO mg/L", label="Dissolved oxygen", unit="mg/L", scale="linear", hue=20, decimals=2),
}


def parse_daily(path, date_col, usecols):
    df = pd.read_csv(path)
    df["DATE"] = pd.to_datetime(df[date_col], utc=True).dt.tz_localize(None).dt.normalize()
    df = df.set_index("DATE")[usecols].apply(pd.to_numeric, errors="coerce")
    return df[~df.index.duplicated(keep="last")].sort_index()


def sonde():
    x = pd.read_excel(DATA / "Strontia 0407_0819.xlsx", sheet_name=0)
    x.columns = [c.strip() for c in x.columns]
    x["day"] = pd.to_datetime(x["Time stamp"]).dt.normalize()
    x.loc[x["Conductivity"] > 400, "Conductivity"] = np.nan
    x["spc"] = x["Conductivity"] / (1 + 0.0191 * (x["Temp C"] - 25))
    x["Chl ug/L"] = x["Chl ug/L"].clip(lower=0)
    x["Turbidity NTU"] = x["Turbidity NTU"].clip(lower=0.01)
    x["bin"] = x["Vertical Position"].round().astype(int)
    depths = list(range(int(x["bin"].min()), int(x["bin"].max()) + 1))
    days = sorted(x["day"].unique())
    casts = x.groupby("day")["Time stamp"].nunique()

    grids = {}
    for key, p in PARAMS.items():
        med = x.groupby(["day", "bin"])[p["col"]].median().unstack("bin").reindex(index=days, columns=depths)
        med = med.interpolate(axis=1, limit_area="inside")
        grids[key] = [[None if pd.isna(v) else round(float(v), 3) for v in row] for row in med.values]

    domains = {}
    for key, p in PARAMS.items():
        vals = np.array([v for row in grids[key] for v in row if v is not None], dtype=float)
        lo, hi = np.nanpercentile(vals, [2, 98])
        if p["scale"] == "log":
            lo = max(lo, 0.1)
        domains[key] = [round(float(lo), 3), round(float(hi), 3)]

    return {
        "days": [pd.Timestamp(d).strftime("%Y-%m-%d") for d in days],
        "casts": [int(casts[d]) for d in days],
        "depths": depths,
        "params": {k: {**{kk: vv for kk, vv in p.items() if kk != "col"}, "domain": domains[k], "grid": grids[k]} for k, p in PARAMS.items()},
    }


def upstream(start, end):
    usgs = parse_daily(DATA / "USGS_South_Platte.csv", "Date", ["Turbidity_Median", "Turbidity_Max", "Specific_Cond_Mean", "Temp_C_Mean"])
    dwr = parse_daily(DATA / "SouthPlatteTelemetry.csv", "Date", ["Flow_CFS"])
    noaa = parse_daily(DATA / "USC00058022.csv", "DATE", ["PRCP"])
    snow = parse_daily(DATA / "HoosierPass.csv", "DATE", ["SWE"])
    lab = parse_daily(DATA / "FoothillsInfluent.csv", "DATE", ["TOC_mg_L", "Alk_mg_L"])
    idx = pd.date_range(start, end, freq="D")
    df = pd.DataFrame(index=idx).join(usgs).join(dwr).join(noaa).join(snow).join(lab)
    out = {"dates": [d.strftime("%Y-%m-%d") for d in idx]}
    for c in df.columns:
        out[c] = [None if pd.isna(v) else round(float(v), 3) for v in df[c].values]
    return out, df
