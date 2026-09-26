"""Write map/strontia-lessons.json, the lessons on the pop-out page (map/strontia.html).

Audience: middle school, ages 13 to 16. Every number in the lesson text, and every highlight
region drawn on a picture, is computed here from the pipeline's outputs; the text templates
below only arrange them. Run after build_profile_json.py.

Reads:
  analysis/out/sonde_clean.csv      clean_sonde.py  (depth-band statistics use cast_kind == "full")
  analysis/out/casts.csv            clean_sonde.py  (how often the sonde sweeps)
  analysis/out/storm_numbers.json   storm_trace.py  (storm, plant and season numbers)
  analysis/out/storm_casts.csv      storm_trace.py  (the storm layer, cast by cast)
  map/strontia-profile.json         build_profile_json.py (colour-key ranges, depth axis)
  strontia-brief/places.json        Denver Water's "Eighty percent ..." sentence, quoted on the opening screen
  data/USGS_South_Platte.csv, data/SouthPlatteFlow.csv, data/FoothillsInfluent.csv (read-only)

Prints a table of every number used, with where it came from. The output is deterministic.

Text marked "why" is general science knowledge, not a finding from this data, and carries
no numbers. Denver Water provisional data; its terms travel with the file ("terms" field,
and map/DATA-TERMS.md next to it).
"""
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
TEAM = HERE.parent
REPO = TEAM.parents[1]
OUT = HERE / "out"
PROFILE = TEAM / "map" / "strontia-profile.json"
DEST = TEAM / "map" / "strontia-lessons.json"

SURF_MAX = 3.0     # "top" band: readings at most 3 m deep (as in storm_trace.season)
DEEP_MIN = 40.0    # "deep" band: readings at least 40 m deep (as in storm_trace.season)
EARLY_AUG = ("2026-08-01", "2026-08-12")   # the window storm_trace.season reports for the deep change
PCT_AXIS = (50, 100)   # lesson 3's "% full" chart: fixed y axis, so a flat line looks flat
GAGE_CLEAR = 10        # FNU; storm_trace.py's gage.first_above_10 / last_above_10 threshold
WPM, Q_SECONDS = 150, 20   # reading-time estimate: words per minute, plus seconds per question
REF_C = 25             # reference temperature of spcond_us_cm, °C (as in clean_sonde.py)

BLUE, ORANGE, AQUA = "#3987e5", "#d95926", "#199e70"   # dataviz categorical slots 1-3 (dark mode)


# ---- number bookkeeping ------------------------------------------------------------------------
class Numbers:
    """Formats each number for the text and remembers where it came from."""

    def __init__(self):
        self.rows, self.lesson = [], None

    def __call__(self, value, fmt, source):
        text = format(value, fmt)
        self.rows.append((self.lesson, text, source))
        return text

    def day(self, ts, source):
        t = pd.Timestamp(ts)
        text = f"{t:%b} {t.day}"
        self.rows.append((self.lesson, text, source))
        return text

    def clock(self, ts, source):
        t = pd.Timestamp(ts)
        h = t.hour % 12 or 12
        text = f"{h}:{t.minute:02d} {'a.m.' if t.hour < 12 else 'p.m.'}"
        self.rows.append((self.lesson, text, source))
        return text

    def part_of_day(self, ts, source):
        """Kid-friendly time of day from the clock hour ("around midday", ...)."""
        h = pd.Timestamp(ts).hour
        text = ("in the middle of the night" if h < 5 else "in the morning" if h < 11 else
                "around midday" if h < 14 else "in the afternoon" if h < 18 else
                "in the evening" if h < 22 else "late at night")
        self.rows.append((self.lesson, text, source))
        return text

    def days(self, hours, source):
        """A span in hours, said in half days ("about a day and a half" for 30 to 42 h)."""
        halves = int(round(hours / 12))
        words = {1: "half a day", 2: "a day", 3: "a day and a half", 4: "two days",
                 5: "two and a half days", 6: "three days"}
        text = words.get(halves, f"{halves / 2:g} days")
        self.rows.append((self.lesson, text, f"{source} ({hours:.1f} h, rounded to half days)"))
        return text

    def month(self, ts, source):
        text = f"{pd.Timestamp(ts):%B}"
        self.rows.append((self.lesson, text, source))
        return text

    def for_lesson(self, lid):
        return [{"text": t, "source": s} for l, t, s in self.rows if l == lid]


def words(text):
    return len(str(text).split())


def walk_strings(obj):
    """Every string inside a JSON value (for finding a quoted sentence in places.json)."""
    if isinstance(obj, dict):
        for v in obj.values():
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)
    elif isinstance(obj, str):
        yield obj


def iso(ts):
    return pd.Timestamp(ts).isoformat()


def daily_series(frame, col):
    s = frame.groupby(frame["time"].dt.normalize())[col].median()
    return s


def usgs_daily(name, date_col):
    d = pd.read_csv(REPO / "data" / name)
    d[date_col] = pd.to_datetime(d[date_col], format="%m/%d/%Y")
    return d.set_index(date_col)


