"""
Generates foothills-prediction.json: a backtested demo of the TOC/alkalinity
soft sensor, built the same way as scripts/TOC_SoftSensor.ipynb and
scripts/Alkalinity_Soft_Sensor.ipynb (same lags, engineered features,
chronological split, sample weights), scored on data/FoothillsInfluent.csv.

Alkalinity also folds in upstream reservoir release timing (Antero, Eleven
Mile, Cheesman, Dillon inflow/outflow, from reservoir_ops_history.json), lagged 14 days -- a real, tested improvement
(R2 0.61 -> 0.69) over the sentinel-gage-only model. See
test_upstream_reservoir_features.py for the comparison.
TOC does not use it: the same test was inconclusive for TOC (the baseline
itself is unstable on this date range), so it is left as the gage-only model.

This is NOT a live forecast: every date in the output already has a known lab
result, held out from training only chronologically. It demonstrates what the
soft sensor would have told an operator, using data the model never trained on.

Offline; rerun after data/ or reservoir_ops_history.json changes. Run from the
repository root:
    python teams/team-education/dashboard/build_foothills_prediction.py
"""
import json

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_percentage_error, r2_score, root_mean_squared_error
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

DATA = "data"
RESERVOIR_OPS = "teams/team-education/dashboard/reservoir_ops_history.json"
UPSTREAM_RESERVOIRS = ["Antero", "Eleven Mile", "Cheesman", "Dillon"]
UPSTREAM_LAG_DAYS = 14
OUT = "teams/team-education/dashboard/foothills-prediction.json"

RF_PARAM_GRID = {
    "n_estimators": [100, 200],
    "max_depth": [3, 5, 7],
    "min_samples_leaf": [5, 10, 20],
    "max_features": [1.0, "sqrt"],
}
SVR_PARAM_GRID = {"kernel": ["rbf", "linear"], "C": [1, 10, 100], "epsilon": [0.1, 0.01]}

FEATURE_LABELS = {
    "Specific_Cond_Mean": "Specific conductance, upstream gage (µS/cm)",
    "month_cos": "Season (cosine)",
    "month_sin": "Season (sine)",
    "turb_flow": "Turbidity x flow (\"loading\")",
    "turb_3day": "Turbidity, 3-day average (NTU)",
    "precip_7day": "Precipitation, 7-day average (in)",
    "swe_7day": "Snow water equivalent, 7-day average (in)",
    "turb/cond": "Turbidity / conductance ratio",
    "Turbidity_Median": "Turbidity, daily median (NTU)",
    "Turbidity_Max": "Turbidity, daily max (NTU)",
    "pH_Median": "pH, upstream gage",
    "flow_7day_avg": "River flow, 7-day average (cfs)",
    "Dissolved_Oxygen_Mean": "Dissolved oxygen, upstream gage (mg/L)",
    "Antero_inflow": "Antero Reservoir inflow, 14d ago (cfs)",
    "Antero_outflow": "Antero Reservoir release, 14d ago (cfs)",
    "ElevenMile_inflow": "Eleven Mile Reservoir inflow, 14d ago (cfs)",
    "ElevenMile_outflow": "Eleven Mile Reservoir release, 14d ago (cfs)",
    "Cheesman_inflow": "Cheesman Reservoir inflow, 14d ago (cfs)",
    "Cheesman_outflow": "Cheesman Reservoir release, 14d ago (cfs)",
    "Dillon_inflow": "Dillon Reservoir inflow, 14d ago (cfs)",
    "Dillon_outflow": "Dillon Reservoir release, 14d ago (cfs)",
}


def load_reservoir_ops():
    """Antero/Eleven Mile/Cheesman/Dillon daily inflow+outflow, wide by reservoir."""
    with open(RESERVOIR_OPS) as f:
        raw = json.load(f)
    rows = []
    for day, reservoirs in raw.items():
        row = {"DATE": day}
        for name in UPSTREAM_RESERVOIRS:
            r = reservoirs.get(name, {})
            col = name.replace(" ", "")
            row[f"{col}_inflow"] = r.get("inflow_cfs")
            row[f"{col}_outflow"] = r.get("outflow_cfs")
        rows.append(row)
    df = pd.DataFrame(rows)
    df["DATE"] = pd.to_datetime(df["DATE"])
    return df.set_index("DATE").sort_index()


