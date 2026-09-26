"""
Reproduces Jake's TOC and Alkalinity soft-sensor pipelines from the shipped
data/ CSVs (same lags, engineered features, chronological splits, and sample
weights as scripts/TOC_SoftSensor.ipynb and scripts/Alkalinity_Soft_Sensor.ipynb),
then adds SVR and an MLP regressor alongside his linear-regression and random-forest
baselines, to check whether a different model family beats CatBoost's numbers in
guide.md (TOC R2 0.74 / RMSE 0.33, Alkalinity R2 0.68 / RMSE 5.20).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_percentage_error, r2_score, root_mean_squared_error
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit, train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

DATA = "data"

RF_PARAM_GRID = {
    "n_estimators": [100, 200],
    "max_depth": [3, 5, 7],
    "min_samples_leaf": [5, 10, 20],
    "max_features": [1.0, "sqrt"],
}
SVR_PARAM_GRID = {
    "kernel": ["rbf", "linear"],
    "C": [1, 10, 100],
    "epsilon": [0.1, 0.01],
}
MLP_PARAM_GRID = {
    "hidden_layer_sizes": [(16,), (32,), (32, 16)],
    "alpha": [0.001, 0.01, 0.1],
}


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

    features = [
        "Specific_Cond_Mean", "pH_Median", "month_sin", "month_cos",
        "flow_7day_avg", "turb_3day", "turb_flow", "Dissolved_Oxygen_Mean",
    ]
    df = combined[features + ["Alk"]].dropna()
    return df[features], df["Alk"]


def report(name, y_test, preds):
    print(
        f"  {name:<28} R2={r2_score(y_test, preds):.3f}  "
        f"RMSE={root_mean_squared_error(y_test, preds):.3f}  "
        f"MAPE={mean_absolute_percentage_error(y_test, preds):.3f}"
    )


def run_comparison(label, X, y, test_size, weight_condition):
    print(f"\n{label} ({len(X)} rows, {len(X.columns)} features)")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
    weights = np.where(weight_condition(y_train), 1.5, 1.0)
    tscv = TimeSeriesSplit(n_splits=5)

    # Baseline: linear regression, unweighted, as Jake's own point of comparison.
    linreg = LinearRegression().fit(X_train, y_train)
    report("Linear regression", y_test, linreg.predict(X_test))

    # Random forest, grid-searched, weighted -- Jake's existing model.
    rf_search = GridSearchCV(RandomForestRegressor(random_state=42), RF_PARAM_GRID, cv=tscv, n_jobs=-1)
    rf_search.fit(X_train, y_train, sample_weight=weights)
    report("Random forest (grid search)", y_test, rf_search.best_estimator_.predict(X_test))

    # SVR needs scaled features; it does support sample_weight directly.
    scaler = StandardScaler().fit(X_train)
    X_train_s, X_test_s = scaler.transform(X_train), scaler.transform(X_test)
    svr_search = GridSearchCV(SVR(), SVR_PARAM_GRID, cv=tscv, n_jobs=-1)
    svr_search.fit(X_train_s, y_train, sample_weight=weights)
    report("SVR (grid search)", y_test, svr_search.best_estimator_.predict(X_test_s))

    # MLPRegressor has no sample_weight support in scikit-learn; trained unweighted.
    mlp_search = GridSearchCV(
        MLPRegressor(max_iter=5000, early_stopping=True, random_state=42),
        MLP_PARAM_GRID, cv=tscv, n_jobs=-1,
    )
    mlp_search.fit(X_train_s, y_train)
    report("MLP (grid search, unweighted)", y_test, mlp_search.best_estimator_.predict(X_test_s))

    print("  Jake's CatBoost (from guide.md), for reference: see printed line above table")


if __name__ == "__main__":
    toc_X, toc_y = build_toc_dataset()
    run_comparison("TOC", toc_X, toc_y, test_size=0.5, weight_condition=lambda y: y > 4.0)

    alk_X, alk_y = build_alk_dataset()
    run_comparison("Alkalinity", alk_X, alk_y, test_size=0.45, weight_condition=lambda y: y < 60.0)

    print(
        "\nReference (guide.md, CatBoost, same weighting/splits):"
        "\n  TOC         R2=0.74  RMSE=0.33"
        "\n  Alkalinity  R2=0.68  RMSE=5.20"
    )
