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
//parse fetched data
function parseData(data) {
    var split_data = data.split("<wfs:member>");
    //track if date changed
    var loopTime = "";
    var obj_array = [];
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
            obj_array.push(obj_clone);
        }
        else { }
    }
    if (obj_array.length != 0) {
        drawTable(obj_array);
        drawCanvas(obj_array);
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
function drawTable(data) {
    //display data in table
    var html = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
    for (var j = 0; j < data.length; j++) {
        html += "<tr><td>" + data[j].date.split("T")[0] + "</td><td>" + data[j].tday + "</td><td>" + data[j].tmin + "</td><td>" + data[j].tmax + "</td></tr>";
        document.getElementById("weather_data").innerHTML = html;
    }
}
//display data in canvas chart
function drawCanvas(data) {
    var canvas = document.getElementById("weather_chart");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "10px Arial";
    var chart_range = calcChartRange(data);
    //get values between highest and lowest in steps of 10
    var chart_numbers = [];
    for (var j = chart_range.lowest; j <= chart_range.highest; j++) {
        chart_numbers.push(j);
        j = j + 9;
    }
    const top_padding = 20;
    const bottom_padding = 20;
    const left_padding = 40;
    const right_padding = 20;
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
    var pixels_between_days = (canvas.width - left_padding - right_padding) / (data.length - 1);
    for (var d = 0; d < data.length; d++) {
        var x = left_padding + pixels_between_days * d;
        ctx.beginPath();
        ctx.moveTo(x, top_padding);
        ctx.lineTo(x, canvas.height - bottom_padding);
        ctx.strokeStyle = "#eeeeee";
        ctx.stroke();
        ctx.fillText((d + 1).toString(), x - 5, canvas.height - 5);
    }
    //draw temperature lines
    drawLines(data, ctx, chart_range, left_padding, bottom_padding, height_padded, pixels_between_days);
}
//improve this function
function drawLines(data, ctx, chart_range, left_padding, bottom_padding, height_padded, pixels_between_days) {
    //average
    var canvas = document.getElementById("weather_chart");
    ctx.beginPath();
    for (var a = 0; a < data.length; a++) {
        if (data[a].tday) {
            var x = left_padding + pixels_between_days * a;
            var y = canvas.height - bottom_padding - ((parseFloat(data[a].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            if (a == 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
    }
    ctx.strokeStyle = "green";
    ctx.stroke();
    //minimum
    ctx.beginPath();
    for (var b = 0; b < data.length; b++) {
        if (data[b].tmin) {
            var x = left_padding + pixels_between_days * b;
            var y = canvas.height - bottom_padding - ((parseFloat(data[b].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            if (b == 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
    }
    ctx.strokeStyle = "blue";
    ctx.stroke();
    //maximum
    ctx.beginPath();
    for (var c = 0; c < data.length; c++) {
        if (data[c].tmax) {
            var x = left_padding + pixels_between_days * c;
            var y = canvas.height - bottom_padding - ((parseFloat(data[c].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            if (c == 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
    }
    ctx.strokeStyle = "red";
    ctx.stroke();
}
//calculate highest and lowest temperature in data range
function calcChartRange(data) {
    var highest_temp_on_range = 10;
    var lowest_temp_on_range = 0;
    for (var j = 1; j < data.length; j++) {
        if (parseFloat(data[j].tmax) > highest_temp_on_range) {
            highest_temp_on_range = parseFloat(data[j].tmax);
        }
        if (parseFloat(data[j].tmin) < lowest_temp_on_range) {
            lowest_temp_on_range = parseFloat(data[j].tmin);
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