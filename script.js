//page load actions
window.addEventListener('load', function () {
    updateTimestamp();
    populateYears(); //populate year select options
    selectActiveMonth(); //set current month as selected
    loadData();
});
//page load timestamp
function updateTimestamp() {
    var now = new Date().toLocaleString('fi-FI');
    document.getElementById("timestamp").innerHTML = now;
}
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
        //display data in table
        var html = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
        for (var j = 0; j < obj_array.length; j++) {
            html += "<tr><td>" + obj_array[j].date.split("T")[0] + "</td><td>" + obj_array[j].tday + "</td><td>" + obj_array[j].tmin + "</td><td>" + obj_array[j].tmax + "</td></tr>";
            document.getElementById("weather_data").innerHTML = html;
        }
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
    //average
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
function populateYears() {
    var select = document.getElementById("year_select");
    var currentYear = new Date().getFullYear();
    //check how old data is available from FMI
    //show error if no data
    //find closest location with data
    //tampere 02/2000
    //kajaani 05/1975
    //https://www.ilmatieteenlaitos.fi/avoin-data-saahavaintojen-vrk-ja-kk-arvot
    //https://www.ilmatieteenlaitos.fi/havaintoasemat
    for (var year = 1950; year <= currentYear; year++) {
        var option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        select.appendChild(option);
    }
    select.value = currentYear.toString(); //set current year as selected
}
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

fmi::observations::weather::daily::simple
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=describeStoredQueries&storedquery_id=fmi::observations::weather::daily::simple
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&parameters=tday,tmin,tmax

lämpötila arvot kajaaniin heinäkuun ajalta
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&parameters=tday,tmin,tmax&starttime=2012-07-01T00:00:00Z&endtime=2012-07-31T00:00:00Z

fmi::observations::weather::daily::timevaluepair
*/ 
//# sourceMappingURL=script.js.map