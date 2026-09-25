#!/usr/bin/env python3
"""Precompute a single bundled series.json for the TOC & Alkalinity Prediction Viewer.

Reads Denver Water's original CSVs from ../../data/ (never modifying them) and emits
public/series.json, one entry per series, each a {"t": ISO-date, "v": number} array.
This lets the front end load everything offline and instantly.

Run once from the team folder:

    python3 precompute.py

Design notes:
- Two date formats appear in the source CSVs: M/D/YYYY and ISO YYYY-MM-DD. Both are
  normalized to ISO YYYY-MM-DD here.
- Snowpack uses HoosierPass.csv (guide.md: MichiganCreek.csv has a known bad patch,
  May 12-15 2026).
- The DWR Precip column is intentionally skipped (guide.md: dirty, running-total that
  resets). Precipitation comes from the NOAA station instead.
- Gaps stay gaps: days absent from a source (e.g. the Foothills Jan-Mar winter gap)
  are simply absent from that series. No interpolation, no zero-fill.
"""

import csv
import datetime as dt
import json
import os
import re
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "..", "..", "data"))
OUT = os.path.join(HERE, "public", "series.json")

SONDE_FILE = "Strontia 0407_0819.xlsx"
# Excel serial dates count days from this epoch (the 1900 system's 1899-12-30 anchor).
EXCEL_EPOCH = dt.datetime(1899, 12, 30)


def iso(date_str):
    """Normalize a date cell to ISO YYYY-MM-DD, accepting M/D/YYYY or YYYY-MM-DD."""
    s = date_str.strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format: {date_str!r}")


