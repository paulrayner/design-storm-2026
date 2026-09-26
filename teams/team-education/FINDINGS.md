# Findings: inside Strontia Springs Reservoir during the August 2026 storm

**All data here is provisional.** The sonde and plant lab values are Denver Water's,
provided as is under the terms in [`data/TERMS.md`](../../data/TERMS.md); the gage values
carry the USGS provisional flag "P" and can be revised. One season of sonde data
(Apr 7 to Aug 19, 2026) and one storm. These findings describe what happened; they do
not predict the next storm.

Every number comes from a script in this folder:

- `analysis/clean_sonde.py` → `analysis/QC.md` (cleaning, casts, sensor behaviour)
- `analysis/grid_sonde.py` → `analysis/out/heat_*.png` (the depth-by-time pictures)
- `analysis/storm_trace.py` → `analysis/out/storm_numbers.json`,
  `analysis/out/storm_casts.csv`, `analysis/out/storm_timeline.png`

Each finding is marked **Measured** (computed from the files) or **Interpreted** (what it
probably means; general limnology or water-treatment knowledge, not something the data
proves). Times are Mountain Daylight Time.

## The storm in one paragraph

The main pulse of muddy water passed the river gage above the reservoir overnight on
August 14 to 15 (peak 329 FNU at 01:45). It did not spread through the reservoir, and it
did not stay at the surface or sink to the bottom. It slid in as a layer between roughly
8 and 18 m deep, strongest at about 13 m, with a peak about a day and a half after the gage
peak. Over the next three days the layer thinned and sank to about 20 m, and it was still
there when the record ends on August 19. The Foothills plant's organic carbon (TOC) went
from 2.0 to 2.5 mg/L on August 16, the day after the gage peak, a jump that size is rare
in summer. Alkalinity did not clearly move. Whether the plant was drawing from the layer
depends on the intake depth, which we do not know.

## 1. At the river gage (USGS 06707525, at the reservoir inflow)

**Measured.**
- Before the storm (Aug 10 to 12) the gage's daily median turbidity was **2.4 FNU**.
  When the 15-minute series in the repo starts (Aug 14 12:00) it already reads **4.6**.
- The main rise begins at **19:15 on Aug 14** (first reading at or above 7.2 FNU, three
  times the pre-storm median) and peaks at **329 FNU at 01:45 on Aug 15**, 6.5 hours later.
  Turbidity is back below 10 FNU after **12:00 on Aug 15** and reads 4.9 at the end of the
  series (18:00). Daily maxima: 237 (Aug 14), 329 (Aug 15), 5.5 (Aug 16).
- Specific conductance falls from a median of **296.5 µS/cm** before the rise to
  **280 at 00:15 on Aug 15**; it starts to fall at about 18:00, just before turbidity rises.
- One sample, **13:00 Aug 14**, reads 38 µS/cm and 16.1 FNU at the same instant, between
  normal readings on either side. It is excluded as a single-sample glitch in both series.
- The gage's daily record for **Aug 13 is blank**. NOAA station USC00058022 recorded
  rain of **0.35 in on Aug 13**, 0.56 (Aug 14), 0.46 (Aug 15), 0.45 (Aug 16), after none
  Aug 10 to 12. Flow in `SouthPlatteFlow.csv` rose only modestly, from 375 cfs (Aug 12)
  to 427 (Aug 14).

**Interpreted.** A short, sharp pulse of sediment-laden, more dilute runoff from summer
thunderstorms, carrying sediment without much extra flow, not a large flow event.

## 2. In the reservoir, by depth (the profiling sonde)

A "storm layer" in a cast is the continuous run of 1 m depths where turbidity is at least
**double its own Aug 10 to 13 median at that depth** and at least 1 NTU above it.

**Measured.**
- **No cast before Aug 14 has a storm layer** (0 of 16 casts, Aug 10 to 13). Before the
  storm, turbidity was about 1.2 NTU at 1 to 6 m, 1.7 at 7 to 22 m and 1.9 at 23 to 44 m.
