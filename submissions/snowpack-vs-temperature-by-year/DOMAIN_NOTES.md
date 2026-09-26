Manual process produces a PDF, e.g. https://www.denverwater.org/sites/default/files/water-watch-report.pdf

https://upload.wikimedia.org/wikipedia/commons/1/10/Moffat_collection_system_project-_Final_environmental_impact_statement-_Appendix_H-_Hydrologic_data_and_PACSM_output_-_USACE-p16021coll7-749.pdf?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original

## Data Sources

SNOTEL API docs - https://wcc.sc.egov.usda.gov/awdbRestApi/v3/api-docs

### Retrieving SNOTEL data

```javascript
const params = {
    "stationTriplets" : "938:CO:SNTL",
    "elements" : "WTEQ",
    "duration": "DAILY",
    "beginDate": "2022-04-02",
    "endDate": "2026-08-19"
}
const queryParams = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
await fetch('https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?' + queryParams).then(x => x.json())

```

## Map of water basins and stations

https://nwcc-apps.sc.egov.usda.gov/imap/#version=2&elements=&networks=!&states=!&basins=!&hucs=&minElevation=&maxElevation=&elementSelectType=any&activeOnly=true&activeForecastPointsOnly=true&hucLabels=false&hucIdLabels=false&hucParameterLabels=true&stationLabels=&overlays=&overlays=&basinOpacity=75&basinNoDataOpacity=25&basemapOpacity=100&maskOpacity=0&mode=data&openSections=dataElement,parameter,date,basin,options,elements,location,networks&controlsOpen=true&popup=&popupMulti=&popupBasin=140100&base=esriNgwm&displayType=basin&basinType=6&dataElement=PREC&depth=-8&parameter=PCTMED&frequency=DAILY&duration=wytd&customDuration=&dayPart=E&monthPart=E&forecastPubDay=1&forecastExceedance=50&useMixedPast=true&seqColor=1&divColor=7&scaleType=D&scaleMin=&scaleMax=&referencePeriodType=POR&referenceBegin=1991&referenceEnd=2020&minimumYears=20&hucAssociations=true&relativeDate=-1&lat=40.576&lon=-105.134&zoom=8.0