def main():
    N = Numbers()
    P = json.loads(PROFILE.read_text())
    S = json.loads((OUT / "storm_numbers.json").read_text())
    G, R, RX, PL, SE = S["gage"], S["reservoir"], S["reservoir_extra"], S["plant"], S["season"]
    df = pd.read_csv(OUT / "sonde_clean.csv", parse_dates=["time"])
    full = df[df["cast_kind"] == "full"]
    top = full[full["depth_m"] <= SURF_MAX]
    deep = full[full["depth_m"] >= DEEP_MIN]
    month = lambda x: x.groupby(x["time"].dt.to_period("M"))
    top_m = month(top)[["temp_c", "odo_mg_l", "odo_pct_sat"]].median()
    deep_m = month(deep)[["temp_c", "odo_mg_l", "odo_pct_sat"]].median()
    casts = pd.read_csv(OUT / "casts.csv", parse_dates=["start"])
    storm_casts = pd.read_csv(OUT / "storm_casts.csv", parse_dates=["t"])
    season_view, storm_view = P["views"]["season"], P["views"]["storm"]
    season_t0 = pd.Timestamp(season_view["start"])
    season_t1 = season_t0 + pd.Timedelta(hours=season_view["n"] * season_view["step_h"])
    zmin, zmax = P["depths"][0], P["depths"][-1]

    # daily medians by depth band, for the line charts
    # (every calendar day, so days without a cast show as gaps rather than straight lines)
    top_d = top.groupby(top["time"].dt.normalize())[["temp_c", "odo_mg_l", "odo_pct_sat"]].median()
    deep_d = deep.groupby(deep["time"].dt.normalize())[["temp_c", "odo_mg_l", "odo_pct_sat"]].median()
    all_days = pd.date_range(min(top_d.index.min(), deep_d.index.min()),
                             max(top_d.index.max(), deep_d.index.max()), freq="D")
    top_d, deep_d = top_d.reindex(all_days), deep_d.reindex(all_days)

    def line(title, units, index, series, decimals=1):
        return {"type": "line", "title": title, "units": units,
                "x": [d.date().isoformat() for d in index],
                "series": [{"name": n, "color": c,
                            "values": [None if pd.isna(v) else round(float(v), decimals)
                                       for v in s.reindex(index)]} for n, c, s in series]}

    lessons = []

    # ---- 1. How to read the water scan ----------------------------------------------------------
    N.lesson = "read"
    dom = season_view["params"]["temp_c"]["domain"]
    sweep_h = casts.loc[casts["kind"] == "full", "start"].sort_values().diff().median() / pd.Timedelta(hours=1)
    src_p = "map/strontia-profile.json (build_profile_json.py)"
    lessons.append({
        "id": "read", "title": "How to read the water scan",
        "look": (f"This picture is like a scan of the reservoir. The top edge is the surface. "
                 f"The bottom edge is {N(zmax, 'd', src_p + ' depths, deepest row')} m deep. "
                 f"Time runs from left to right, from {N.day(season_t0, src_p + ' season view start')} "
                 f"to {N.day(season_t1 - pd.Timedelta(hours=1), src_p + ' season view end')}. "
                 f"The colour shows the water temperature."),
        "visuals": [{"type": "heat", "view": "season", "param": "temp_c"}],
        "question": {
            "prompt": "Pick one thin up-and-down stripe of colour in the picture. What does it show?",
            "choices": [
                {"text": "One sweep of the sonde: the temperature at every depth, at one moment", "correct": True},
                {"text": "The temperature across the lake, from one shore to the other", "correct": False,
                 "why_not": "It looks a bit like a map, but the sonde only moves up and down in one spot. "
                            "Left to right is time, not distance."},
                {"text": "One depth, followed through the whole season", "correct": False,
                 "why_not": "That would be a sideways row. A row follows one depth through time; an "
                            "up-and-down stripe is one moment at every depth."}],
            "explain": (f"The sonde rises from deep down to the surface about every "
                        f"{N(sweep_h, '.0f', 'casts.csv: median gap between full casts, hours')} hours, "
                        f"measuring as it goes. Each sweep becomes one thin stripe. On the key, dark navy "
                        f"is about {N(dom[0], '.1f', src_p + ' season temp_c colour-key low (1st percentile)')} °C "
                        f"and near-white about "
                        f"{N(dom[1], '.1f', src_p + ' season temp_c colour-key high (99th percentile)')} °C. "
                        f"Grey stripes mean no reading."),
        },
        "why": ("Scientists turn numbers into colours so the eye can spot patterns fast. Always check "
                "the key: the same colour means something different on every picture."),
        "comparison": "Comparison: it is like a weather map, but sliced straight down through the "
                      "water instead of across the land.",
        "link": "Read the scan",
        "connect": "This picture comes back in most lessons. Next: why the light (warm) colours sit on top.",
        "care": "The lake looks the same from the shore every day. This scan is how people can see "
                "what is happening deep down, where nobody can look.",
    })

    # ---- 2. Warm water floats ------------------------------------------------------------------
    N.lesson = "floats"
    warm_month = top_m["temp_c"].idxmax()                 # the month with the warmest top water
    m0 = warm_month.to_timestamp()
    m1 = (warm_month + 1).to_timestamp()
    src_m = f"sonde_clean.csv full casts, monthly median of readings"
    lessons.append({
        "id": "floats", "title": "Warm water floats",
        "look": (f"Look at the box: the top few metres in "
                 f"{N.month(m0, 'sonde_clean.csv: month with the highest top-3 m median temperature')}."
                 f" Compare its colour with the colours lower down."),
        "visuals": [{"type": "heat", "view": "season", "param": "temp_c",
                     "highlight": {"t0": iso(m0), "t1": iso(m1), "z0": zmin, "z1": SURF_MAX,
                                   "label": f"{m0:%B}, top {SURF_MAX:.0f} m"}}],
        "question": {
            "prompt": ("The warm (light) water stays in a band at the top, month after month. "
                       "Why doesn't it mix down and even out the lake?"),
            "choices": [
                {"text": "Warm water is lighter than cold water, so it floats on top", "correct": True},
                {"text": "The sun only heats the top, and heat can't travel down through water", "correct": False,
                 "why_not": "The sun does heat the top, but wind and waves stir water. They would carry the "
                            "heat down if all the water weighed the same. Warm water is lighter, so it stays up."},
                {"text": "Cold springs at the bottom keep the deep water cold", "correct": False,
                 "why_not": "Good guess from the name! But lakes with no springs at all also get a warm top "
                            "and a cold bottom in summer. The reason that works everywhere: warm water floats."}],
            "explain": (f"In {N.month(m0, 'sonde_clean.csv: warmest month')}, the top "
                        f"{N(SURF_MAX, '.0f', 'top band definition, m')} m was usually "
                        f"{N(top_m.loc[warm_month, 'temp_c'], '.1f', src_m + ', depth <= 3 m')} °C, and "
                        f"deeper than {N(DEEP_MIN, '.0f', 'deep band definition, m')} m only "
                        f"{N(deep_m.loc[warm_month, 'temp_c'], '.1f', src_m + ', depth >= 40 m')} °C. "
                        f"The biggest gap on one day was "
                        f"{N(SE['dt_max'], '.1f', 'storm_numbers.json season.dt_max')} °C, on "
                        f"{N.day(SE['dt_max_day'], 'storm_numbers.json season.dt_max_day')}. "
                        f"Even on the first day of data, "
                        f"{N.day(SE['dt_first_observed_day'][0], 'storm_numbers.json season.dt_first_observed_day')}, "
                        f"the top was "
                        f"{N(SE['dt_first_observed_day'][1], '.1f', 'storm_numbers.json season.dt_first_observed_day')} °C "
                        f"warmer, and the lake stayed layered until the data ends."),
        },
        "why": ("Warm water is lighter than cold water (scientists say less dense), so it floats on top "
                "like a lid. A lake with warm water on top of cold water is called stratified: layered."),
        "comparison": "Comparison: in a pool on a sunny day, the water at the surface feels warmer than "
                      "the water at your feet.",
        "link": "Warm floats",
        "connect": "Lesson 1: light means warm. So the light band on top is a warm layer, floating like a "
                   "lid on the cold water.",
        "care": "These layers decide where anything flowing into the lake ends up, including a storm's "
                "mud. You'll need this idea again and again.",
    })
    assert top_m.loc[warm_month, "temp_c"] > deep_m.loc[warm_month, "temp_c"]

    # ---- 3. Warm water holds less oxygen -------------------------------------------------------
    N.lesson = "oxygen"
    first_month = top_m.index.min()
    a, b = top_m.loc[first_month], top_m.loc[warm_month]
    lessons.append({
        "id": "oxygen", "title": "Warm water holds less oxygen",
        "look": ("These three charts show the top few metres of the reservoir, day by day: how warm it "
                 "was, how much oxygen was in it, and how full of oxygen it was compared with the most "
                 "it could hold. Follow each line from left to right."),
        "visuals": [
            line(f"Top {SURF_MAX:.0f} m: temperature (daily middle value)", "°C", top_d.index,
                 [("temperature", BLUE, top_d["temp_c"])]),
            line(f"Top {SURF_MAX:.0f} m: oxygen in the water (daily middle value)", "mg/L", top_d.index,
                 [("oxygen", BLUE, top_d["odo_mg_l"])], 2),
            # fixed 50-100 % axis so a flat line reads as flat (auto-scaling magnified wiggles)
            dict(line(f"Top {SURF_MAX:.0f} m: how full of oxygen, % of the most it could hold "
                      f"(axis fixed from {PCT_AXIS[0]}% to {PCT_AXIS[1]}%)", "%",
                      top_d.index, [("oxygen, % full", BLUE, top_d["odo_pct_sat"])]),
                 y=list(PCT_AXIS), y_suffix="%"),
        ],
        "question": {
            "prompt": (f"From {N.month(first_month.to_timestamp(), 'sonde_clean.csv: first month of data')} to "
                       f"{N.month(m0, 'sonde_clean.csv: warmest month')} the top water warmed up and its "
                       f"oxygen (mg/L) went down. But the \"% full\" chart hardly moved. What is the best "
                       f"explanation?"),
            "choices": [
                {"text": "Fish and other living things used up the oxygen", "correct": False,
                 "why_not": "If living things used oxygen faster than the air put it back, the water would "
                            "get less full, and the \"% full\" line would drop. It stayed flat."},
                {"text": "Warm water can't hold as much oxygen, and the water stayed about as full as it could be",
                 "correct": True},
                {"text": "Calm summer water mixes in less air, so less oxygen got in", "correct": False,
                 "why_not": "Then the water would be less full than it could be, and the \"% full\" line "
                            "would drop. It stayed flat: the water took in all the oxygen it could hold."}],
            "explain": (f"In the top {N(SURF_MAX, '.0f', 'top band definition, m')} m the temperature rose from "
                        f"{N(a['temp_c'], '.1f', src_m + ', depth <= 3 m, first month')} to "
                        f"{N(b['temp_c'], '.1f', src_m + ', depth <= 3 m, warmest month')} °C, and the oxygen "
                        f"fell from {N(a['odo_mg_l'], '.1f', src_m + ' odo_mg_l, depth <= 3 m, first month')} to "
                        f"{N(b['odo_mg_l'], '.1f', src_m + ' odo_mg_l, depth <= 3 m, warmest month')} mg/L "
                        f"(milligrams in each litre). But how full it was hardly changed: about "
                        f"{N(a['odo_pct_sat'], '.0f', src_m + ' odo_pct_sat, depth <= 3 m, first month')}% "
                        f"then about "
                        f"{N(b['odo_pct_sat'], '.0f', src_m + ' odo_pct_sat, depth <= 3 m, warmest month')}%. "
                        f"It could hold less, but it stayed just as full."),
        },
        "why": ("Gases such as oxygen dissolve better in cold water than in warm water. In warm water the "
                "tiny particles move faster, and gas escapes more easily."),
        "comparison": "Comparison: a warm can of soda goes flat faster than a cold one, because warm "
                      "liquid holds less gas.",
        "link": "Less oxygen",
        "connect": "Lesson 2: the sun warms the top layer most. Now add: warm water holds less gas. So the "
                   "warm top lost oxygen even though it touches the air.",
        "care": "On a hot day a lake, or a fish tank, holds less oxygen even when it is \"full\". That is "
                "one reason hot summers are hard on fish.",
    })
    assert b["odo_mg_l"] < a["odo_mg_l"] and b["temp_c"] > a["temp_c"]
    assert abs(b["odo_pct_sat"] - a["odo_pct_sat"]) < 3          # "% full hardly changed"
    assert PCT_AXIS[0] <= top_d["odo_pct_sat"].min() and top_d["odo_pct_sat"].max() <= PCT_AXIS[1]

    # ---- 4. The bottom is cut off from the air -------------------------------------------------
    N.lesson = "bottom"
    deep_all = deep["odo_pct_sat"].median()
    top_all = top["odo_pct_sat"].median()
    src_all = "sonde_clean.csv full casts, whole-season median of readings"
    month_list = ", ".join(
        f"{N.month(p.to_timestamp(), 'sonde_clean.csv month')} "
        f"{N(v, '.0f', src_m + ' odo_pct_sat, depth >= 40 m')}%"
        for p, v in deep_m["odo_pct_sat"].items())
    lessons.append({
        "id": "bottom", "title": "The bottom is cut off from the air",
        "look": (f"This picture shows how full of oxygen the water was, in % of the most it could hold. "
                 f"The box marks the deepest water, below {N(DEEP_MIN, '.0f', 'deep band definition, m')} m. The chart under it compares "
                 f"the top with the bottom, day by day."),
        "visuals": [
            {"type": "heat", "view": "season", "param": "odo_pct_sat",
             "highlight": {"t0": iso(season_t0), "t1": iso(season_t1), "z0": DEEP_MIN, "z1": zmax,
                           "label": f"deeper than {DEEP_MIN:.0f} m"}},
            line("How full of oxygen, % of the most it could hold (daily middle value)", "%",
                 top_d.index, [(f"top {SURF_MAX:.0f} m", BLUE, top_d["odo_pct_sat"]),
                               (f"deeper than {DEEP_MIN:.0f} m", ORANGE, deep_d["odo_pct_sat"])]),
        ],
        "question": {
            "prompt": (f"The deep water was less full of oxygen (about "
                       f"{N(deep_all, '.0f', src_all + ' odo_pct_sat, depth >= 40 m')}%) than the top "
                       f"(about {N(top_all, '.0f', src_all + ' odo_pct_sat, depth <= 3 m')}%). Why?"),
            "choices": [
                {"text": "It is far from the air, and the layers stop it mixing with the top", "correct": True},
                {"text": "Cold water holds less oxygen, so the cold deep water is less full", "correct": False,
                 "why_not": "It's the other way round (lesson 3): cold water can hold more. And \"% full\" "
                            "already allows for temperature, so the deep water really was missing oxygen."},
                {"text": "The pressure deep down squeezes oxygen out of the water", "correct": False,
                 "why_not": "Pressure does the opposite: it pushes more gas into water. That's why a soda "
                            "fizzes when you open it and the pressure drops."}],
            "explain": (f"Month by month, the deep water was this full: {month_list}. The good news: it never "
                        f"ran out. Its lowest daily middle value was "
                        f"{N(SE['deep_do_min_mg_l'][1], '.1f', 'storm_numbers.json season.deep_do_min_mg_l')} "
                        f"mg/L on {N.day(SE['deep_do_min_mg_l'][0], 'storm_numbers.json season.deep_do_min_mg_l')}, "
                        f"and the lowest single reading "
                        f"{N(SE['deep_all_readings_min_do_mg_l_after_qc'], '.1f', 'storm_numbers.json season.deep_all_readings_min_do_mg_l_after_qc')} mg/L."),
        },
        "why": ("Oxygen gets into a lake from the air at the surface, and from algae that make it in "
                "sunlight. Deep water is dark and far from the air. Down there, tiny living things "
                "called decomposers break down dead material and use up oxygen."),
        "comparison": "Comparison: like the back of a crowded room with the windows shut; the air near "
                      "the open door stays fresher.",
        "link": "Deep cut off",
        "connect": "Lesson 2: the warm top sits like a lid. Lesson 3: oxygen gets in at the top. Put "
                   "together, the deep water is cut off from its oxygen supply.",
        "care": "If deep water runs out of oxygen, the bottom mud can release metals such as iron and "
                "manganese that make water harder to treat (general science). This season it never ran out.",
    })

    assert deep_all < top_all

    # ---- 5. Cold river water sinks ------------------------------------------------------------
    N.lesson = "sinks"
    dd = {pd.Timestamp(k): v for k, v in SE["deep_aug1_12"].items()}
    dtemp = pd.Series({k: v[0] for k, v in dd.items()})
    ddo = pd.Series({k: v[1] for k, v in dd.items()})
    river = pd.Series({pd.Timestamp(k): v for k, v in SE["river_temp_mean_aug1_12"].items()})
    flow = pd.Series({pd.Timestamp(k): v for k, v in SE["flow_cfs_aug1_12"].items()})
    d_start = dtemp.idxmax()              # deep water warmest: the change starts here
    d_cold = dtemp.idxmin()               # deep water coldest
    do_hi = ddo.idxmax()                  # deep oxygen highest
    r_cold = river.idxmin()               # river coldest
    f_hi = flow.idxmax()                  # flow highest
    # the question says the river got colder than all the lake water: check it on the river's coldest day
    day = full[full["time"].dt.normalize() == r_cold]
    coldest_lake = day.groupby(day["depth_m"].round())["temp_c"].median().min()
    assert river[r_cold] < coldest_lake, (river[r_cold], coldest_lake)
    assert flow[f_hi] > flow[d_start] and ddo[do_hi] > ddo[d_start]
    idx = pd.date_range(*EARLY_AUG, freq="D")
    s_sn = "storm_numbers.json season."
    lessons.append({
        "id": "sinks", "title": "Cold river water sinks",
        "look": (f"These charts cover {N.day(idx[0], s_sn + 'deep_aug1_12 first day')} to "
                 f"{N.day(idx[-1], s_sn + 'deep_aug1_12 last day')}. The first compares the river "
                 f"flowing in with the deepest lake water. The second shows the oxygen in that deep "
                 f"water. The third shows how much river water was flowing in."),
        "visuals": [
            line("Temperature (daily)", "°C", idx,
                 [(f"lake, deeper than {DEEP_MIN:.0f} m", BLUE, dtemp), ("river flowing in", ORANGE, river)]),
            line(f"Oxygen in the lake deeper than {DEEP_MIN:.0f} m (daily middle value)", "mg/L", idx,
                 [("oxygen", BLUE, ddo)], 2),
            line("River flow into the reservoir, cubic feet per second", "cfs", idx,
                 [("river flow", ORANGE, flow)], 0),
        ],
        "question": {
            "prompt": (f"In early August the river got colder than any of the lake water (on "
                       f"{N.day(r_cold, s_sn + 'river_temp_mean_aug1_12, coldest day')} it was "
                       f"{N(river[r_cold], '.1f', s_sn + 'river_temp_mean_aug1_12 minimum')} °C; the lake's "
                       f"coldest was "
                       f"{N(coldest_lake, '.1f', 'sonde_clean.csv full casts: coldest 1 m daily median that day')} °C). "
                       f"Then the deepest water got colder and gained oxygen. Why is the extra oxygen a "
                       f"clue about where the river water went?"),
            "choices": [
                {"text": "The deep water got colder, so it could hold more oxygen", "correct": False,
                 "why_not": "Cold water can hold more (lesson 3), but being able to hold more doesn't put "
                            "any in. The deep water is cut off from the air (lesson 4), so the new oxygen "
                            "had to come from somewhere."},
                {"text": "Algae near the bottom made more oxygen", "correct": False,
                 "why_not": "Algae need sunlight to make oxygen, and the deep water is dark (lesson 4)."},
                {"text": "The bottom is cut off from the air, so new oxygen most likely arrived with new "
                         "water: the cold river", "correct": True}],
            "explain": (f"From {N.day(d_start, s_sn + 'deep_aug1_12, warmest deep day')} "
                        f"to {N.day(d_cold, s_sn + 'deep_aug1_12, coldest deep day')}, the deepest water "
                        f"cooled from {N(dtemp[d_start], '.1f', s_sn + 'deep_aug1_12 temperature')} to "
                        f"{N(dtemp[d_cold], '.1f', s_sn + 'deep_aug1_12 temperature')} °C, and its oxygen "
                        f"rose from {N(ddo[d_start], '.1f', s_sn + 'deep_aug1_12 oxygen')} to "
                        f"{N(ddo[do_hi], '.1f', s_sn + 'deep_aug1_12 oxygen, highest')} mg/L "
                        f"(by {N.day(do_hi, s_sn + 'deep_aug1_12, highest-oxygen day')}). "
                        f"Meanwhile the river cooled from "
                        f"{N(river[d_start], '.1f', s_sn + 'river_temp_mean_aug1_12')} to "
                        f"{N(river[r_cold], '.1f', s_sn + 'river_temp_mean_aug1_12')} °C, and its flow "
                        f"rose from {N(flow[d_start], '.0f', s_sn + 'flow_cfs_aug1_12')} to "
                        f"{N(flow[f_hi], '.0f', s_sn + 'flow_cfs_aug1_12, highest')} cubic feet per second. "
                        f"That fits cold river water sliding along the bottom: the team's best "
                        f"explanation, not something the data proves."),
        },
        "why": ("Cold water is heavier (denser) than warm water, so cold river water slides under the "
                "lake water to the bottom. A river tumbling over rocks picks up oxygen from the air and "
                "carries it down."),
        "comparison": "Comparison: cold air from an open freezer spills down onto your feet, not up "
                      "to your face.",
        "link": "Cold sinks",
        "connect": "Lesson 2 in reverse: cold water is heavy, so water colder than the whole lake sinks "
                   "to the bottom. Lesson 4: that is how new oxygen reaches the deep water.",
        "care": "Where river water ends up depends on its temperature. That same rule decides where a "
                "storm's mud goes. That's next.",
    })

    # ---- 6. Follow the storm's mud -------------------------------------------------------------
    N.lesson = "mud"
    s_r, s_g = "storm_numbers.json reservoir.", "storm_numbers.json gage."
    lay = storm_casts.dropna(subset=["layer_top"])
    lay = lay[(lay["t"] >= G["onset"][:10]) & (lay["depth_bottom"] >= 30)]
    storm_box = {"t0": iso(lay[lay["t"] >= pd.Timestamp(G["onset"]) - pd.Timedelta(hours=6)]["t"].min()),
                 "t1": iso(lay["t"].max()),
                 "z0": R["layer_top_median"], "z1": R["layer_bottom_median"],
                 "label": f"the muddy layer, about {R['layer_top_median']:.0f} to {R['layer_bottom_median']:.0f} m"}
    # premises of the question: river cooler than the surface, and the matching depth above the layer
    assert R["river_temp_mean_aug14_15"] < R["prestorm_temp_surface_1m"]
    assert R["depth_where_prestorm_reservoir_matches_river_temp"] < R["peak_depth"]
    lessons.append({
        "id": "mud", "title": "Follow the storm's mud",
        "look": ("The orange line on top is the river gage above the reservoir, measuring how muddy "
                 "(cloudy) the river was. The picture below shows how muddy the lake was at each depth. "
                 "The yellow dashed line marks when the river was muddiest."),
        "visuals": [{"type": "strip", "which": "gage"},
                    {"type": "heat", "view": "storm", "param": "turb_ntu", "highlight": storm_box}],
        "question": {
            "prompt": (f"The storm's mud showed up as a layer in the middle, not at the top or the bottom. "
                       f"Clue: the river water was about "
                       f"{N(R['river_temp_mean_aug14_15'], '.1f', s_r + 'river_temp_mean_aug14_15')} °C, and "
                       f"before the storm the lake was that warm at about "
                       f"{N(R['depth_where_prestorm_reservoir_matches_river_temp'], '.0f', s_r + 'depth_where_prestorm_reservoir_matches_river_temp')} m "
                       f"deep. Why the middle?"),
            "choices": [
                {"text": "Mud is light, so the muddy water floated up off the bottom", "correct": False,
                 "why_not": "Mud is heavier than water, so it makes water heavier, not lighter. That is "
                            "why the layer sat a bit deeper than the clue alone suggests."},
                {"text": "The river was cooler than the top but warmer than the deep water, so it slid in "
                         "where the lake matched its weight", "correct": True},
                {"text": "The river was colder than all the lake, but ran out of time before reaching the bottom",
                 "correct": False,
                 "why_not": "The clue says no: the lake had water as warm as the river, with colder water "
                            "below it. Water colder than everything goes all the way down (lesson 5)."}],
            "explain": (f"The river was muddiest "
                        f"{N.part_of_day(G['peak_time'], s_g + 'peak_time, hour of day')} on "
                        f"{N.day(G['peak_time'], s_g + 'peak_time')}, when the gage read "
                        f"{N(G['peak_turb_fnu'], '.0f', s_g + 'peak_turb_fnu')} FNU. In the lake, the "
                        f"muddiest spot was {N(R['peak_ntu'], '.1f', s_r + 'peak_ntu')} NTU at "
                        f"{N(R['peak_depth'], '.0f', s_r + 'peak_depth')} m deep, "
                        f"{N.part_of_day(R['peak_cast'], s_r + 'peak_cast, hour of day')} on "
                        f"{N.day(R['peak_cast'], s_r + 'peak_cast')}, about "
                        f"{N.days(R['hours_gage_peak_to_reservoir_peak'], s_r + 'hours_gage_peak_to_reservoir_peak')} "
                        f"after the river's peak. The muddy layer sat about "
                        f"{N(R['layer_top_median'], '.0f', s_r + 'layer_top_median')} to "
                        f"{N(R['layer_bottom_median'], '.0f', s_r + 'layer_bottom_median')} m deep, while the surface changed only "
                        f"a little. The surface had been "
                        f"{N(R['prestorm_temp_surface_1m'], '.1f', s_r + 'prestorm_temp_surface_1m')} °C "
                        f"before the storm, warmer than the river, so the river slid under it. (FNU and "
                        f"NTU are two units for cloudiness; bigger means muddier.)"),
        },
        "why": ("Water flowing into a lake sinks or floats until it meets lake water of the same "
                "weight (density). Mud makes water heavier, so muddy water goes a bit deeper still. Then "
                "it spreads sideways as a layer. Scientists call this an interflow."),
        "comparison": "Comparison: pour a sports drink gently into a glass of water and it can slide "
                      "under or between layers instead of mixing in.",
        "link": "Mud in the middle",
        "connect": "Lessons 2 and 5 again: water flowing in finds the depth that matches its weight. Warm "
                   "river: top. Cold river: bottom. In-between river: the middle.",
        "care": "From the shore the lake looked almost normal, but a muddy band was hiding in the middle. "
                "Operators need to know which depth the muddy water is at.",
    })

    # ---- 7. The muddy layer sinks and fades ----------------------------------------------------
    N.lesson = "fades"
    by_depth, by_ntu = RX["peak_depth_by_day"], RX["peak_ntu_by_day"]
    after = lay[lay["t"] >= pd.Timestamp(R["peak_cast"])]
    fade_box = {"t0": iso(R["peak_cast"]), "t1": iso(after["t"].max()),
                "z0": float(after["layer_top"].min()), "z1": float(after["layer_bottom"].max()),
                "label": "after the peak"}
    s_x = "storm_numbers.json reservoir_extra."
    # each daily dot sits at the mean time of that day's layer casts (the casts behind the daily value)
    day_time = {str(d.date()): g["t"].mean().round("min") for d, g in lay.groupby(lay["t"].dt.normalize())}
    assert sorted(day_time) == sorted(by_depth)
    ks = sorted(by_depth)
    assert by_depth[ks[-1]] > by_depth[ks[0]] and by_ntu[ks[-1]] < max(by_ntu.values())   # sank and faded
    days_text = "; ".join(
        f"{N.day(k, s_x + 'peak_depth_by_day')}: {N(by_depth[k], 'g', s_x + 'peak_depth_by_day')} m, "
        f"{N(by_ntu[k], '.1f', s_x + 'peak_ntu_by_day')} NTU" for k in sorted(by_depth))
    lessons.append({
        "id": "fades", "title": "The muddy layer sinks and fades",
        "look": ("Same picture. The white dots mark the usual depth of the muddiest spot on each day. "
                 "Watch where the dots go after the peak, inside the box."),
        "visuals": [{"type": "heat", "view": "storm", "param": "turb_ntu", "highlight": fade_box,
                     "points": [[iso(day_time[k]), by_depth[k]] for k in sorted(by_depth)]}],
        "question": {
            "prompt": "After the peak, the white dots go deeper each day and the layer gets paler. What best explains both?",
            "choices": [
                {"text": "New muddy river water kept arriving and pushed the layer down", "correct": False,
                 "why_not": (f"The river gage was back under "
                             f"{N(GAGE_CLEAR, 'd', 'storm_trace.py: threshold behind gage.last_above_10, FNU')} FNU "
                             f"after {N.part_of_day(G['last_above_10'], s_g + 'last_above_10, hour of day')} on "
                             f"{N.day(G['last_above_10'], s_g + 'last_above_10')}, so little new mud was "
                             f"coming in. Something inside the lake moved the layer.")},
                {"text": "Mud is heavier than water, so it slowly settles, and the layer loses mud as it sinks",
                 "correct": True},
                {"text": "The mud dissolved into the water, like sugar in tea", "correct": False,
                 "why_not": "Mud is tiny bits of rock and soil that don't dissolve. And dissolving wouldn't "
                            "make the layer move deeper."}],
            "explain": (f"Day by day, the usual depth of the muddiest spot, and the muddiest reading: "
                        f"{days_text}. It was still there when the data ends: at "
                        f"{N.clock(R['last_cast'], s_r + 'last_cast')} on "
                        f"{N.day(R['last_cast'], s_r + 'last_cast')} the layer was "
                        f"{N(R['last_cast_layer'][0], '.0f', s_r + 'last_cast_layer')} to "
                        f"{N(R['last_cast_layer'][1], '.0f', s_r + 'last_cast_layer')} m deep."),
        },
        "why": ("Mud is tiny bits of soil and rock, heavier than water, so they slowly settle. As they "
                "drop out, the layer gets less muddy. (The data cannot tell settling apart from some of "
                "the layer leaving through the dam's outlets.)"),
        "comparison": "Comparison: like a snow globe after you stop shaking it, the flakes drift down "
                      "and the water clears from the top.",
        "link": "Mud settles",
        "connect": "Lesson 6: mud made the storm water ride a bit deeper. Now that same weight slowly "
                   "pulls the mud down.",
        "care": "The muddy band lasted for days after the river cleared, and drifted deeper. So what an "
                "intake draws in can depend on a storm for days afterwards.",
    })

    # ---- 8. Mud and rainwater travel together --------------------------------------------------
    N.lesson = "minerals"
    service_in_storm = pd.Timestamp(R["service_events_in_window"][0])   # conductance steps across it
    thru = lay[lay["t"] < service_in_storm]["layer_spcond_change"]
    lo_drop, hi_drop = float(-thru.max()), float(-thru.min())
    s_c = "storm_casts.csv layer_spcond_change, storm casts before that service event"
    lessons.append({
        "id": "minerals", "title": "Mud and rainwater travel together",
        "look": ("Now the picture shows specific conductance: how easily electricity passes through "
                 "the water. More dissolved minerals (like tiny bits of salt from rocks) means a higher "
                 "number. The box is the same muddy layer."),
        "visuals": [{"type": "heat", "view": "storm", "param": "spcond_us_cm", "highlight": storm_box}],
        "question": {
            "prompt": ("The muddy layer had fewer dissolved minerals than the same depths before the storm. "
                       "What is the best explanation?"),
            "choices": [
                {"text": "It was fresh rainwater, which has few minerals, arriving with the mud", "correct": True},
                {"text": "The storm water was a bit warmer, and warm water holds fewer minerals", "correct": False,
                 "why_not": "Minerals don't leave water when it warms up. And this picture is corrected to "
                            "one standard temperature, so temperature isn't the answer."},
                {"text": "The minerals sank to the bottom with the mud", "correct": False,
                 "why_not": "Dissolved minerals are mixed right into the water, like salt in soup, so they "
                            "don't settle out. And the river already had fewer minerals as the storm arrived."}],
            "explain": (f"Until the sensor was serviced on "
                        f"{N.day(service_in_storm, s_r + 'service_events_in_window')}, the muddy layer "
                        f"read about {N(lo_drop, '.0f', s_c + ', smallest drop')} to "
                        f"{N(hi_drop, '.0f', s_c + ', largest drop')} µS/cm lower than the same depths "
                        f"before the storm. The river showed the same thing: at the gage it fell from "
                        f"{N(G['spcond_before_onset_median'], 'g', s_g + 'spcond_before_onset_median')} to "
                        f"{N(G['spcond_min'], '.0f', s_g + 'spcond_min')} µS/cm as the storm water "
                        f"arrived. So the mud and the rainwater arrived together, in the same layer."),
        },
        "why": ("Rain is almost pure water, with very few dissolved minerals. River water carries "
                "minerals picked up slowly from rocks and soil. A storm adds rainwater quickly, so the "
                "river gets muddier but its minerals get watered down."),
        "comparison": "Comparison: add water to a glass of juice and it tastes weaker, even though "
                      "none of the juice went away.",
        "link": "Rainwater tag",
        "connect": "Lesson 6 followed the mud into the middle. This second clue shows the rainwater landed "
                   "in the same layer. Two clues, one layer.",
        "care": "When two different measurements point to the same layer, the team can be more sure it "
                "really is storm water.",
    })
    assert lo_drop > 0 and G["spcond_min"] < G["spcond_before_onset_median"]

    # ---- 9. What reaches the water plant -------------------------------------------------------
    N.lesson = "plant"
    s_p = "storm_numbers.json plant."
    first_up = PL["toc_first_day_above_baseline"]
    base_days = sorted(k for k in PL["toc_aug10_19"] if k < first_up)
    inf = usgs_daily("FoothillsInfluent.csv", "DATE")
    years = inf.loc[inf.index.month.isin([6, 7, 8]), "TOC_mg_L"].diff().dropna().index.year
    lessons.append({
        "id": "plant", "title": "What reaches the water plant",
        "look": ("The top line is the river's mud at the gage again. The green line below is the "
                 "organic carbon (TOC) in the water arriving at the Foothills treatment plant, measured "
                 "once a day in a lab."),
        "visuals": [{"type": "strip", "which": "gage"}, {"type": "strip", "which": "toc"}],
        "question": {
            "prompt": (f"The plant's organic carbon jumped on "
                       f"{N.day(first_up, s_p + 'toc_first_day_above_baseline')}. "
                       f"Can we be sure the storm caused it?"),
            "choices": [
                {"text": "Yes: it jumped the day after the river's muddiest moment", "correct": False,
                 "why_not": "Timing is a strong clue, but two things can line up by chance. With one storm "
                            "and an unknown intake depth, \"probably\" is the honest answer."},
                {"text": "Probably, but we need more information", "correct": True},
                {"text": "No: the mud stayed in the middle of the lake, so it couldn't reach the plant",
                 "correct": False,
                 "why_not": (f"That depends on the depth the plant takes its water from, and nobody has told "
                             f"us. If the intake is about "
                             f"{N(R['layer_top_median'], '.0f', s_r + 'layer_top_median')} to "
                             f"{N(R['layer_bottom_median'], '.0f', s_r + 'layer_bottom_median')} m deep, it "
                             f"was drawing from the muddy layer.")}],
            "explain": (f"Organic carbon was "
                        f"{N(PL['toc_baseline_aug10_15'][1], '.1f', s_p + 'toc_baseline_aug10_15')} mg/L "
                        f"every day from {N.day(base_days[0], s_p + 'toc_aug10_19')} to "
                        f"{N.day(base_days[-1], s_p + 'toc_aug10_19')}, then "
                        f"{N(PL['toc_max_after'], '.1f', s_p + 'toc_max_after')} mg/L on "
                        f"{N.day(first_up, s_p + 'toc_first_day_above_baseline')}. "
                        f"A jump that big is rare: in the summers of "
                        f"{N(int(years.min()), 'd', 'FoothillsInfluent.csv: first year with summer data')} to "
                        f"{N(int(years.max()), 'd', 'FoothillsInfluent.csv: last year')}, only "
                        f"{N(100 * PL['share_of_summer_daily_toc_changes_at_least_that_big'], '.1f', s_p + 'share_of_summer_daily_toc_changes_at_least_that_big')}% "
                        f"of {N(PL['summer_daily_toc_changes_n'], 'd', s_p + 'summer_daily_toc_changes_n')} "
                        f"day-to-day changes were that big, and it came the day after the river's "
                        f"muddiest moment. But one storm cannot prove it. The missing clue: nobody has "
                        f"told us how deep the plant's water intake is. If it takes in water from about "
                        f"{N(R['layer_top_median'], '.0f', s_r + 'layer_top_median')} to "
                        f"{N(R['layer_bottom_median'], '.0f', s_r + 'layer_bottom_median')} m deep, it was "
                        f"taking in the muddy layer."),
        },
        "why": ("Organic carbon is tiny bits of dead leaves, soil and plant material in the water. "
                "Storms wash it off the land into rivers. Good scientists say \"probably\" when two "
                "things line up once; they want more storms, or the missing measurement, before they "
                "say one thing caused the other."),
        "comparison": "Comparison: if the cookie jar is empty right after your brother walks by, he "
                      "is a suspect, but you would still want more evidence.",
        "link": "The plant",
        "connect": "The chain so far: the storm water found its depth (lesson 6), stayed for days (lesson "
                   "7) and carried rainwater with it (lesson 8). The missing link to the plant is the "
                   "intake depth.",
        "care": "Organic carbon makes water harder to treat, so the plant adjusts its treatment when it "
                "rises. Knowing a day ahead which depth the storm water is at would help operators get ready.",
    })

    # ---- Put it all together: a what-if -------------------------------------------------------
    # A made-up situation, labelled as one. Its text carries no invented measurements: the only
    # numbers are real ones from earlier lessons (the first day's top-to-bottom gap).
    N.lesson = "together"
    s_se = "storm_numbers.json season.dt_first_observed_day"
    lessons.append({
        "id": "together", "title": "Put it all together: a cold, muddy spring storm", "whatif": True,
        "look": (f"What if? This storm is made up, to test your thinking; nothing here was measured. "
                 f"Imagine heavy spring rain on melting snow. The river turns muddy, and it is colder "
                 f"than every layer of the lake, even the bottom. The lake is already layered: on "
                 f"{N.day(SE['dt_first_observed_day'][0], s_se)} the top was "
                 f"{N(SE['dt_first_observed_day'][1], '.1f', s_se)} °C warmer than the deep water. "
                 f"The picture is the real August storm, for comparison."),
        "visuals": [{"type": "heat", "view": "storm", "param": "turb_ntu", "highlight": storm_box,
                     "note": "For comparison, the real August storm (not the what-if)"}],
        "questions": [
            {"prompt": "Where would this storm's muddy water go?",
             "choices": [
                 {"text": "Into the middle, like the August storm", "correct": False,
                  "why_not": "The August river was in-between: warmer than the deep water. This river is "
                             "colder than everything, and mud makes it heavier still, so nothing stops it "
                             "before the bottom."},
                 {"text": "Through the whole lake, because a storm stirs everything up", "correct": False,
                  "why_not": "A layered lake doesn't mix easily (lesson 2). Water flowing in slides to the "
                             "depth that matches its weight (lessons 5 and 6)."},
                 {"text": "Down along the bottom", "correct": True}],
             "explain": ("Cold water is heavier than warm water, and mud makes it heavier still. Water "
                         "colder than every layer keeps sinking until it reaches the bottom, like the "
                         "cold river in early August (lesson 5).")},
            {"prompt": "Over the next days, what would the sonde's pictures most likely show?",
             "choices": [
                 {"text": "A muddy band near the bottom, a fairly clear top, and a little more oxygen "
                          "deep down", "correct": True},
                 {"text": "Muddy water at every depth at the same moment", "correct": False,
                  "why_not": "A storm doesn't change every depth at once. Its water arrives as a layer at "
                             "the depth that matches its weight (lessons 6 and 7)."},
                 {"text": "A muddy band near the bottom, with less oxygen, because the layers act like a lid",
                  "correct": False,
                  "why_not": "The lid blocks air from the top, but this water comes in from the side, along "
                             "the bottom. River water that tumbled over rocks carries oxygen with it (lesson 5)."}],
             "explain": ("The mud would show as a band near the bottom, fading slowly as it settles "
                         "(lesson 7). The deep oxygen would likely rise, as it did in early August when "
                         "a cold river reached the bottom. This is a prediction, not a measurement.")},
            {"prompt": "Suppose the plant's intake were near the surface. Would the plant notice this storm quickly?",
             "choices": [
                 {"text": "Yes, just as fast: the plant gets the same water from the whole lake", "correct": False,
                  "why_not": "A layered lake is not the same everywhere (lesson 2). An intake mostly draws "
                             "water from around its own depth."},
                 {"text": "Probably not much at first, because the storm water slid in underneath the intake",
                  "correct": True},
                 {"text": "Never: the muddy water can never reach the plant", "correct": False,
                  "why_not": "\"Never\" is too strong. In autumn the top cools and the layers mix again "
                             "(general science), so what is left of the storm water can spread upward."}],
             "explain": ("With the storm water along the bottom and the intake near the top, the plant "
                         "would probably see little change at first. Flip it: a warm storm floats, so a "
                         "shallow intake would get it fast. Either way, the answer depends on the intake "
                         "depth, the missing clue from lesson 9.")},
        ],
        "why": ("Everything here comes from one idea: water finds the depth that matches its weight. "
                "Temperature sets most of that weight, and mud adds to it. Layers keep water from "
                "mixing, so what flows in stays at its own depth for a while."),
        "comparison": "Comparison: in a layered drink, each liquid poured in carefully settles at its "
                      "own level.",
        "link": "What if",
        "connect": "You just used the whole chain: temperature sets weight (lesson 2), weight picks the "
                   "depth (lessons 5 and 6), new water brings oxygen to the cut-off bottom (lesson 4), mud "
                   "settles (lesson 7), and the intake depth decides what the plant gets (lesson 9).",
        "care": "This is what the team hopes the sonde can do for real: show operators which depth a "
                "storm's water is at, before it reaches the plant.",
    })

    # ---- Bonus. Data detective -----------------------------------------------------------------
    N.lesson = "detective"
    svc = df.groupby("segment")["time"].min().sort_index().iloc[1:]
    seg_chl = df.groupby("segment")["chl_ug_l"].median()
    step = seg_chl.diff().iloc[1:]                       # change at each service event
    k = int(step.idxmin())                               # the event with the biggest chlorophyll drop
    ev = svc.loc[k]
    s_s = "sonde_clean.csv: first reading of each segment (service events)"
    dates = ", ".join(N.day(t, s_s) for t in svc)
    lessons.append({
        "id": "detective", "title": "Data detective", "bonus": True,
        "look": ("This picture shows chlorophyll, a sign of algae. The dotted lines mark dates the "
                 "team spotted something odd. Look inside the box."),
        "visuals": [{"type": "heat", "view": "season", "param": "chl_ug_l",
                     "highlight": {"t0": iso(ev - pd.Timedelta(days=2)), "t1": iso(ev + pd.Timedelta(days=2)),
                                   "z0": zmin, "z1": zmax, "label": f"{ev:%b} {ev.day}"}}],
        "question": {
            "prompt": (f"On {N.day(ev, s_s + ', biggest chlorophyll drop')} every depth changed at the "
                       f"same moment. What is most likely?"),
            "choices": [
                {"text": "The layers flipped over and the whole lake mixed", "correct": False,
                 "why_not": "Mixing a whole lake takes time, and this lake stayed layered all season "
                            "(lesson 2). It can't mix top to bottom between one sweep and the next."},
                {"text": "Someone cleaned or adjusted the sensor", "correct": True},
                {"text": "Storm water rushed in and changed the water", "correct": False,
                 "why_not": "Storm water arrives as a layer at one depth and spreads over hours and days "
                            "(lessons 6 and 7). It doesn't change every depth at the same moment."}],
            "explain": (f"A real lake does not change "
                        f"at every depth at the very same moment. On {N.day(ev, s_s)} the middle "
                        f"chlorophyll reading dropped from "
                        f"{N(seg_chl.loc[k - 1], '.2f', 'sonde_clean.csv: median chl_ug_l of the segment before')} "
                        f"to {N(seg_chl.loc[k], '.2f', 'sonde_clean.csv: median chl_ug_l of the segment after')} "
                        f"µg/L. A negative amount of algae is impossible, which is another clue that the "
                        f"sensor changed, not the water. The team found "
                        f"{N(len(svc), 'd', s_s + ', count')} dates like this: {dates}. Denver Water has "
                        f"not yet told us what was done on those days."),
        },
        "why": ("Sensors that live underwater get coated with slime and silt, so people clean them and "
                "check them against known standards (calibrate them). Right after that, readings can "
                "jump. Data detectives look for changes that are too sudden, or too perfectly lined up, "
                "to be real."),
        "comparison": "Comparison: if every clock in your house jumps by the same amount at once, "
                      "someone reset the clocks; time did not speed up.",
        "link": "Sensor clues",
        "connect": "Lesson 1: every stripe is one sweep. When every depth jumps at once, between one "
                   "sweep and the next, suspect the sensor, not the lake.",
        "care": "If nobody spotted these dates, someone could mistake a cleaned sensor for a change in "
                "the lake and draw the wrong conclusion.",
    })
    assert seg_chl.loc[k] < 0

    # ---- Bonus 2. The sensor that forgot about temperature -------------------------------------
    # The sonde logs conductivity at the water's own temperature (see analysis/QC.md). clean_sonde.py
    # adds spcond_us_cm, the same reading corrected to REF_C; here we show why that was needed.
    N.lesson = "tempcorr"
    s_q = "sonde_clean.csv full casts"
    corr_raw = float(full.groupby("cast").apply(lambda c: c["temp_c"].corr(c["cond_us_cm"])).median())
    corr_sc = round(float(full.groupby("cast").apply(lambda c: c["temp_c"].corr(c["spcond_us_cm"])).median()), 2) + 0.0
    n_casts = int(full["cast"].nunique())
    # the warmest month's typical profile: at each whole metre, the middle value of every full cast
    # that month (one sweep can be odd, e.g. just before a service event; the month's median is not)
    wm = full[(full["time"] >= m0) & (full["time"] < m1)]
    prof = wm.groupby(wm["depth_m"].round())[["temp_c", "cond_us_cm", "spcond_us_cm"]].median().sort_index()
    ct, cd = wm[wm["depth_m"] <= SURF_MAX], wm[wm["depth_m"] >= DEEP_MIN]
    usgs = usgs_daily("USGS_South_Platte.csv", "Date")["Specific_Cond_Mean"]
    gage_m = float(usgs.loc[m0:m1 - pd.Timedelta(days=1)].median())
    # month comparisons with the river gage: June, and early August before the storm
    def window(a, b):
        w = full[(full["time"] >= a) & (full["time"] < pd.Timestamp(b) + pd.Timedelta(days=1))]
        return (float(w["cond_us_cm"].median()), float(w["spcond_us_cm"].median()),
                float(usgs.loc[a:b].median()))
    jun = window("2026-06-01", "2026-06-30")
    aug = window(*EARLY_AUG)
    s_u = "USGS_South_Platte.csv Specific_Cond_Mean"
    src_c = f"{s_q}, warmest month"

    def prof_line(title, units, series, ref=None):
        v = {"type": "profile", "title": title, "units": units,
             "depths": [float(z) for z in prof.index],
             "series": [{"name": n, "color": col, "values": [round(float(x), 1) for x in prof[k]]}
                        for n, col, k in series]}
        if ref:
            v["ref"] = ref
        return v

    lessons.append({
        "id": "tempcorr", "title": "The sensor that forgot about temperature", "bonus": True,
        "look": (f"These two charts show a typical sweep of the sonde in "
                 f"{N.month(m0, 'sonde_clean.csv: warmest month')}, from the surface (top) down to the "
                 f"bottom: at each depth, the middle value of all that month's sweeps. The first chart is "
                 f"the temperature. The second chart shows conductivity, how easily electricity passes "
                 f"through the water. The orange line is what the sensor logged. The blue line is the same "
                 f"reading after the team's correction. The dashed line is the river gage that month."),
        "visuals": [
            prof_line(f"{m0:%B}, typical sweep: temperature by depth", "°C",
                      [("temperature", BLUE, "temp_c")]),
            prof_line(f"{m0:%B}, typical sweep: conductivity by depth", "µS/cm",
                      [("raw, as logged", ORANGE, "cond_us_cm"),
                       (f"corrected to {REF_C} °C", BLUE, "spcond_us_cm")],
                      {"value": round(gage_m, 1), "label": f"river gage, {m0:%B} middle value"}),
        ],
        "question": {
            "prompt": "The raw reading (orange) was higher near the warm surface than in the cold deep water. Why?",
            "choices": [
                {"text": "More minerals flowed in near the surface", "correct": False,
                 "why_not": "Then the corrected (blue) line would lean too. It stands almost straight up and "
                            "down, so the minerals were about the same at every depth."},
                {"text": "Warm water dissolves more minerals, like sugar in hot tea", "correct": False,
                 "why_not": "Hot tea can dissolve more sugar, but only if you add more sugar. The corrected "
                            "line shows the amount of minerals was about the same at every depth."},
                {"text": "Warm water lets electricity pass more easily", "correct": True}],
            "explain": (f"In {N.month(m0, 'sonde_clean.csv: warmest month')} the top {N(SURF_MAX, '.0f', 'top band definition, m')} m was "
                        f"{N(ct['temp_c'].median(), '.1f', src_c + ', median of readings, temp_c, depth <= 3 m')} °C and "
                        f"the water deeper than {N(DEEP_MIN, '.0f', 'deep band definition, m')} m was "
                        f"{N(cd['temp_c'].median(), '.1f', src_c + ', median temp_c, depth >= 40 m')} °C. "
                        f"The raw reading went from "
                        f"{N(ct['cond_us_cm'].median(), '.0f', src_c + ', median cond_us_cm, depth <= 3 m')} µS/cm "
                        f"at the top to "
                        f"{N(cd['cond_us_cm'].median(), '.0f', src_c + ', median cond_us_cm, depth >= 40 m')} "
                        f"at the bottom: the same shape as the temperature. In all "
                        f"{N(n_casts, 'd', s_q + ', number of casts')} full sweeps, the raw reading and the "
                        f"temperature moved together almost perfectly: a match score (correlation) of "
                        f"{N(corr_raw, '.2f', s_q + ': median within-cast correlation, temp_c vs cond_us_cm')} "
                        f"out of 1. After correcting every reading to what it would be at "
                        f"{N(REF_C, 'd', 'clean_sonde.py reference temperature, °C')} °C, the score was "
                        f"{N(corr_sc, '.2f', s_q + ': median within-cast correlation, temp_c vs spcond_us_cm')}: "
                        f"no link at all. The corrected line stands almost straight up and down ("
                        f"{N(ct['spcond_us_cm'].median(), '.0f', src_c + ', median spcond_us_cm, depth <= 3 m')} "
                        f"at the top, "
                        f"{N(cd['spcond_us_cm'].median(), '.0f', src_c + ', median spcond_us_cm, depth >= 40 m')} "
                        f"at the bottom), so the minerals were about the same at every depth. It also agrees "
                        f"with the river: in June the corrected lake reading was about "
                        f"{N(jun[1], '.0f', s_q + ', June median spcond_us_cm')} µS/cm and the river gage about "
                        f"{N(jun[2], '.0f', s_u + ', June median of daily means')}; in early August, before the "
                        f"storm, {N(aug[1], '.0f', s_q + ', Aug 1-12 median spcond_us_cm')} and "
                        f"{N(aug[2], '.0f', s_u + ', Aug 1-12 median of daily means')}. The raw readings, "
                        f"{N(jun[0], '.0f', s_q + ', June median cond_us_cm')} and "
                        f"{N(aug[0], '.0f', s_q + ', Aug 1-12 median cond_us_cm')}, were far below the river. "
                        f"The sensor was not broken. It logged the reading without the temperature "
                        f"correction, so the team corrected it before using it. Denver Water has not yet "
                        f"confirmed the sensor's setting."),
        },
        "why": ("Electricity travels through water on dissolved minerals, which are tiny charged "
                "particles called ions. In warm water those particles move faster, so electricity "
                "passes more easily, even when the amount of minerals is exactly the same. So "
                "scientists convert every reading to what it would be at one standard temperature. "
                "The corrected number is called specific conductance, and it follows only the minerals."),
        "comparison": "Comparison: to compare two runners fairly, you would not time one with the wind "
                      "at her back and the other running into it; you take the wind out first.",
        "link": "Temperature fix",
        "connect": "Lesson 8 used the corrected reading to follow rainwater. This is why it had to be "
                   "corrected first: raw, it mostly shows lesson 2's warm top.",
        "care": "Without the correction, the lake would seem to have far fewer minerals than the river "
                "flowing into it: a false alarm.",
    })
    assert ct["cond_us_cm"].median() > cd["cond_us_cm"].median() and ct["temp_c"].median() > cd["temp_c"].median()
    assert abs(ct["spcond_us_cm"].median() - cd["spcond_us_cm"].median()) < \
        (ct["cond_us_cm"].median() - cd["cond_us_cm"].median()) / 3
    assert max(jun[0], aug[0]) < min(jun[2], aug[2]) - 30          # raw far below the river
    assert abs(jun[1] - jun[2]) < 10 and abs(aug[1] - aug[2]) < 10  # corrected close to it
    assert corr_raw > 0.9 and abs(corr_sc) < 0.1

    # general science text carries no numbers; the what-if carries none except lesson references
    for L in lessons:
        assert not re.search(r"\d", L["why"] + L["comparison"]), L["id"]
        for q in L.get("questions") or [L["question"]]:
            assert sum(c["correct"] for c in q["choices"]) == 1 and 2 <= len(q["choices"]) <= 3, L["id"]
            assert all(c["correct"] or c.get("why_not") for c in q["choices"]), L["id"]
            if L.get("whatif"):
                t = " ".join([q["prompt"], q["explain"]] + [c["text"] + " " + c.get("why_not", "") for c in q["choices"]])
                assert not re.search(r"\d", re.sub(r"lessons? \d+( and \d+)?", "", t)), t

    # ---- reading time: words / WPM plus Q_SECONDS per question ----------------------------------
    # Per question: the prompt, the choices, the reveal, and the average "why not" text (a reader
    # sees one only when their pick is wrong). Chart reading is not counted.
    def lesson_seconds(L):
        qs = L.get("questions") or [L["question"]]
        text = [L["look"], L["why"], L.get("comparison", ""), L.get("connect", ""), L.get("care", "")]
        nw = sum(words(t) for t in text)
        wn_total = 0
        for q in qs:
            nw += words(q["prompt"]) + words(q["explain"]) + sum(words(c["text"]) for c in q["choices"])
            wn = [words(c["why_not"]) for c in q["choices"] if not c["correct"]]
            wn_total += sum(wn) / len(wn)
        nw += wn_total
        return nw, len(qs), nw / WPM * 60 + Q_SECONDS * len(qs), wn_total / WPM * 60

    timing = [(L["id"], L.get("bonus", False)) + lesson_seconds(L) for L in lessons]
    core_s = sum(t[4] for t in timing if not t[1])
    core_allright_s = core_s - sum(t[5] for t in timing if not t[1])   # a reader who never needs a "why not"
    bonus_s = sum(t[4] for t in timing if t[1])

    # ---- opening screen ("Start here") ---------------------------------------------------------
    # The 80% sentence is Denver Water's, quoted from strontia-brief/places.json; nothing else in
    # the opening is a number except the sweep interval and counts computed here.
    N.lesson = "intro"
    places = json.loads((REPO / "strontia-brief" / "places.json").read_text())
    notes = [str(v) for v in walk_strings(places) if "passes through Strontia Springs" in str(v)]
    quote = re.search(r": '(.+?passes through Strontia Springs Reservoir\.)'", notes[0]).group(1)
    src_pl = "strontia-brief/places.json (Denver Water, quoted)"
    N.rows.append(("intro", "Eighty percent", src_pl))
    n_core = sum(1 for L in lessons if not L.get("bonus") and not L.get("whatif"))
    n_bonus = sum(1 for L in lessons if L.get("bonus"))

    def build_intro(minutes_text):
        return {
            "title": "Start here: from the river to your tap",
            "chain": [
                {"label": "River", "text": "Rain and melting snow flow down the South Platte River."},
                {"label": "Strontia Springs Reservoir", "text": "A lake behind a dam, southwest of Denver."},
                {"label": "Foothills treatment plant", "text": "An intake and a tunnel carry lake water here to be cleaned."},
                {"label": "Denver's taps", "text": "The clean water goes out to homes."},
            ],
            "quote": quote, "quote_by": "Denver Water",
            "paras": [
                {"tag": "The water scan",
                 "text": (f"A sensor called a sonde rises from deep in the lake to the surface about every "
                          f"{sweep_txt} hours. It measures temperature, oxygen, mud and more as it goes, and "
                          f"the team turned its readings into pictures.")},
                {"tag": "Why layers matter",
                 "text": ("In summer the lake forms layers that barely mix. A storm's mud can slide into one "
                          "layer and stay there. Whether it reaches the plant depends on how deep the "
                          "plant's intake is.")},
                {"tag": "What you'll do",
                 "text": (f"{n_core_txt} short lessons that link into one chain, then a puzzle where you put it "
                          f"all together. That takes about {minutes_text} minutes. The {n_bonus_txt} bonus "
                          f"lessons at the end are optional.")},
            ],
        }

    sweep_txt = N(sweep_h, ".0f", "casts.csv: median gap between full casts, hours")
    n_core_txt = N(n_core, "d", "count of core lessons in this file")
    n_bonus_txt = {1: "one", 2: "two", 3: "three"}.get(n_bonus, str(n_bonus))
    N.rows.append(("intro", n_bonus_txt, "count of bonus lessons in this file"))
    draft = build_intro("00")
    intro_w = sum(words(c["label"]) + words(c["text"]) for c in draft["chain"]) + words(quote) + \
        sum(words(p["tag"]) + words(p["text"]) for p in draft["paras"])
    intro_s = intro_w / WPM * 60
    total_core_s = intro_s + core_s
    minutes_core = int(round(total_core_s / 60))
    minutes_bonus = int(round(bonus_s / 60))
    intro = build_intro(N(minutes_core, "d", f"reading-time estimate (words / {WPM} per minute + "
                                              f"{Q_SECONDS} s per question): opening + core + put it together"))
    intro["minutes_core"], intro["minutes_bonus"] = minutes_core, minutes_bonus
    N.rows.append(("intro", str(minutes_bonus), "reading-time estimate: bonus lessons (shown in the lesson list)"))

    for i, L in enumerate(lessons):
        L["n"] = i + 1
        L["numbers"] = N.for_lesson(L["id"])
    intro["numbers"] = N.for_lesson("intro")

    out = {
        "title": "Strontia Springs, by depth: lessons",
        "generated_by": "teams/team-education/analysis/build_lessons.py",
        "audience": "ages 13 to 16",
        "terms": P["terms"],
        "intro": intro,
        "lessons": lessons,
    }
    DEST.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")

    print(f"{'lesson':<10} {'value':<10} source")
    for lesson, text, source in N.rows:
        print(f"{lesson:<10} {text:<10} {source}")
    print(f"\nwrote {DEST} ({len(lessons)} lessons, {len(N.rows)} numbers)")

    print(f"\nReading time (words / {WPM} per minute + {Q_SECONDS} s per question; charts not counted)")
    print(f"{'part':<10} {'words':>6} {'questions':>9} {'seconds':>8}")
    print(f"{'opening':<10} {intro_w:>6.0f} {0:>9} {intro_s:>8.0f}")
    for lid, bonus, nw, nq, sec, _ in timing:
        print(f"{lid + (' *' if bonus else ''):<10} {nw:>6.0f} {nq:>9} {sec:>8.0f}")
    print(f"opening + core + put it together: {total_core_s / 60:.1f} min "
          f"({(intro_s + core_allright_s) / 60:.1f} min for a reader who gets every answer right);  "
          f"bonus (*): {bonus_s / 60:.1f} min")


if __name__ == "__main__":
    main()
