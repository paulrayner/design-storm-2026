async function goGetTheRecentWeatherData(currentYear, stationId) {
    const params = {
        "dataset": "daily-summaries",
        "stations": "USC00051071",
        "startDate": `${currentYear - 1}-11-01`,
        "endDate": `${currentYear}-09-25`,
        "dataTypes": "TMAX",
        "format": "json",
        "units": "standard"
    };

    const queryParams = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
    const apiResponse = await fetch('https://www.ncei.noaa.gov/access/services/data/v1?' + queryParams).then(x => x.json())

    const monthlyMaxTemperature = {}

    apiResponse.forEach(statisticsForDay => {
        const date = statisticsForDay.DATE;
        const maximumTemperature = Number(statisticsForDay.TMAX);
        const yearMonth = date.split('-').slice(0, 2).join('-')
        monthlyMaxTemperature[yearMonth] = monthlyMaxTemperature[yearMonth] || []
        monthlyMaxTemperature[yearMonth].push(maximumTemperature)
    });
    return monthlyMaxTemperature;
}


async function goGetTheRecentStationData(yearToRead, stationId) {
    const params = {
        "stationTriplets": `${stationId}:CO:SNTL`,
        "elements": "WTEQ",
        "duration": "MONTHLY",
        "beginDate": `${yearToRead - 1}-11-01`,
        "endDate": `${yearToRead}-09-30`
    };

    const queryParams = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
    const apiResponse = await fetch('https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?' + queryParams).then(x => x.json())
    const items = apiResponse[0].data[0].values;

    return Object.fromEntries(items
        .filter(({year, month}) => year === yearToRead || (year === yearToRead - 1 && month > 10))
        .map(({year, month, value}) => [`${year}-${month.toString().padStart(2, "0")}`, value]));
}

async function fetchAndChartStationPrecipitationData(stationMap, year, maxTemperatureByYearMonth, chartParent, onYearChange) {
    const watershedName = "Upper Colorado Watershed";
    const watershedStationIds = [602, 505, 1014, 970, 335, 415];
    const xAxis = [
        { year: year - 1, month: 11 },
        { year: year - 1, month: 12 },
        ...Array.from({ length: 9 }).map((_, i) => ({ year: year, month: i + 1}))
    ].map(({ year, month }) => `${year}-${month.toString().padStart(2, "0")}`)

    const allStationData =
        await Promise.all(
            watershedStationIds.map(stationId => goGetTheRecentStationData(year, stationId))
        )
    const allStationDataByYearMonth = {}
    allStationData.forEach(dataForOneStation => {
        xAxis.forEach(yearMonth => {
            allStationDataByYearMonth[yearMonth] = allStationDataByYearMonth[yearMonth] || []
            allStationDataByYearMonth[yearMonth].push(dataForOneStation[yearMonth])
        })

    })
    const years = Array.from({ length: 2026 - 2005 + 1 }).map((_, i) => 2005 + i)
    const dynamicHeader = chartParent.querySelector('.dynamic-header');
    dynamicHeader.innerHTML = `
        <span>${watershedName} (${year})</span>
        <select name="year-picker" class="year-picker">
          ${years.map(y => `<option value="${y}" ${y === year ? 'selected': ''}>${y}</option>`).join('')}
        </select>
    `;
    const yearPicker = dynamicHeader.querySelector('.year-picker');
    yearPicker.addEventListener('change', () => {
        const newYear = Number(yearPicker.value);
        onYearChange(newYear)
    })
    chartParent.querySelector('canvas').remove();
    const newCanvas = document.createElement('canvas');
    chartParent.appendChild(newCanvas)
    const chartContext = newCanvas;
    const chartData = xAxis.map(yearMonth => ({x: yearMonth, y: average(allStationDataByYearMonth[yearMonth]) }));
    const weatherDataForChart = xAxis.map(yearMonth => ({ x: yearMonth, y: average(maxTemperatureByYearMonth[yearMonth] || [])}))
    new Chart(chartContext, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `Snow Pack`,
                    data: chartData,
                    yAxisID: 'yPrecipitationAxis'
                },
                {
                    label: 'Average Temperature',
                    data: weatherDataForChart,
                    yAxisID: 'yTemperatureAxis'
                }
            ]
        },
        options: {
            scales: {
                yPrecipitationAxis: {
                    position: 'left'
                },
                yTemperatureAxis: {
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
    document.querySelector('#chartTitle').innerHTML = watershedName;
    document.querySelector('#chartSubtitle').innerHTML = "SNOTEL Stations: " + watershedStationIds.map(x => stationMap[x]).join(", ");
}

async function readStationMetadata() {
    const params = {
        "stationTriplets": "*:CO:SNTL"
    }
    const queryParams = Object.entries(params).map(([key, value]) => `${key}=${value}`).join('&')
    const apiResponse = await fetch('https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?' + queryParams).then(x => x.json())
    const stationMap = Object.fromEntries(apiResponse
        .sort((lhs, rhs) => lhs.stationId - rhs.stationId)
        .map(({stationId, name}) => [stationId, name]))

    return stationMap;
}

async function main() {
    const stationNameMap = await readStationMetadata();
    const currentYear = 2026;
    const mainChart = document.querySelector('main #chart-1')
    await sauce(currentYear, stationNameMap, mainChart)

    const comparisonChart = document.querySelector('main #chart-2')
    const comparisonYear = 2020
    await sauce(comparisonYear, stationNameMap, comparisonChart)

    document.querySelector('#loading-indicator').remove()
}

async function sauce(year, stationNameMap, chart) {
    const maxTemperatureByYearMonth = await goGetTheRecentWeatherData(year);
    await fetchAndChartStationPrecipitationData(stationNameMap, year, maxTemperatureByYearMonth, chart, year => sauce(year, stationNameMap, chart));
}

document.addEventListener('DOMContentLoaded', main)

function average(precipitationByStation) {
    return precipitationByStation.reduce((a, b) => a + b, 0) / precipitationByStation.length;
}