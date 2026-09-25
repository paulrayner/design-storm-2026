# Sensors in production

What is measuring the South Platte watershed today, as far as this repo shows. Compiled
2026-09-24 from `water-system-3d/system.json`, `strontia-brief/places.json`, the CSVs in
`data/`, `README.md`, and `guide.md`. The repo holds public feeds plus the Strontia
sonde; Denver Water very likely runs internal instruments that are not listed here.

For what these readings stand in for in the models, see [proxy-metrics.md](proxy-metrics.md).

## By category

| Category | What it measures | Sites in the repo | Operator |
|---|---|---|---|
| Continuous river water quality | Turbidity, specific conductance, dissolved oxygen, pH, water temperature, every 15 minutes | **One**: Strontia Springs Sentinel, USGS 06707525, just above the reservoir | USGS |
| Streamflow gages | Flow (cfs), gage height | Six USGS flow-only gages (below), plus Colorado DWR PLASPLCO | USGS, Colorado DWR |
| Reservoir profiling sonde | Temperature, conductivity, pH, turbidity, chlorophyll, phycocyanin, dissolved oxygen, at many depths per cast | **One**: Strontia Springs Reservoir, 16,093 readings from 2026-04-07 to 08-19 | USGS / Denver Water |
| Reservoir storage | Water in storage, acre-feet | Dillon, Cheesman, Chatfield, Strontia | Colorado DWR |
| Snow (SNOTEL) | Snow water equivalent, snow depth, air temperature | 11 on the map; the models use one | USDA NRCS |
| Weather | Precipitation, snowfall, max and min temperature | One NOAA station, USC00058022 | NOAA |
| Cameras | Still images of the river | Trumbull (upstream and downstream), below Dillon Dam, Moffat Tunnel west portal | USGS HIVIS |

**Not a sensor:** TOC and alkalinity at Foothills, the two quantities the models
predict, come from hand-collected grab samples run in Denver Water's lab
(`data/FoothillsInfluent.csv`). The plant learns what arrived only after it arrived.

## Site list

### Stream gages

| Site | USGS / DWR ID | What the map charts |
|---|---|---|
| Strontia Springs Sentinel (South Platte above Strontia Springs Reservoir) | 06707525 | Turbidity, FNU |
| South Platte below Brush Creek near Trumbull | 06701900 | Flow, cfs |
| North Fork South Platte at Grant | 06702500 | Flow, cfs |
| North Fork South Platte at South Platte (confluence) | 06707000 | Flow, cfs |
| South Platte at South Platte (mainstem) | 06707500 | Flow, cfs |
| Fraser River below Moffat Tunnel | 09023562 | Flow, cfs |
| Williams Fork near Parshall | 09037500 | Flow, cfs |
| South Platte telemetry gage (Colorado DWR) | PLASPLCO | Flow, gage height, and a running precipitation total |

Only 06707525 reports water quality in the files here. Whether any of the others carry
water-quality probes the public feed does not show is a question for Jake.

### SNOTEL stations on the map

| Station | ID | Elevation, ft |
|---|---|---|
| Berthoud Summit | 335 | 11,300 |
| Buckskin Joe | 938 | 11,160 |
| Copper Mountain | 415 | 10,500 |
| Fremont Pass | 485 | 11,310 |
| Grizzly Peak | 505 | 11,110 |
| Hoosier Pass | 531 | 11,600 |
| Jackwhacker Gulch | 935 | 11,030 |
| Jones Pass | 970 | 10,430 |
| Michigan Creek | 937 | 10,700 |
| Middle Fork Camp | 1014 | 8,960 |
| Rough And Tumble | 939 | 10,420 |

The models use one: Hoosier Pass in the shipped CSV (`data/HoosierPass.csv`), though
the notebooks name Buckskin Joe. Michigan Creek was dropped over bad spring 2026
readings.

### Reservoir storage

| Reservoir | DWR abbreviation | Record since |
|---|---|---|
| Dillon | DILRESCO | 1987 |
| Cheesman | CHERESCO | 1989 |
| Chatfield | CHARESCO | 1988 |
| Strontia Springs | STRRESCO | 2021 |

## Known limits of the current network

- **Water quality is seen at only two points, both at Strontia**: the Sentinel gage
  and the sonde. Everything further upstream measures quantity (flow, snow, rain), so
  a storm's effect on water quality shows up only when it is nearly at the reservoir.
- **Neither target is measured continuously anywhere.** There is no in-stream sensor
  for organic matter. (USGS commonly runs fDOM probes, a fluorescence reading of
  dissolved organic matter, for this; general knowledge, not something in these
  materials.)
- **Winter gap.** The Sentinel gage has almost no January to March readings, probably
  because it is pulled before the river freezes (`guide.md` section 4).
- **One rain gauge for the basin.** The DWR precipitation counter resets and goes
  negative; Jake says not to use it and prefers NOAA.
- **Data quality problems already seen**: the Michigan Creek SWE spike of 9.0 on
  2026-05-12 to 15 between zero readings, and the DWR precipitation counter above.
- **Readings are provisional.** USGS publishes immediately and revises later, so a
  fresh API pull can differ from the committed files.

## Data terms

Anything built on Denver Water's data carries their terms; see
[`data/TERMS.md`](../../data/TERMS.md). Data from USGS, Colorado DWR, USDA NRCS, and
NOAA is public domain.
