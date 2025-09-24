//TODO
//- loading indicator when fetching data
//- animate chart drawing
//- visual improvements
//- hover for chart points to show values
//- find closest location with data if no data for requested location
//- find list of measurement stations from FMI and show those as suggestions
//- show which measurement station is being used
//data available since
//tampere 02/2000
//kajaani 05/1975
//compare historical data between two locations
var weather_data = [];
const top_padding = 20;
const bottom_padding = 20;
const left_padding = 40;
const right_padding = 20;
//page load actions
window.addEventListener('load', function () {
    updateTimestamp();
    populateYears(); //populate year select options
    selectActiveMonth(); //set current month as selected
    loadData();
    autoFillLocation();
});
//page load timestamp
function updateTimestamp() {
    var now = new Date().toLocaleString('fi-FI');
    document.getElementById("timestamp").innerHTML = now;
}
//load data from fmi api
function loadData() {
    if (document.getElementById("location").value == "") {
        //hide canvas etc on load
    }
    else {
        //fetch amount of days in month
        const numDays = (y, m) => new Date(y, m, 0).getDate();
        var month = document.getElementById("month_select").value;
        var year = document.getElementById("year_select").value;
        var start_date = year + "-" + month + "-01T00:00:00Z";
        var end_date = year + "-" + month + "-" + numDays(year, parseInt(month)) + "T00:00:00Z";
        var location = document.getElementById("location").value;
        var data_url = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=" + location + "&parameters=tday,tmin,tmax&starttime=" + start_date + "&endtime=" + end_date;
        fetch(data_url)
            .then(response => response.text())
            .then(data => {
            parseData(data);
        })
            .catch(error => {
            console.error('Error fetching data:', error);
        });
    }
}
//parse fetched data
function parseData(data) {
    var split_data = data.split("<wfs:member>");
    weather_data = []; //clear previous data
    var weather_obj = {
        date: ""
    };
    for (var i = 1; i < split_data.length; i++) {
        var str = split_data[i];
        var time = str.split('<BsWfs:Time>').pop().split('</BsWfs:Time>')[0];
        //var pos: string = str.split('<gml:pos>').pop().split('</gml:pos>')[0];
        var parameter = str.split('<BsWfs:ParameterName>').pop().split('</BsWfs:ParameterName>')[0];
        var value = str.split('<BsWfs:ParameterValue>').pop().split('</BsWfs:ParameterValue>')[0];
        weather_obj.date = time;
        if (parameter == "tday") {
            weather_obj.tday = value;
        }
        else if (parameter == "tmin") {
            weather_obj.tmin = value;
        }
        else if (parameter == "tmax") {
            weather_obj.tmax = value;
            //push object into other array when done with last value of the day
            var obj_clone = structuredClone(weather_obj);
            weather_data.push(obj_clone);
        }
        else { }
    }
    if (weather_data.length != 0) {
        drawTable();
        drawCanvas();
        document.getElementById("result_view").style.display = "block";
        //document.getElementById("input_view").style.display = "none";
    }
    else {
        document.getElementById("weather_data").innerHTML = "No data available for the selected time period.";
        var canvas = document.getElementById("weather_chart");
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px Arial";
        ctx.fillText("No data available for the selected time period", 30, 30);
    }
}
//auto fill location input with suggestions
function autoFillLocation() {
    const municipalities = locations.municipalities;
    var locationInput = document.getElementById("location");
    locationInput.addEventListener("input", function () {
        var inputValue = locationInput.value.toLowerCase();
        var suggestions = municipalities.filter(municipality => municipality.toLowerCase().startsWith(inputValue));
        var suggestionsDiv = document.getElementById("suggestions");
        suggestionsDiv.innerHTML = ""; // Clear previous suggestions
        suggestions.forEach(suggestion => {
            var suggestionElement = document.createElement("div");
            suggestionElement.textContent = suggestion;
            suggestionElement.addEventListener("click", function () {
                locationInput.value = suggestion;
                suggestionsDiv.style.display = "none";
            });
            suggestionsDiv.appendChild(suggestionElement);
        });
        suggestionsDiv.style.display = "block";
        if (inputValue === "") {
            suggestionsDiv.style.display = "none";
        }
    });
}
//display data in table
function drawTable() {
    //display data in table
    var html = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
    for (var j = 0; j < weather_data.length; j++) {
        html += "<tr><td>" + weather_data[j].date.split("T")[0] + "</td><td>" + weather_data[j].tday + "</td><td>" + weather_data[j].tmin + "</td><td>" + weather_data[j].tmax + "</td></tr>";
        document.getElementById("weather_data").innerHTML = html;
    }
}
//display data in canvas chart
function drawCanvas() {
    var canvas = document.getElementById("weather_chart");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "10px Arial";
    var chart_range = calcChartRange();
    //get values between highest and lowest in steps of 10
    var chart_numbers = [];
    for (var j = chart_range.lowest; j <= chart_range.highest; j++) {
        chart_numbers.push(j);
        j = j + 9;
    }
    const height_padded = canvas.height - top_padding - bottom_padding;
    //draw horizontal lines for each step
    for (var k = 0; k < chart_numbers.length; k++) {
        var pixels_between_steps = height_padded / (chart_numbers.length - 1);
        var y = canvas.height - bottom_padding - pixels_between_steps * k;
        ctx.fillText(chart_numbers[k] + " °C", 5, y);
        ctx.beginPath();
        ctx.moveTo(left_padding, y);
        ctx.lineTo(canvas.width - right_padding, y);
        ctx.strokeStyle = "#cccccc";
        ctx.stroke();
    }
    //draw vertical lines for days
    var pixels_between_days = (canvas.width - left_padding - right_padding) / (weather_data.length - 1);
    for (var d = 0; d < weather_data.length; d++) {
        var x = left_padding + pixels_between_days * d;
        ctx.beginPath();
        ctx.moveTo(x, top_padding);
        ctx.lineTo(x, canvas.height - bottom_padding);
        ctx.strokeStyle = "#eeeeee";
        ctx.stroke();
        ctx.fillText((d + 1).toString(), x - 5, canvas.height - 5);
    }
    //draw temperature lines
    drawLines(ctx, chart_range, height_padded, pixels_between_days);
}
//draw temperature lines and points
function drawLines(ctx, chart_range, height_padded, pixels_between_days) {
    for (var a = 1; a < weather_data.length; a++) {
        drawPoints(a, ctx, chart_range, height_padded, pixels_between_days);
    }
}
//draw points with delay for animation effect
function drawPoints(a, ctx, chart_range, height_padded, pixels_between_days) {
    var canvas = document.getElementById("weather_chart");
    window.setTimeout(() => {
        if (weather_data[a].tday) {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a - 1].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "green");
        }
        if (weather_data[a].tmin) {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a - 1].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "blue");
        }
        if (weather_data[a].tmax) {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a - 1].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "red");
        }
    }, 20 * a);
}
//draw section of the chart
function drawChartSection(a, ctx, pixels_between_days, y, y_prev, color) {
    var x = left_padding + pixels_between_days * a;
    var x_prev = left_padding + pixels_between_days * (a - 1);
    ctx.beginPath();
    ctx.moveTo(x_prev, y_prev);
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillRect(x - 2, y - 2, 4, 4);
}
//calculate highest and lowest temperature in data range
function calcChartRange() {
    var highest_temp_on_range = 10;
    var lowest_temp_on_range = 0;
    for (var j = 1; j < weather_data.length; j++) {
        if (parseFloat(weather_data[j].tmax) > highest_temp_on_range) {
            highest_temp_on_range = parseFloat(weather_data[j].tmax);
        }
        if (parseFloat(weather_data[j].tmin) < lowest_temp_on_range) {
            lowest_temp_on_range = parseFloat(weather_data[j].tmin);
        }
    }
    highest_temp_on_range = Math.ceil(highest_temp_on_range / 10) * 10;
    lowest_temp_on_range = Math.floor(lowest_temp_on_range / 10) * 10;
    var obj = { highest: highest_temp_on_range, lowest: lowest_temp_on_range };
    return obj;
}
//populate year select options
function populateYears() {
    var select = document.getElementById("year_select");
    var currentYear = new Date().getFullYear();
    for (var year = 1950; year <= currentYear; year++) {
        var option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        select.appendChild(option);
    }
    select.value = currentYear.toString(); //set current year as selected
}
//set current month as selected
function selectActiveMonth() {
    var monthSelect = document.getElementById("month_select");
    var currentMonth = new Date().getMonth() + 1;
    monthSelect.value = currentMonth.toString().padStart(2, '0'); //pad single digit months with leading zero
}
/* info
https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services
https://en.ilmatieteenlaitos.fi/open-data-manual-time-series-data
https://www.ilmatieteenlaitos.fi/tallennetut-kyselyt
https://github.com/fmidev/metoclient
https://en.ilmatieteenlaitos.fi/open-data-manual
https://en.ilmatieteenlaitos.fi/open-data-manual-wfs-examples-and-guidelines
https://www.ilmatieteenlaitos.fi/avoin-data-saahavaintojen-vrk-ja-kk-arvot
https://www.ilmatieteenlaitos.fi/havaintoasemat

fmi::observations::weather::daily::simple
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=describeStoredQueries&storedquery_id=fmi::observations::weather::daily::simple
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&parameters=tday,tmin,tmax

lämpötila arvot kajaaniin heinäkuun ajalta
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&parameters=tday,tmin,tmax&starttime=2012-07-01T00:00:00Z&endtime=2012-07-31T00:00:00Z
3 different measurement stations
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&maxlocations=3&parameters=tday,tmin,tmax&starttime=2012-07-01T00:00:00Z&endtime=2012-07-31T00:00:00Z
list of stations
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::ef::stations

fmi::observations::weather::daily::timevaluepair
*/ 
//# sourceMappingURL=script.js.map