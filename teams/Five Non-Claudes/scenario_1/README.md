# TOC & Alkalinity Prediction Viewer — Team Five Non-Claudes

Scenario 1 for the [Design Storm 2026](../../../README.md) challenge: a purpose-built web
app that predicts TOC and alkalinity arriving at Denver Water's Foothills treatment
plant from upstream signals. The model is a single-feature linear regression fitted
**live in the browser**.

The app has three tabs:

- **Live forecast** — the operator-facing view. It pulls *current* upstream conditions
  from public feeds, forecasts TOC and alkalinity for the next 1-7 days, checks each
  against an adjustable operating threshold, and states plainly what's coming. It
  answers the sketch's two questions ("do I need to change chemicals / request an
  upstream change?") descriptively — it never prescribes dosing, which stays the
  operator's call.
- **River map** — the same live forecast told as stops on a map of the South Platte:
  read left to right from today to furthest ahead: today's estimate beside the last
  lab sample, what arrives at the plant in 2 and in 4 days, then early signs at the
  headwaters (Hoosier Pass snowpack, Trumbull flow). Numbered cards match numbered pins; a pin marks where that stop's readings are
  taken, not a travel time. It uses the Live forecast's models and live feeds
  (`src/lib/useLiveInputs.js`, `src/lib/riverOutlook.js`), so the two tabs always
  agree. The map geometry is generated once by `python3 precompute_map.py` from the
  basin and river lines in `../../../strontia-brief/` (USGS NLDI) and the reservoir,
  dam and plant outlines in `geo/osm-strontia-foothills.json` (OpenStreetMap,
  fetched 2026-09-25). Conduit 26 is not in OpenStreetMap, so it is drawn as a
  straight dashed line.
  Below the map, **Inside Strontia Springs Reservoir** shows the profiling sonde's
  last week of casts by depth, in feet, with the intake gates marked (Top, 15, 45,
  65, 95 ft; 45 ft is the primary, from Cassidi's whiteboard sketch). Pick a gate to
  see turbidity, temperature, conductivity and chlorophyll there. The panel flags a
  week when the primary gate sat in a murky layer and names the clearest gate, but it
  doesn't pick one: Denver Water prefers 45 ft for reasons turbidity doesn't capture
  (`src/lib/sondeProfile.js`). Gate depths are taken as feet below the actual
  surface; if they are from full pool, the gates sit shallower. Gate choice does not
  feed the plant forecasts, because this one season of sonde data doesn't track the
  plant's lab values at any depth. `precompute.py` builds it into `series.json` as `sonde_profile`.
- **Explorer** — the analysis view. Pick a target, a feature, and a lead time (lag)
  and watch the model re-fit and re-score against the historical lab values, so you
  can judge which signals and lead times actually predict well. Includes the
  upstream-gage-vs-Strontia-sonde comparison.

## Live data sources (keyless, CORS-open)

The Live forecast tab fetches these in the browser; each falls back to the last
archived value if offline:

| Signal | Source |
|---|---|
| Turbidity, conductance | USGS IV, gage 06707525 (params 63680, 00095) |
| Streamflow | USGS IV, gage 06701900 (param 00060 — the WQ gage publishes no flow) |
| Snowpack SWE | NRCS SNOTEL, Hoosier Pass (531:CO:SNTL, WTEQ) |

### Mock aluminum sulfate — Al₂(SO₄)₃ — dose (illustrative, NOT a real calculation)

Its own section above the forecast (it's a "what to do now" recommendation), tagged
"MOCK" with the full caveat in a tooltip on that tag. We have no dosing formula. It is
a deliberately transparent toy relation anchored to one unverified example from the
Denver Water Q&A (≈3 mg/L TOC → ≈11 dose units): about 3.7 mg/L Al₂(SO₄)₃ per mg/L of
forecast TOC, nudged up when forecast alkalinity is below the watch line (low
alkalinity needs more coagulant to hold pH in the floc range). It moves with the
forecast for demo purposes but is not calibrated and must not be read as guidance. The
real thing it gestures at is Denver Water's operator Excel sheet, which we did not
have. (The Q&A notes use the operators' shorthand "alum"; the compound is aluminum
sulfate, Al₂(SO₄)₃.)

### Thresholds

Adjustable in the Live forecast tab.

- **TOC**: a single line, default ≥ 3 mg/L (a demo "elevated" cutoff, not a regulatory
  limit).
- **Alkalinity**: a two-tier band. A **watch** line at 60 mg/L (Jake's low-alkalinity
  line — Denver Water questions whether 60 is the acting number, so it's editable) and
  a firmer **act** line at 50 mg/L, below which the water becomes materially harder to
  treat. The recommendation escalates from "watch" to "act" as the forecast crosses
  each; the forecast chart draws both lines.

## Stack

- Vite + React front end.
- Recharts for charts.
- Vitest for the JS logic and components.
- A one-time Python precompute step (`precompute.py`) that turns the repo's CSVs into a
  single bundled `series.json` the app loads offline.

## Running it

```
# 1. From this folder, build the bundled data once (reads ../../../data/*.csv):
python3 precompute.py

# 2. Install and run the app:
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173/). `npm run build`
produces a static bundle in `dist/`; `npm run preview` serves that bundle.

The Explorer tab runs fully offline off the bundled `series.json`. The Live forecast
tab fetches current readings when online and falls back to the last archived value per
signal when not, labeling each as "live" or "archived" so nothing is misrepresented.

## Tests

```
npm test            # JS: data layer, features, regression, formatting, components
python3 test_precompute.py   # checks the generated series.json (run precompute first)
```

## How it works

```
../../../data/*.csv
      │  precompute.py  (once, offline; normalizes dates, drops the dirty DWR precip,
      │                  prefers Hoosier Pass snow, keeps gaps as gaps)
      ▼
public/series.json   {t, v} arrays per series, bundled into the app
      │  loadSeries + alignByDate            (src/lib/dataLayer.js)
      ▼
align by date → shift the predictor by N days → pair (feature, target)   (src/lib/features.js)
      │  fit y = a·x + b on the earlier half, score on the later half     (src/lib/regression.js)
      ▼
predicted-vs-actual chart + formula + R²/RMSE/MAE   (src/components/*)
```

- **Target**: TOC or alkalinity at the Foothills influent (the lab values).
- **Feature**: for TOC, turbidity × flow (the "loading" term the guide flags as the
  strongest single TOC predictor); for alkalinity, specific conductance. Both are
  selectable, along with a few others — including the **Strontia profiling sonde**
  (near-surface turbidity and conductivity), the closer-in sensor Cassidi starred.
- **Upstream gage vs Strontia sonde**: a comparison card contrasts the two sources for
  the current target. The upstream gage gives days of warning; the sonde sits at the
  plant intake and gives hours. The sonde only covers one partial 2026 season, so the
  card leads with that caveat rather than declaring a winner — the point is the
  lead-time-vs-proximity trade, and that more sonde data is needed to judge it.
- **Lead time (lag)**: the predictor is shifted forward N days, so the model learns
  "the river N days ago → the plant today". Defaults are 2 days for TOC, 4 for
  alkalinity, matching Jake's notebooks.
- **Honest scoring**: trained on the earlier half of the timeline, scored on the later
  half it never saw, no shuffling. R² of 0 means no better than guessing the average.

## On-stage script (about two minutes)

**Live forecast tab (the operator's view):**

1. "Denver Water only learns TOC and alkalinity after the water reaches the plant — a
   lab runs a grab sample. We're trying to see it coming a few days out from cheap
   upstream sensors."
2. Point at the current-conditions row. "This is the South Platte right now — turbidity,
   flow, conductance, snowpack, pulled live from USGS and NRCS." (If offline: "here it's
   showing the last archived day, labeled as such.")
3. Point at the recommendation card and the two threshold charts. "From today's reading
   the model projects TOC and alkalinity out seven days and checks each against the
   operating threshold. The card says, in plain language, whether and when we cross it —
   that's the heads-up an operator wants."
4. Point at the alkalinity chart's two lines. "Alkalinity has a band: a watch line at
   60 and an act line at 50 — below 50 the water gets materially harder to treat. The
   card escalates from 'watch' to 'act' as the forecast crosses each. And because
   Denver Water asks whether 60 is really their number, all of these are adjustable."
5. Point at the MOCK aluminum sulfate dose, and say the quiet part out loud. "This dose is a
   placeholder — we don't have their formula. It's anchored to one example from the
   Q&A and moves with the forecast, but it's labeled MOCK for a reason. The real
   version wraps their operator spreadsheet, which is exactly the plug-and-play tool
   they asked for."

**Explorer tab (how good is the model, really):**

6. "Here's TOC over four years. The orange line is what the lab actually measured. The
   dashed blue line is that same one-variable model." Point at the train/test divider:
   "it only learned from the left; everything right of the line is the honest test."
7. Read the formula and the test R² aloud. "One number, one line — and it already
   tracks the big spring peaks."
8. Drag the lead-time slider. "More lead time for the operators costs some accuracy —
   watch the score move. That trade is the whole question Denver Water put to us."
9. Toggle to Alkalinity. "Different signal — specific conductance, dissolved minerals —
   and a straight line explains about half the variation on its own."
10. Gesture at the upstream-signals panel. "These are the things that arrive before the
   water does. The one outlined in blue is what's driving the prediction right now."
11. Drop to the comparison card. "Cassidi starred one idea: the reservoir sonde, which
   sits right at the plant intake. It should be a sharper signal — but it buys you
   hours of warning instead of days, and we only have one partial season of it. So the
   honest answer is 'promising, go collect more,' not 'it wins.'"

## Known limitations (honest for the booth)

- One feature, one straight line, by design — it is the explainable baseline, not a
  finished forecaster. Jake's random forest / CatBoost do better and are documented in
  the repo's [`guide.md`](../../../guide.md).
- The data is **provisional**: USGS publishes immediately and revises later, so a live
  pull can differ from the bundled file, and a forecast inherits that.
- TOC is genuinely nonlinear; a single line catches the peaks but is unstable
  elsewhere. Alkalinity is the steadier of the two.

## Data terms

This app is built on data Denver Water provided. Their terms travel with it and with
anything derived from it:

> The water quality data is provided "as is." Water quality data provided to the user
> is provisional and subject to change, and the user should not assume that the data
> has undergone any quality assurance or quality control review. Denver Water makes no
> warranty of any kind, express or implied, concerning the data, including accuracy,
> reliability, completeness, timeliness, or usefulness.
> Copyright 2026, Denver Water. https://www.denverwater.org/about-us/how-we-operate/public-records

See [`data/TERMS.md`](../../../data/TERMS.md) for the full notices. Data from USGS, Colorado
DWR, USDA NRCS, and NOAA is public domain.
