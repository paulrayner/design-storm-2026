"""The fill-in method under test. The autoresearch agent edits only this file.

predict(train, queries) -> DataFrame with one row per query (same order) and a
column per parameter in PARAMS. `train` has time, cast, segment, depth_m and the
parameter columns (blanks where QC removed a value). `queries` has time, depth_m.

Baseline: the Phase 2 method evaluated at points. Linear in depth within each
cast, then linear in time between the two nearest casts that cover the depth.
"""
import numpy as np
import pandas as pd

PARAMS = ["temp_c", "cond_us_cm", "turb_ntu", "odo_mg_l", "chl_ug_l"]
EDGE_M = 1.0   # a cast may stand in for depths this far beyond its own range
SMOOTH = {"turb_ntu": 5, "chl_ug_l": 9}   # running-median window (readings) down each cast


def cast_values(train, col, zq):
    """Matrix [cast, query]: each cast's value at each query depth, NaN if uncovered."""
    mids, rows = [], []
    for _, c in train.dropna(subset=[col]).groupby("cast"):
        g = c.groupby("depth_m")[col].mean()
        if len(g) < 2:
            continue
        if col in SMOOTH:
            g = g.rolling(SMOOTH[col], center=True, min_periods=1).median()
        z, v = g.index.to_numpy(), g.to_numpy()
        vals = np.interp(zq, z, v)
        vals[(zq < z[0] - EDGE_M) | (zq > z[-1] + EDGE_M)] = np.nan
        rows.append(vals)
        mids.append(c["time"].min() + (c["time"].max() - c["time"].min()) / 2)
    order = np.argsort(np.array(mids, dtype="datetime64[ns]"))
    t = np.array(mids, dtype="datetime64[ns]")[order].astype("int64") / 3.6e12
    return t, np.array(rows)[order]


def hours(times):
    return np.asarray(times, dtype="datetime64[ns]").astype("int64") / 3.6e12


def diurnal(train, col):
    """24-h harmonic by 1-m depth bin, fitted to readings minus a ~1-day running mean.
    Returns a function (hour_of_day, depth) -> cycle value."""
    d = train.dropna(subset=[col])
    th = hours(d["time"]); v = d[col].to_numpy(); z = d["depth_m"].to_numpy()
    zb = np.clip(np.round(z).astype(int), 0, 46)
    coef = np.zeros((47, 2))
    for b in np.unique(zb):
        m = zb == b
        if m.sum() < 30:
            continue
        t, x = th[m], v[m]
        W = np.exp(-0.5 * ((t[:, None] - t[None, :]) / 12.0) ** 2)
        a = x - W @ x / W.sum(1)
        w = 2 * np.pi * (t % 24) / 24
        coef[b] = np.linalg.lstsq(np.c_[np.cos(w), np.sin(w)], a, rcond=None)[0]
    kern = np.ones(3) / 3
    coef = np.c_[np.convolve(coef[:, 0], kern, "same"), np.convolve(coef[:, 1], kern, "same")]
    zs = np.arange(47)

    def cycle(t, z):
        w = 2 * np.pi * (np.asarray(t) % 24) / 24
        return np.interp(z, zs, coef[:, 0]) * np.cos(w) + np.interp(z, zs, coef[:, 1]) * np.sin(w)
    return cycle


def predict(train, queries):
    zq = queries["depth_m"].to_numpy()
    tq = queries["time"].to_numpy(dtype="datetime64[ns]").astype("int64") / 3.6e12
    out = {}
    for col in PARAMS:
        cyc = diurnal(train, col)
        tr = train.copy()
        tr[col] = tr[col] - cyc(hours(tr["time"]), tr["depth_m"].to_numpy())
        t, V = cast_values(tr, col, zq)
        res = np.empty(len(zq))
        for i in range(len(zq)):
            ok = ~np.isnan(V[:, i])
            tt, vv = t[ok], V[ok, i]
            k = np.searchsorted(tt, tq[i])
            if k == 0:
                res[i] = vv[0]
            elif k == len(tt):
                res[i] = vv[-1]
            else:
                w = (tq[i] - tt[k - 1]) / (tt[k] - tt[k - 1])
                res[i] = (1 - w) * vv[k - 1] + w * vv[k]
        out[col] = res + cyc(tq, zq)
    return pd.DataFrame(out)
