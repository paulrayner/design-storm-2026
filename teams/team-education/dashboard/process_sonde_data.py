"""
Processes the Strontia sonde depth profiles (data/Strontia 0407_0819.xlsx --
16,093 readings, many depths per day, Apr 7-Aug 19 2026) into a clean daily
CSV, two ways per column:
  - mean across all depths that day (whole-column average)
  - shallowest reading that day (closest to what's arriving, before it
    stratifies through the reservoir)

Jake's models never use this file at all (see README.md). Only ~104 days
have any casts, far less than the gage record, so anything built on it should
be read with that sample size in mind.

Run from the repository root: python teams/team-education/dashboard/process_sonde_data.py
"""
import pandas as pd

SONDE_XLSX = "data/Strontia 0407_0819.xlsx"
OUT = "teams/team-education/dashboard/sonde_daily.csv"

# The Chl ug/L fluorometer channel reads a stable ~-0.20 ug/L low across every
# quiet, no-bloom stretch of this deployment (e.g. 2026-06-16 to 2026-07-09),
# regardless of season -- a fixed zero-point calibration offset, not random
# noise (34% of all 16,093 raw readings are negative, tightly clustered around
# -0.19 to -0.20 ug/L, while confirmed bloom days read cleanly positive, e.g.
# +1.2 on 2026-05-26). Because the offset is constant across the deployment,
# it biases every reading low -- not just the negative ones -- so we shift the
# whole channel rather than clipping negatives to zero.
CHL_OFFSET_UGL = 0.20

COLUMNS = {
    "Temp C": "temp_c",
    "Conductivity ": "conductivity",
    "pH": "ph",
    "ORP mV": "orp_mv",
    "Turbidity NTU": "turbidity_ntu",
    "Chl ug/L": "chl_ugl",
    "Phycocyanin ": "phycocyanin",
    "ODO mg/L": "odo_mgl",
}

if __name__ == "__main__":
    df = pd.read_excel(SONDE_XLSX, engine="openpyxl")
    df = df.rename(columns=COLUMNS)
    df["chl_ugl"] = df["chl_ugl"] + CHL_OFFSET_UGL
    df["date"] = pd.to_datetime(df["Time stamp"]).dt.date

    means = df.groupby("date")[list(COLUMNS.values())].mean().add_suffix("_mean")
    shallowest_idx = df.groupby("date")["Vertical Position "].idxmin()
    shallow = df.loc[shallowest_idx].set_index("date")[list(COLUMNS.values())].add_suffix("_shallow")

    daily = means.join(shallow)
    daily.index.name = "DATE"
    daily.to_csv(OUT)
    print(f"{len(daily)} days written to {OUT}, {daily.index.min()} to {daily.index.max()}")