def load_predictors():
    usgs = pd.read_csv(f"{DATA}/USGS_South_Platte.csv")
    usgs["DATE"] = pd.to_datetime(usgs["Date"])
    usgs = usgs.drop(columns="Date").set_index("DATE")

    dwr = pd.read_csv(f"{DATA}/SouthPlatteTelemetry.csv")
    dwr["DATE"] = pd.to_datetime(dwr["Date"])
    dwr = dwr.drop(columns="Date").set_index("DATE")

    sntl = pd.read_csv(f"{DATA}/HoosierPass.csv")
    sntl["DATE"] = pd.to_datetime(sntl["DATE"])
    sntl = sntl.set_index("DATE")

    precip = pd.read_csv(f"{DATA}/USC00058022.csv")
    precip["DATE"] = pd.to_datetime(precip["DATE"])
    precip = precip.set_index("DATE")

    target = pd.read_csv(f"{DATA}/FoothillsInfluent.csv")
    target["DATE"] = pd.to_datetime(target["DATE"])
    target = target.set_index("DATE").rename(columns={"TOC_mg_L": "TOC", "Alk_mg_L": "Alk"})

    return target, usgs, dwr, sntl, precip


def build_toc_dataset():
    target, usgs, dwr, sntl, precip = load_predictors()

    combined = target[["TOC"]].join(usgs.shift(2, freq="D"), how="left")
    combined = combined.join(sntl.shift(2, freq="D"), how="left")
    combined = combined.join(dwr.shift(2, freq="D"), how="left")
    combined = combined.join(precip.shift(4, freq="D"), how="left")

    month_radians = 2 * np.pi * (combined.index.month - 1) / 12
    combined["month_sin"] = np.sin(month_radians)
    combined["month_cos"] = np.cos(month_radians)
    combined = combined.dropna(subset=["TOC"]).copy()

    combined["turb_3day"] = combined["Turbidity_Median"].rolling(3).mean()
    combined["flow_7day_avg"] = combined["Flow_CFS"].rolling(7).mean()
    combined["turb_flow"] = combined["turb_3day"] * combined["flow_7day_avg"]
    combined["precip_7day"] = combined["PRCP"].rolling(7).mean()
    combined["swe_7day"] = combined["SWE"].rolling(7).mean()
    combined["turb/cond"] = combined["Specific_Cond_Mean"] / combined["turb_3day"]

    features = [
        "Specific_Cond_Mean", "month_cos", "month_sin", "turb_flow", "turb_3day",
        "precip_7day", "swe_7day", "turb/cond", "Turbidity_Median", "Turbidity_Max",
    ]
    df = combined[features + ["TOC"]].dropna()
    return df[features], df["TOC"]


def build_alk_dataset():
    target, usgs, dwr, sntl, precip = load_predictors()

    combined = target[["Alk"]].join(usgs.shift(4, freq="D"), how="left")
    combined = combined.join(dwr.shift(4, freq="D"), how="left")
    combined = combined.join(precip.shift(6, freq="D"), how="left")

    month_radians = 2 * np.pi * (combined.index.month - 1) / 12
    combined["month_sin"] = np.sin(month_radians)
    combined["month_cos"] = np.cos(month_radians)
    combined = combined.dropna(subset=["Alk"]).copy()

    combined["flow_7day_avg"] = combined["Flow_CFS"].rolling(7).mean()
    combined["turb_3day"] = combined["Turbidity_Median"].rolling(3).mean()
    combined["turb_flow"] = combined["turb_3day"] * combined["flow_7day_avg"]

    ops = load_reservoir_ops().shift(UPSTREAM_LAG_DAYS, freq="D")
    combined = combined.join(ops, how="left")

    features = [
        "Specific_Cond_Mean", "pH_Median", "month_sin", "month_cos",
        "flow_7day_avg", "turb_3day", "turb_flow", "Dissolved_Oxygen_Mean",
    ] + list(ops.columns)
    df = combined[features + ["Alk"]].dropna()
    return df[features], df["Alk"]