- **An early, weak layer appears before the main pulse reached the gage**: 6 to 8 m at
  06:07 on Aug 14 (3.9 NTU) and 4 to 16 m at 18:06 (6.0 NTU), up to 13 hours before the
  gage's main rise.
- **The main pulse arrives in the reservoir about 16 hours after the gage peak.** The first
  cast where the layer's peak is at least half its eventual maximum is **18:06 on Aug 15**
  (19.6 NTU at 15 m), 16.4 hours after the gage peak. Casts are 6 hours apart, so every
  arrival time here is uncertain by up to 6 hours.
- **The reservoir peak is 23.1 NTU at 13 m, at 12:06 on Aug 16**, 34 hours after the gage
  peak, about **13 times** the pre-storm value at that depth. The layer then spans 4 to 17 m.
- **Where it sat:** across the storm casts the layer's top was at a median of **7.5 m** and
  its bottom at **17.5 m**; no cast put it shallower than 3 m or deeper than 24 m.
- **It sank as it faded.** Depth of the strongest reading, by day: 7.5 m (Aug 14), 12
  (Aug 15), 13 (Aug 16), 14 (Aug 17), 20 (Aug 18), 21 (Aug 19). Peak turbidity by day: 6.0,
  19.6, 23.1, 17.5, 10.4, 8.0 NTU.
- **It was still there when the record ends**: at 06:07 on Aug 19 the layer spans 13 to
  22 m, peaking at 7.9 NTU, four and a half times pre-storm, **more than four days after the
  gage peak**.
- **The surface and the bottom barely changed.** The median at 1 to 3 m rose gently from
  about 1.05 to 1.56 NTU by Aug 17. At 30 to 44 m it stayed between 1.8 and 2.0 NTU the
  whole time.
- **The layer is more dilute and slightly warmer than the water it replaced.** Through
  Aug 17, specific conductance in the layer was about **6 to 12 µS/cm lower** than pre-storm
  at the same depths (the river dropped 16), and temperature was about **0.8 °C higher**.
- A sensor service event falls between the Aug 17 07:08 cast and the Aug 18 06:10 cast (a
  23-hour gap in the record). Across it, specific conductance at 30 to 44 m steps up by
  about 6 µS/cm and chlorophyll drops to the sensor's floor, so those two are **not
  comparable across Aug 18**. Deep turbidity shifts by about 0.2 NTU, too small to change
  the layer picture.

**Interpreted.**
- This is an **interflow**: river water enters the reservoir and travels at the depth where
  its density matches the lake's (general limnology). The river averaged 16.0 °C on
  Aug 14 to 15; before the storm the reservoir was that warm at about 5 m. Suspended sediment
  makes water denser, so a muddy inflow sinks somewhat deeper than its temperature alone
  suggests, which fits a layer centred around 13 m.
- The early weak layer on Aug 14 most likely came from **earlier storm water** (Aug 13 rain,
  the blank gage day, the elevated 4.6 FNU at noon on Aug 14), not from the main pulse.
- The layer sinking and thinning is consistent with sediment settling out of it. The data
  cannot separate settling from the layer being drawn off through the dam outlets.
- **For operations:** the storm's muddy water was concentrated in a band roughly 8 to 18 m
  deep for days, while the surface looked almost normal. Whether that matters to Foothills
  depends on the intake depth.

## 3. At the Foothills plant (daily lab values)

**Measured.**
- **TOC** was **2.0 mg/L every day Aug 10 to 15**, then **2.5 on Aug 16 and 17**, 2.3 on
  Aug 18 and 2.2 on Aug 19.
- A day-to-day rise of 0.5 mg/L is rare: across the 448 summer (June to August) day-to-day
  changes in the record, 2022 to 2026, **0.7%** were that large.
- The rise shows in the **Aug 16** value, the calendar day after the gage peak. The sample
  time is not in the data, so the lag can only be stated in days.
- **Alkalinity** ranged 58 to 62 mg/L on Aug 10 to 15 and 56.8 to 59.5 on Aug 16 to 19. Only
  Aug 19 (56.8) is outside the pre-storm range, by 1.2 mg/L. **No clear alkalinity response.**

