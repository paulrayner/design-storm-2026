# Public precipitation sources for the Strontia Springs catchment

Researched 2026-09-25 for scenario 2 (storm and runoff warning). Everything
below was checked by fetching the source, not from search summaries. All
distances and depths in metric; the sources themselves mostly publish in
inches, so convert on ingest (1 in = 25.4 mm).

## What the repo already uses

| Source | File | Notes |
|---|---|---|
| NOAA GHCN daily, station USC00058022 | `data/USC00058022.csv` | This station is **Strontia Springs Dam** itself (39.4342, -105.1211, 1785 m). One gauge at the reservoir, daily totals, published about two days behind. |
| Colorado DWR telemetry, PLASPLCO | `data/SouthPlatteTelemetry.csv` `Precip` column | Cumulative counter that resets; Jake says do not use as a predictor. DWR's API lists only DISCHRG, DISCHRG2 and STORAGE parameters for water district 8, so precipitation is not a supported product there. |
| MRMS radar tiles via Iowa State Mesonet | storm replay in the 3D map | Picture only, not a numeric series. |

## Other public sources, ordered by usefulness for advance warning

### 1. MRMS gridded precipitation (numeric, 1 km, hourly)

The same radar-plus-gauge product the replay paints, but as GRIB2 files you
can sample at any point or average over a basin polygon (for example the
507 sq mi / 1313 km² unwatched reach).

- Archive: https://mtarchive.geol.iastate.edu/YYYY/MM/DD/mrms/ncep/
- Products present for 2026-08-14: `MultiSensor_QPE_01H_Pass2`,
  `MultiSensor_QPE_24H_Pass2`, `MultiSensor_QPE_72H_Pass2`,
  `RadarOnly_QPE_01H`, `PrecipRate`, `RadarQualityIndex`
- File pattern: `MultiSensor_QPE_24H_Pass2_00.00_20260814-000000.grib2.gz`
- Values are millimetres already.
- Reading GRIB2 needs `cfgrib` or `pygrib` (or `wgrib2`).
- Caveat: radar in mountain terrain is an estimate; the Radar Quality Index
  product tells you where beam blockage makes it unreliable. Pass 2 includes
  gauge correction and arrives about an hour later than Pass 1.

This is the one source that covers the whole catchment rather than a point.

### 2. NOAA GHCN daily, more stations (numeric, daily, free API, metric on request)

The NCEI access API returns millimetres directly with `units=metric`:

```
https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USC00058022,USC00051528,USC00054452&startDate=2026-08-10&endDate=2026-08-20&dataTypes=PRCP&format=csv&units=metric
```

Cooperative observer stations in or near the catchment (from
`ghcnd-stations.txt`), with 2026 data confirmed where marked:

| ID | Name | Lat, lon | Elev (m) | 2026 data |
|---|---|---|---|---|
| USC00058022 | Strontia Springs Dam | 39.434, -105.121 | 1785 | yes (in repo) |
| USC00051528 | Cheesman | 39.220, -105.278 | 2096 | yes, reported 13.2 mm on Aug 14 |
| USC00054452 | Kassler | 39.490, -105.095 | 1676 | yes, reported 11.7 mm on Aug 14 |
| USC00057816 | South Platte | 39.400, -105.183 | 1889 | none returned for Aug 2026 |
| USC00050454 | Bailey | 39.405, -105.476 | 2363 | none returned for Aug 2026 |
| USC00058939 | Westcreek | 39.133, -105.117 | 2379 | none returned for Aug 2026 |
| USC00053530 | Grant | 39.461, -105.679 | 2652 | not checked |
| USC00051829 | Conifer 8 W | 39.525, -105.363 | 2896 | not checked |
| USC00054293 | Inter Canyon | 39.573, -105.219 | 2189 | not checked |
| USC00057249 | Roxborough SP | 39.430, -105.069 | 1890 | not checked |

Aug 14 storm at the dam station, in mm: Aug 13 8.9, Aug 14 14.2, Aug 15
11.7, Aug 16 11.4. So the storm was a four-day event at the dam, not a
single burst.

### 3. CoCoRaHS volunteer gauges (numeric, daily, dense)

Community rain gauges, read every morning. 55 stations sit inside the box
39.2 to 39.55 N, -105.6 to -105.05 W (Conifer, Evergreen, Bailey, Roxborough,
Sedalia). They are in GHCN too, with IDs starting `US1CO`, so the same NCEI
API above serves them. Data explorer: https://dex.cocorahs.org/ and
https://maps.cocorahs.org/. Caveat: volunteers, so gaps on any given day.

### 4. NRCS SNOTEL precipitation (numeric, daily and hourly, high elevation)

Every SNOTEL station has a year-round precipitation gauge, not just a snow
pillow. Hoosier Pass (531) reported 0.4 in (10 mm) on 2026-08-14. Elements
`PREC` (accumulated) and `PRCP` (daily increment), inches.

```
https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customSingleStationReport/daily/531:CO:SNTL/2026-08-10,2026-08-20/PREC::value,PRCP::value
```

REST API with Swagger docs: https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui.html

These stations are on the Continental Divide, far upstream. Useful for the
spring runoff half of the scenario, less so for canyon thunderstorms.

### 5. RAWS fire-weather stations (numeric, hourly)

Interagency stations with hourly precipitation. Three are in the catchment
per the GHCN list: Waterton North (USR0000CWAT, 39.482, -105.209, 2659 m),
Cheesman (USR0000CCHE), Bailey (USR0000CBAI). Served through the Synoptic
Data API (free tier, token required): https://synopticdata.com/weatherapi/
and https://docs.synopticdata.com/services/precipitation-service-explained.
Not fetched here because a token is needed. Also visible on
https://raws.dri.edu/. Caveat: RAWS gauges are unheated, so winter values
are unreliable; summer storms are fine.

### 6. Mile High Flood District ALERT gauges (numeric, tipping bucket, minutes)

Real-time flood-warning gauges, mostly on the plains side of the district
(Chatfield, Plum Creek, Deer Creek). Layer listed at
https://hub.arcgis.com/maps/mhfd::alertraingauges/about and
https://www.mhfd.org/maps-data. Not verified whether any sit above the dam;
most of the catchment is outside the district. Worth one look, no more.

### 7. PRISM (gridded, daily, 4 km, gauge-based)

Oregon State's interpolated grid, good for climatology and long history,
published with a lag. https://prism.oregonstate.edu/ . Less useful for
warning, more for "how unusual was this storm".

## Suggested use for scenario 2

- Point series for the models: GHCN daily from the dam plus Cheesman and
  Kassler (upstream, downstream, and at the dam), in mm.
- Areal series for the catchment: MRMS 24-hour Pass 2, averaged over the
  Strontia basin polygon and over the unwatched reach, in mm.
- Hourly timing for the arrival-time strip: MRMS 1-hour Pass 2 at the
  Trumbull gage and at the dam, or the Waterton North RAWS if a token is
  set up.