def backtest_svr(X, y, test_size, weight_condition, lag_days):
    """Best performer we found for TOC: SVR on scaled features."""
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
    weights = np.where(weight_condition(y_train), 1.5, 1.0)
    scaler = StandardScaler().fit(X_train)
    X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)

    search = GridSearchCV(SVR(), SVR_PARAM_GRID, cv=TimeSeriesSplit(n_splits=5), n_jobs=-1)
    search.fit(X_train_s, y_train, sample_weight=weights)
    model = search.best_estimator_
    preds = model.predict(X_test_s)

    latest_pred = model.predict(scaler.transform(X.iloc[[-1]]))[0]
    return package_result(y_test, preds, X, y, latest_pred, "SVR (RBF kernel, scaled features)", lag_days)


def backtest_rf(X, y, test_size, weight_condition, lag_days):
    """Best performer we found for alkalinity: random forest, grid-searched."""
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
    weights = np.where(weight_condition(y_train), 1.5, 1.0)

    search = GridSearchCV(RandomForestRegressor(random_state=42), RF_PARAM_GRID, cv=TimeSeriesSplit(n_splits=5), n_jobs=-1)
    search.fit(X_train, y_train, sample_weight=weights)
    model = search.best_estimator_
    preds = model.predict(X_test)

    latest_pred = model.predict(X.iloc[[-1]])[0]
    importance = dict(zip(X.columns, model.feature_importances_.round(4)))
    return package_result(y_test, preds, X, y, latest_pred,
                           "Random forest + upstream reservoir releases (grid search)", lag_days,
                           feature_importance=importance)


def package_result(y_test, preds, X, y, latest_pred, model_name, lag_days, feature_importance=None):
    series = [
        {"date": d.strftime("%Y-%m-%d"), "actual": round(float(a), 3), "predicted": round(float(p), 3)}
        for d, a, p in zip(y_test.index, y_test.values, preds)
    ]
    latest_date = X.index[-1]
    result = {
        "model": model_name,
        "lag_days": lag_days,
        "metrics": {
            "r2": round(r2_score(y_test, preds), 3),
            "rmse": round(root_mean_squared_error(y_test, preds), 3),
            "mape": round(mean_absolute_percentage_error(y_test, preds), 3),
            "test_days": len(y_test),
        },
        "series": series,
        "latest": {
            "date": latest_date.strftime("%Y-%m-%d"),
            "actual": round(float(y.iloc[-1]), 3),
            "predicted": round(float(latest_pred), 3),
            "inputs": {
                FEATURE_LABELS.get(col, col): round(float(X.iloc[-1][col]), 3)
                for col in X.columns
            },
        },
    }
    if feature_importance is not None:
        result["feature_importance"] = {col: float(v) for col, v in feature_importance.items()}
    return result


if __name__ == "__main__":
    toc_X, toc_y = build_toc_dataset()
    toc_result = backtest_svr(toc_X, toc_y, test_size=0.5, weight_condition=lambda y: y > 4.0, lag_days=2)
    print(f"TOC: R2={toc_result['metrics']['r2']} RMSE={toc_result['metrics']['rmse']} "
          f"over {toc_result['metrics']['test_days']} backtest days")

    alk_X, alk_y = build_alk_dataset()
    alk_result = backtest_rf(alk_X, alk_y, test_size=0.45, weight_condition=lambda y: y < 60.0, lag_days=UPSTREAM_LAG_DAYS)
    print(f"Alkalinity: R2={alk_result['metrics']['r2']} RMSE={alk_result['metrics']['rmse']} "
          f"over {alk_result['metrics']['test_days']} backtest days")

    output = {
        "_comment": "Generated by build_foothills_prediction.py. Do not edit by hand.",
        "note": (
            "A backtested demonstration of the TOC/alkalinity soft sensor, not a live "
            "forecast: every date here already has a known lab result, held out from "
            "training only by time. It shows what the model would have told an operator, "
            "using data it never trained on."
        ),
        "toc": toc_result,
        "alk": alk_result,
    }
    with open(OUT, "w") as f:
        json.dump(output, f, indent=1)
    print(f"Wrote {OUT}")