**Interpreted.**
- The TOC rise lines up with the reservoir layer's peak (Aug 16) and is unusual for summer,
  so it is plausibly the storm. One storm cannot prove it.
- If the intake draws from within about 8 to 18 m, the plant was taking water from the
  layer's depth during Aug 15 to 17; that would explain why TOC moved while the reservoir
  surface barely did. This is the reason the intake depth matters.
- For a storm like this, the useful warning from the gage is short: about a day from the
  gage peak to the plant's TOC change. The reservoir sonde sees the layer within hours of
  its arrival and can show whether it sits at intake depth.

## 4. The season, briefly

**Measured.**
- **Stratified from the first day to the last.** On Apr 7 the water within 3 m of the
  surface was already **5.3 °C** warmer than the water below 40 m, and every observed day
  through Aug 19 had a difference of at least 1 °C. The largest daily median difference was
  **7.6 °C on May 15**. Monthly medians: Apr 4.9, May 5.0, Jun 4.0, Jul 4.1, Aug 3.0 °C.
- The sharpest temperature drop moved toward the surface through the season: median depth
  14 m in April, 9 in May, 6 in June, 4 in July and August.
- **Oxygen at depth never ran low.** The daily median below 40 m fell from 9.4 mg/L (April)
  to 7.1 (July) and was 7.5 in August; the lowest daily median was **6.5 mg/L on Jul 18**,
  and the lowest single reading after QC was **5.9 mg/L**.
- **Early August, the deep water changed.** Below 40 m, temperature fell from 15.7 °C
  (Aug 4) to 14.3 (Aug 11) while oxygen rose from 6.9 to 8.1 mg/L (Aug 9). Over the same days
  the river cooled from 15.1 °C (Aug 4) to 13.1 (Aug 9) and flow rose from 469 to 582 cfs.
- **Chlorophyll stayed low.** In the two stretches where the sensor reads above its floor
  (May 18 to Jun 15, Jul 20 to Aug 17), the median was about 0.9 µg/L, highest in the top
  5 m (about 1.2) and lowest below 30 m (about 0.8), with a 99th percentile under 1.8.
  Phycocyanin's 99th percentile is 0.77 (units not stated in the file).

**Interpreted.**
- Oxygen above about 5 mg/L at depth all season means no anoxic bottom water to release
  iron or manganese this year (general knowledge).
- The early-August change fits a **cold underflow**: river water cooler than everything in
  the reservoir sinks along the bottom and brings oxygen with it (general limnology). So the
  reservoir responds to inflows at different depths depending on the inflow's temperature.
  The August 14 to 15 storm came in warmer and landed mid-depth; the early-August water came
  in colder and went to the bottom.
- Chlorophyll around 1 µg/L is low (general knowledge). Nothing in this record looks like an
  algal bloom, but the sensor's shifting offset (see below) limits how far that can be pushed.

## 5. What limits these findings

- **What `Vertical Position` means.** We treat it as depth below the surface. The
  temperature evidence is strong (warmest at the smallest positions in all 268 full casts
  from June on), but Denver Water should confirm it.
- **Conductivity is logged without temperature compensation.** The raw column tracks
  temperature almost exactly (median correlation 0.98 within a cast). After the standard
  correction to 25 °C it is flat with depth and matches the gage, so all findings use the
  corrected value. See `analysis/QC.md`.
- **Sensor servicing** shifts ORP and chlorophyll (and sometimes conductance, turbidity
  and pH) at every depth at once: Apr 28, May 4, May 14, May 18, Jun 16, Jul 20, Aug 18.
  ORP is left out of the findings; chlorophyll is only compared within a stretch.
- **Near-bottom readings (Apr 7 to May 5, deeper than 45 m)** look like the sonde touching
  sediment and are removed.
- **Time resolution.** Casts are 6 hours apart, fewer after mid-July. Plant values are daily
  with unknown sample times.
- **One storm, one season.** None of this is a model and none of it should be used as one.
