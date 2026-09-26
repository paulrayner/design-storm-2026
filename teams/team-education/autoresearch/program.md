# Autoresearch program: filling in the Strontia sonde between casts

Human-edited. The agent follows this file and edits only `interpolate.py`.

## The task

The profiling sonde in Strontia Springs Reservoir takes a cast (surface to about 44 m)
every six hours, sometimes less often. The map shows a continuous picture, so values
between casts are filled in. `interpolate.py` does that: given the training readings,
predict the values at requested (time, depth) points.

The harness hides contiguous 6-hour blocks (usually one whole cast) and asks for the
hidden readings. So the real question is: **how well can a cast be reconstructed from the
casts around it?**

## Rules

- Edit only `autoresearch/interpolate.py`. Do not edit `prepare.py`, `evaluate.py`,
  or anything in `autoresearch/data/`.
- **Never open, read, load or print `autoresearch/data/lockbox.csv`**, and never run
  `evaluate.py --lockbox`. The lockbox is scored once, by a human, at the end.
- Do not read `dev.csv` inside `predict()` or tune constants by looking at dev rows.
  The only feedback is the score `evaluate.py` prints.
- Each experiment: make one change, run `.venv/bin/python autoresearch/evaluate.py`
  (from `teams/team-education/`), keep the change if the score is lower, otherwise revert.
  Budget about 60 seconds of run time per experiment.
- Log every attempt, kept or not, as one line in `autoresearch/results.tsv`:
  `n<TAB>score<TAB>kept(yes/no)<TAB>one-line description`.
- Keep the best version in `interpolate.py` at all times. Save a copy of every kept
  version as `autoresearch/kept/interpolate_<n>.py`.
- If a change beats the current best by more than 30% in one step, stop and check it
  for leakage (is anything from the hidden block reaching the prediction?) before
  keeping it. Say what you checked in the log line.
- At equal scores (within 0.002), prefer the simpler method.
- Physical sense matters: the result is drawn as a depth-by-time picture. A method
  that scores well by producing unphysical profiles (oscillations, values outside the
  range of the neighbouring casts for temperature) is not a winner.

## What is known (use it)

- Readings are provisional Denver Water data. Terms in `data/TERMS.md`.
- The `segment` column changes at sensor servicing events. Chlorophyll and ORP shift
  at every depth at once across a service event; do not blend across one if it hurts.
- Casts run every 6 hours until mid-July; after that some slots only cover the top 5 m.
- Temperature is smooth and stratified. Turbidity is spiky and is scored in log10.
- Neighbouring depths within a cast are highly correlated; so are neighbouring casts.

## Ideas worth trying (not a to-do list)

- Interpolate in time on a density or temperature coordinate instead of fixed depth
  (layers move up and down).
- Weight the bracketing casts by more than linear time distance; use 2 casts each side
  (cubic in time, monotone PCHIP).
- Blend in the time-of-day cycle (surface warming by day).
- Do not interpolate chlorophyll across a `segment` change; use the nearest cast in the
  same segment.
- Turbidity: interpolate log values; median of neighbours.
- Gaussian-process or kriging-style smoothers, kept small enough for the time budget.

## Done

Stop after about 25 experiments, or earlier if five in a row fail to improve. Finish with
a short summary at the bottom of `results.tsv` (as `#` comment lines): baseline score,
best score, what the best method does.