def num(cell):
    """Parse a numeric cell, returning None for blanks/non-numbers."""
    s = (cell or "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def read_series(filename, date_col, value_col):
    """Read one column from a CSV as a list of {t, v}, sorted by date, gaps dropped."""
    path = os.path.join(DATA, filename)
    rows = []
    with open(path, newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            t = iso(row[date_col])
            v = num(row.get(value_col))
            if t is None or v is None:
                continue
            rows.append({"t": t, "v": v})
    rows.sort(key=lambda r: r["t"])
    return rows


def sonde_rows(filename):
    """Yield (timestamp, depth, cells) for every data row of the sonde .xlsx.

    Parsed with the standard library only (an .xlsx is a zip of XML), so no extra
    dependency. `cells` maps column letter to raw string value.
    """
    path = os.path.join(DATA, filename)

    def col_letter(ref):
        return re.match(r"[A-Z]+", ref).group(0)

    with zipfile.ZipFile(path) as z:
        sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")

    for row_xml in re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S):
        cells = {}
        has_string_cell = False
        for attrs, inner in re.findall(r"<c([^>]*)>(.*?)</c>", row_xml, re.S):
            ref = re.search(r'r="([A-Z]+\d+)"', attrs)
            val = re.search(r"<v>(.*?)</v>", inner, re.S)
            if re.search(r't="s"', attrs):
                has_string_cell = True
            if ref and val:
                cells[col_letter(ref.group(1))] = val.group(1)
        # The header row stores shared-string indexes (t="s"); data rows are all
        # numeric. Skip any row carrying a string cell so the header can't slip
        # through as a bogus 1899 date.
        if has_string_cell:
            continue
        try:
            serial = float(cells.get("A", ""))
            depth = float(cells.get("D", ""))
        except ValueError:
            continue
        yield EXCEL_EPOCH + dt.timedelta(days=serial), depth, cells


def read_sonde_near_surface(filename):
    """Reduce the Strontia profiling sonde .xlsx to daily near-surface readings.

    The sonde logs a full-depth profile of the reservoir roughly twice a day: each
    row is one reading with its own timestamp (Excel serial) and a depth ("Vertical
    Position", column D). To get one value per day comparable to the daily target,
    we take the SHALLOWEST reading of each day — the water nearest the surface, the
    closest analog to what the plant intake draws.

    Returns {"turbidity": [...], "conductivity": [...]} as {t, v} arrays.

    Columns (1-indexed): A=timestamp, C=conductivity, D=vertical position (depth),
    G=turbidity NTU.
    """
    # shallowest[day] = (depth, turbidity, conductivity) for the shallowest row so far
    shallowest = {}
    for when, depth, cells in sonde_rows(filename):
        turbidity = num(cells.get("G"))
        conductivity = num(cells.get("C"))
        day = when.date().isoformat()
        prev = shallowest.get(day)
        if prev is None or depth < prev[0]:
            shallowest[day] = (depth, turbidity, conductivity)

    turb = sorted(
        ({"t": d, "v": v[1]} for d, v in shallowest.items() if v[1] is not None),
        key=lambda r: r["t"],
    )
    cond = sorted(
        ({"t": d, "v": v[2]} for d, v in shallowest.items() if v[2] is not None),
        key=lambda r: r["t"],
    )
    return {"turbidity": turb, "conductivity": cond}


PROFILE_DAYS = 7
PROFILE_BAND_M = 2


def quantile(sorted_vals, q):
    """Linear-interpolated quantile of an already sorted list."""
    pos = (len(sorted_vals) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def read_sonde_profile(filename):
    """What the reservoir looks like by depth over the sonde's last week.

    Every cast in the final PROFILE_DAYS days is pooled and cut into
    PROFILE_BAND_M-metre depth bands. Each band carries the 25th/50th/75th
    percentile of turbidity (so one odd cast can't make a layer look murky) and
    the median temperature, conductivity and chlorophyll. Depth is the file's
    "Vertical Position"; the file doesn't state units, and the 0.9-48 range reads
    as metres below the surface.
    """
    rows = list(sonde_rows(filename))
    end = max(when for when, _, _ in rows)
    start = end - dt.timedelta(days=PROFILE_DAYS)
    bands = {}
    for when, depth, cells in rows:
        if when <= start:
            continue
        b = bands.setdefault(int(depth // PROFILE_BAND_M), {"turb": [], "temp": [], "cond": [], "chl": []})
        for key, col in (("turb", "G"), ("temp", "B"), ("cond", "C"), ("chl", "H")):
            v = num(cells.get(col))
            if v is not None:
                b[key].append(v)

    out = []
    for i in sorted(bands):
        b = {k: sorted(v) for k, v in bands[i].items()}
        if not b["turb"]:
            continue
        med = lambda k: round(quantile(b[k], 0.5), 2) if b[k] else None
        out.append({
            "top": i * PROFILE_BAND_M,
            "bottom": (i + 1) * PROFILE_BAND_M,
            "n": len(b["turb"]),
            "turbidity": [round(quantile(b["turb"], q), 2) for q in (0.25, 0.5, 0.75)],
            "temp": med("temp"),
            "cond": med("cond"),
            "chl": med("chl"),
        })
    return {
        "from": (start + dt.timedelta(seconds=1)).date().isoformat(),
        "to": end.date().isoformat(),
        "bands": out,
    }


def main():
    sonde = read_sonde_near_surface(SONDE_FILE)

    series = {
        # Target: what we are predicting, from Denver Water's own lab.
        "toc": read_series("FoothillsInfluent.csv", "DATE", "TOC_mg_L"),
        "alk": read_series("FoothillsInfluent.csv", "DATE", "Alk_mg_L"),
        # Upstream USGS river sensor (site 06707525, above Strontia).
        "turbidity": read_series("USGS_South_Platte.csv", "Date", "Turbidity_Median"),
        "conductance": read_series("USGS_South_Platte.csv", "Date", "Specific_Cond_Mean"),
        "ph": read_series("USGS_South_Platte.csv", "Date", "pH_Median"),
        "water_temp": read_series("USGS_South_Platte.csv", "Date", "Temp_C_Mean"),
        "dissolved_oxygen": read_series("USGS_South_Platte.csv", "Date", "Dissolved_Oxygen_Mean"),
        # Streamflow from Colorado DWR.
        "flow": read_series("SouthPlatteFlow.csv", "measDate", "Flow_CFS"),
        # Snowpack (snow water equivalent) from SNOTEL, Hoosier Pass.
        "swe": read_series("HoosierPass.csv", "DATE", "SWE"),
        # Weather from the NOAA GHCN station.
        "precip": read_series("USC00058022.csv", "DATE", "PRCP"),
        "snow": read_series("USC00058022.csv", "DATE", "SNOW"),
        "air_tmax": read_series("USC00058022.csv", "DATE", "TMAX"),
        "air_tmin": read_series("USC00058022.csv", "DATE", "TMIN"),
        # Strontia profiling sonde, near-surface reading per day. Sits in the
        # reservoir much closer to the Foothills influent than the upstream gage —
        # potentially sharper, but only covers 2026-04-07..08-19 (one partial season).
        "sonde_turbidity": sonde["turbidity"],
        "sonde_conductivity": sonde["conductivity"],
    }

    meta = {
        "units": {
            "toc": "mg/L", "alk": "mg/L", "turbidity": "FNU",
            "conductance": "uS/cm", "ph": "pH", "water_temp": "degC",
            "dissolved_oxygen": "mg/L", "flow": "cfs", "swe": "in",
            "precip": "in", "snow": "in", "air_tmax": "degF", "air_tmin": "degF",
            "sonde_turbidity": "NTU", "sonde_conductivity": "uS/cm",
        },
        "labels": {
            "toc": "TOC (Foothills influent)",
            "alk": "Alkalinity (Foothills influent)",
            "turbidity": "Turbidity (upstream gage)",
            "conductance": "Specific conductance (upstream gage)",
            "ph": "pH (upstream gage)",
            "water_temp": "Water temperature (upstream gage)",
            "dissolved_oxygen": "Dissolved oxygen (upstream gage)",
            "flow": "Streamflow (South Platte)",
            "swe": "Snowpack SWE (Hoosier Pass)",
            "precip": "Precipitation (NOAA)",
            "snow": "Snowfall (NOAA)",
            "air_tmax": "Air temp max (NOAA)",
            "air_tmin": "Air temp min (NOAA)",
            "sonde_turbidity": "Turbidity (Strontia sonde, near-surface)",
            "sonde_conductivity": "Conductivity (Strontia sonde, near-surface)",
        },
        "sources": {
            "toc/alk": "FoothillsInfluent.csv (Denver Water lab)",
            "turbidity/conductance/ph/water_temp/dissolved_oxygen":
                "USGS_South_Platte.csv, USGS site 06707525",
            "flow": "SouthPlatteFlow.csv, Colorado DWR",
            "swe": "HoosierPass.csv, USDA NRCS SNOTEL (MichiganCreek.csv omitted: known bad patch)",
            "precip/snow/air_tmax/air_tmin": "USC00058022.csv, NOAA GHCN Daily",
            "sonde_turbidity/sonde_conductivity":
                "Strontia 0407_0819.xlsx, Denver Water profiling sonde "
                "(near-surface reading per day; 2026-04-07..08-19 only)",
        },
        "provisional_note": (
            "Water quality data is provisional and subject to change. USGS publishes "
            "immediately and revises later; a fresh API pull can differ from this file. "
            "Data provided by Denver Water; USGS, DWR, NRCS, NOAA data is public domain."
        ),
        "generated": dt.datetime.now().isoformat(timespec="seconds"),
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump({"_meta": meta, "series": series, "sonde_profile": read_sonde_profile(SONDE_FILE)}, fh, separators=(",", ":"))

    counts = {k: len(v) for k, v in series.items()}
    total = sum(counts.values())
    print(f"Wrote {OUT}")
    print(f"{len(series)} series, {total} points total")
    for k in sorted(counts):
        first = series[k][0]["t"] if series[k] else "-"
        last = series[k][-1]["t"] if series[k] else "-"
        print(f"  {k:18s} {counts[k]:5d} pts   {first} .. {last}")


if __name__ == "__main__":
    main()
