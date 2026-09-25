# Design Storm 2026: Denver Water

The Design Storm is a hands-on collaborative challenge at
[Explore DDD 2026](https://exploreddd.com), run with Denver Water. Attendees join a
cohort at their own experience level, then work in small teams of two to four with
real water utility data on something Denver Water's Water Quality and Treatment team
actually needs: advance warning of what is coming down the South Platte before it
reaches a treatment plant.

This repository holds the materials Denver Water shared, the models their data
scientist built, and a 3D map of the collection system those numbers describe.

**New to water treatment, or to data science, or to both?** That is the expected
starting point. [`guide.md`](guide.md) explains both from zero and
[`glossary.md`](glossary.md) defines every term, whenever a sentence here stops
making sense.

Denver Water's data terms apply to everything here. They are at the bottom of this
file and in [`data/TERMS.md`](data/TERMS.md). Denver Water has confirmed the data is
public; please keep the terms with anything you build on it.

## Working as a small team

The simplest way for a small team to work together is for one person to **fork this
repository** and share the fork with the rest of the team. The fork becomes the
team's collaboration point: everyone else works against it, opens pull requests into
it, and it keeps one shared history of what the team tried.

Work wherever you like in your fork. If you want to send something back here, put it
all in `teams/<your-team-name>/` and leave `data/`, `scripts/`, `figures/`, and
`reference/` as they are, so pull requests from different teams never collide.

## Start here

**[The challenge, as Denver Water framed it](reference/Explore%20DDD%202026%20Denver%20Water%20Design%20Storm%20Presentation.pdf)**
(PDF, 12 slides). Cassidi Rosenkrance, their Water Quality and Treatment Manager,
presented this to the room at the kickoff: who Denver Water is, what the water
sector is up against, and the three scenarios below.

**[Denver's Water, in 3D](https://exploreddd.com/2026-design-storm-demo/)** is the
system map on her slide 4, rebuilt as something you can fly through. Reservoirs,
gages, snow stations, treatment plants, and the tunnels that carry water under the
Continental Divide, on real terrain, with live readings behind each marker. It runs
in the browser; click anything. It doubles as a worked example of Scenario 3, and as
a starting point for the viewing application Scenario 1 asks for.

The storm replay on that map now follows the August 14 storm past the gage:
into Strontia Springs Reservoir, where the new profiling sonde watched the muddy
layer work its way down over four days, and on to the Foothills lab, where
organic carbon stepped up two days after the gage spiked.
[`design-storm-strontia-plume.html`](design-storm-strontia-plume.html) is the
full write-up behind that sequence: the river, the reservoir by depth, and the
plant on one chart; the reservoir in section (the sonde reaches 48 m down, the
intake sits at 198 ft, about 40 ft below its last reading); and the finding that the gage thirteen miles upstream
never rose, so the runoff entered from the reach no flow gage watches. It ends
with three open questions for Denver Water.

It is `design-storm-water-system-3d.html` here if you want to take it apart. It
fetches JSON, so run `python3 serve.py` and open
<http://localhost:8765/design-storm-water-system-3d> rather than the file directly.

## What you are predicting, and why it matters

Water reaches Denver Water's **Foothills treatment plant** after travelling down the
South Platte through Strontia Springs Reservoir. Two things about that water change
how hard it is to treat:

- **TOC** (total organic carbon) is dissolved plant and soil matter. It is harmless
  by itself, but it reacts with the chlorine used to disinfect drinking water and
  forms **disinfection byproducts**, which are regulated. More TOC arriving means
  more work to remove it first.
- **Alkalinity** is the water's resistance to changes in pH. Removing TOC works best
  at a slightly acidic pH, so alkalinity sets how much chemical it takes to get
  there.

Both are measured by hand from grab samples, so the plant learns what arrived only
after it arrived. Predicting them a few days out, from upstream sensors and snow and
weather data, would let operators plan staffing and dosing before the water gets
here. That is the problem. Everything else is in service of it.

## The three scenarios

Cassidi put three to the room. Each question below is hers, quoted from the deck;
the bullets under it are the ways in she suggested. Pick one, or take a scenario
somewhere she did not anticipate.

### 1. TOC and alkalinity predictive model

> Can watershed, hydrologic, and reservoir monitoring data provide enough advance
> warning to accurately predict TOC and alkalinity arriving at Foothills and give
> treatment staff actionable time to prepare?

- Using national datasets upstream of Strontia Springs Reservoir, predict TOC and
  alkalinity concentrations a few days ahead of them hitting the Foothills plant.
- Bring in the real-time Strontia profiling sonde. It sits much closer to the
  Foothills influent, which may improve accuracy but also shortens the lead time.
  Cassidi starred this one on the slide.
- Machine learning enthusiasts: try different models (support vector machines, say),
  different lag times, and feature engineering, and see if performance improves.
- Build a web application for viewing everything behind a prediction (streamflow,
  weather, USGS sonde water quality) alongside the projected TOC and alkalinity.

### 2. Storm and runoff events, and real-time data

> Given current watershed and reservoir conditions, how is an incoming storm or
> runoff event likely to affect source-water quality, when will that impact arrive,
> and what conditions might we expect at different depths within Strontia Springs
> Reservoir?

- Model how precipitation events hit the real-time water quality readings above
  Strontia Springs Reservoir.
- Adapt that model to the Strontia sonde data: how do water quality parameters
  change and distribute by depth in the reservoir, and how do storms and spring
  runoff change that picture?
- Look back through the historical data and model how major precipitation events
  have moved water quality through the system.

### 3. Snowpack and surface water system function

> Develop an interactive model that visualizes how water and water-quality
> conditions move from the watershed through the collection system to the treatment
> plants and evaluate how hydrologic and seasonal events influence that movement.

- Model or visualize how water enters the system and moves through it to the
  treatment plants.
- Focus on one aspect of it, for example historical snowpack and streamflow and how
  those shift year to year, drought against wet.
- Choose a parameter, or a few, and follow them through the system. See whether
  snowpack, rainstorms, or lake turnover change how they travel.

Her framing for all three, from the deck: *use your backgrounds and skillsets to
develop creative solutions.* The scenarios and datasets are ones Denver Water uses
every day to predict, model, and understand what is happening in their collection
system.

## What is in here

Everything marked **original** is Denver Water's, kept exactly as sent. Copy what you
need rather than editing in place.

| Path | What it is |
|---|---|
| [`reference/`](reference/) | **Original.** Cassidi's kickoff deck, Jake's model walkthrough, and two primers on the chemistry and the regulations. Has [its own README](reference/README.md). |
| `data/` | **Original.** The datasets. Detailed below. |
| `scripts/` | **Original.** Jake's six Jupyter notebooks: two model notebooks and four API grabbers, hardcoded paths and all. |
| `figures/` | **Original.** The plots those notebooks produce. |
| [`guide.md`](guide.md) | The domain and the models explained from zero. |
| [`glossary.md`](glossary.md) | Every water and statistics term used here, defined. |
| `design-storm-water-system-3d.html` | The 3D map, plus `water-system-3d/` and `strontia-brief/` for the data it draws and `serve.py` to serve it. |
| `design-storm-strontia-plume.html` | Where the muddy water goes after it reaches the reservoir: the August storm as the Strontia sonde saw it, with images in `strontia-plume/`. |

## The data

In `data/`, daily series running 2022-04-01 to 2026-08-19. Open one to see its
columns.

| File | What it holds |
|---|---|
| `FoothillsInfluent.csv` | TOC and alkalinity at the plant. This is what you are predicting. |
| `USGS_South_Platte.csv` | The upstream gage: turbidity, specific conductance, pH, temperature, dissolved oxygen. |
| `SouthPlatteFlow.csv`, `SouthPlatteTelemetry.csv` | Streamflow and gage height, from Colorado DWR. |
| `HoosierPass.csv`, `MichiganCreek.csv` | Snowpack, as snow water equivalent. |
| `USC00058022.csv` | Precipitation, snow, and temperature, from NOAA. |
| `Strontia 0407_0819.xlsx` | The profiling sonde in Strontia Springs Reservoir. See below. |

**The Strontia sonde is the newest thing here, and the least explored.** Unlike the
daily series above, it takes readings at many depths per cast: 16,093 of them across
2026-04-07 to 08-19, covering temperature, conductivity, pH, turbidity, chlorophyll,
phycocyanin and dissolved oxygen. It matters for two of
the scenarios, for different reasons. In **Scenario 1** it is a closer-in predictor,
sitting much nearer the Foothills influent than the upstream river gage, which
Cassidi starred on her slide as the most interesting thread to pull; it may sharpen
accuracy, but it also shortens the warning time, and that tradeoff is the open
question. In **Scenario 2** it is the subject rather than an input: because it
profiles by depth, it shows how a reservoir stratifies and turns over, and how storms
and spring runoff redistribute water quality through the water column. Jake's models
do not use it at all, so anything done with it is new ground.

Two things worth knowing before you model. **Readings are provisional**: USGS
publishes immediately and revises later, so a fresh API pull can differ from these
files, and a forecast built on a provisional reading inherits that. **`MichiganCreek.csv`
has a known bad patch**: snow water equivalent of 9.0 on May 12 to 15, 2026 between
zero readings, an error in the NRCS feed. Jake replaced that station with Hoosier
Pass; the file is kept because it covers a longer record.

## Jake's models

Jake Slawson built a random forest on lagged upstream features that predicts TOC and
alkalinity at the Foothills influent a few days out. His walkthrough is
`reference/Foothills_INF_ML_NoConclusions.pptx`, and [`guide.md`](guide.md) explains
what he did and why, feature by feature, assuming nothing.

His own framing, worth keeping in view: these models are under development, built as
a case study in what current data makes possible. Not publication-ready, and not the
bar you have to clear.

## Public data resources

Every source behind the shipped CSVs and the 3D map, all open and without keys. The
API grabber notebooks in `scripts/` show how Jake pulled the first five.

| Source | What you get | Used for |
|---|---|---|
| [USGS National Water Information System](https://waterdata.usgs.gov/) ([API](https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/)) | River gage discharge, gage height, turbidity, specific conductance, pH, temperature, dissolved oxygen, at fifteen-minute resolution | `USGS_South_Platte.csv`, and the live gage charts on the map |
| [USGS NLDI](https://api.water.usgs.gov/nldi/) | Drainage basin polygons and river flowlines from any gage | Every basin outline and river line the map draws |
| [USGS HIVIS](https://apps.usgs.gov/hivis/) | Live cameras at river gages | The photos in the map's gage panels |
| [Colorado DWR (CDSS)](https://dwr.state.co.us/) ([API](https://dwr.state.co.us/Rest/GET/Help)) | Streamflow, gage height, and daily reservoir storage statewide, back decades | `SouthPlatteFlow.csv`, `SouthPlatteTelemetry.csv`, reservoir storage overlay |
| [USDA NRCS SNOTEL](https://www.nrcs.usda.gov/resources/data-and-reports/snow-and-water-interactive-map) ([API](https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=*:CO:SNTL&activeOnly=true)) | Snow water equivalent, snow depth, and temperature from every Colorado snow pillow | `HoosierPass.csv`, `MichiganCreek.csv`, snow station charts |
| [NOAA NCEI, GHCN Daily](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily) | Daily precipitation, snowfall, and temperature from land stations | `USC00058022.csv` |
| [Iowa State Mesonet](https://mesonet.agron.iastate.edu/) | Archived NEXRAD radar by timestamp, as map tiles | The August 14 to 15 storm replay |
| [OpenStreetMap](https://www.openstreetmap.org/) | Infrastructure geometry, including conduits and tunnels | The tunnel and pipeline lines on the map |
| [eRAMS / Catena](https://erams.com/catena/) | Colorado environmental and watershed data | Nothing yet. Cassidi's strongest recommendation |
| [NASA SnowEx](https://nsidc.org/data/snowex) | Snowpack measured from the air rather than a ground pillow | Nothing yet. Cassidi's recommendation |

## Data terms

Denver Water provided this data under two notices. Both apply to everything in this
repository, and both travel with any dataset or output derived from it.

> The water quality data is provided "as is." Water quality data provided to the user is provisional and subject to change, and the user should not assume that the data has undergone any quality assurance or quality control review. Denver Water makes no warranty of any kind, express or implied, concerning the data, including accuracy, reliability, completeness, timeliness, or usefulness.
> Copyright 2026, Denver Water. https://www.denverwater.org/about-us/how-we-operate/public-records

> COPYRIGHT AND DISCLAIMER: The data and metadata contained herein were prepared by Denver Water for its internal purposes only. Denver Water provides data and metadata as a public service with no claim as to the completeness, usefulness, timeliness or accuracy of its content, positional or otherwise. Denver Water and its employees make no warranty, express or implied, and assume no legal liability or responsibility for the ability of users to fulfill their intended purposes in accessing or using data or metadata or for omissions in content regarding such. The information provided is presented "as is," without warranty of any kind, including, but not limited to, the implied warranties of merchantability, fitness for a particular purpose, or non-infringement. Your use of this information is at your own risk. In providing this information or access to it, Denver Water assumes no obligation to assist the user in the use of such information or in the development, use, or maintenance of any applications applied to or associated with the data or metadata. Any sale, reproduction or distribution of this information, or products derived therefrom, in any format is expressly prohibited.

Data from USGS, Colorado DWR, USDA NRCS, and NOAA is public domain. Map imagery is
Esri and contributors; terrain is Mapzen via AWS; pipeline geometry is
OpenStreetMap contributors; storm radar is the NEXRAD archive via Iowa State
Mesonet.

## Thanks

To **Cassidi Rosenkrance**, who brought Denver Water to the conference, framed the
challenge, recruited her colleagues, and answered every question put to her; to
**Jake Slawson**, who shared his working models and the data behind them; and to
**Jonathan Spitze** and the Water Quality and Treatment team at Denver Water for
backing it.
