# Proxy metrics

TOC and alkalinity need a lab, so they cannot be read continuously or ahead of time.
Jake's models are soft sensors: they predict those two from cheap, continuous readings
that stand in for them. This file lists each stand-in, what it stands in for, and how
well it holds up. Compiled 2026-09-24 from `guide.md`, `glossary.md`, and `README.md`;
where a line is general water knowledge rather than something in these materials, it
says so.

For the instruments behind these readings, see [sensors.md](sensors.md).

## Direct proxies for the targets

| Proxy | Source | Stands in for | How well |
|---|---|---|---|
| Specific conductance | USGS 06707525 | **Alkalinity.** Both come from dissolved rock minerals. | The strongest single proxy. A straight line on it alone explains about half the variation in alkalinity (R² 0.51); the full random forest reaches 0.61 (`guide.md` section 10). |
| Turbidity | USGS 06707525 | **TOC.** Muddy water usually means runoff, and runoff usually brings organic matter. | Weak alone. A straight-line TOC model is barely better than guessing the average. |
| Turbidity × flow (`turb_flow`) | Derived | **Organic load**: how much material the river is carrying, not just how cloudy it is. | The single strongest TOC predictor (`guide.md` section 7). |

## Proxies for watershed conditions

| Proxy | Source | Stands in for |
|---|---|---|
| Snow water equivalent at one SNOTEL station | NRCS, Hoosier Pass in the shipped CSV | **Basin snowpack**: how much melt is still coming. `glossary.md` calls it "a proxy for the basin, not the basin." |
| Daily precipitation at one station | NOAA USC00058022 | **Rain across the basin**, which drives runoff. |
| Flow and flow delta | Colorado DWR | Whether the river is a trickle or a flood, and whether it is rising or falling. |
| Month as sine and cosine | Derived | **The seasonal cycle** (snowmelt, summer storms) without naming its causes. |
| Rolling averages: 7-day flow, 3-day turbidity, 7-day rain, 7-day snowpack | Derived | **Recent conditions** rather than one day's reading. |
| Lagging upstream readings by 2 days (TOC) or 4 days (alkalinity); rain by 4 or 6 | Derived | **Travel and mixing time** from the gage to the plant intake. Raw travel is about four hours; Jake thinks the multi-day scale is mixing and deposition in the reservoir, and asks that the exact number not be leaned on (`guide.md` section 1). |

## Measured but not yet used

The Strontia sonde's readings are not in any model yet (`README.md`):

- **Chlorophyll and phycocyanin** indicate algae and blue-green algae (general
  knowledge).
- **Readings by depth** show the reservoir stratifying and turning over, and how
  storms and spring runoff redistribute water quality through the water column.

## Where the proxies are weakest

- **TOC has no good proxy.** Turbidity is indirect, which is why the TOC model is the
  unstable one. A direct in-stream organic-matter sensor (fDOM) would replace a weak
  proxy with a strong one (general knowledge; ask Jake whether Denver Water has tried
  one).
- **Snow and rain each rest on a single point** standing in for a watershed of
  thousands of square miles.
- **The lag is fitted, not measured.** Water-quality sensors further upstream would
  let the team measure travel and mixing time instead of guessing it.
- **The below-60 alkalinity threshold runs through the middle of normal**: the mean in
  this data is 58.3 and 58% of days are below 60, so predicting above or below 60 is
  close to a coin flip (`guide.md` section 11).

## Data terms

Anything built on Denver Water's data carries their terms; see
[`data/TERMS.md`](../../data/TERMS.md).
