//TODO
//- loading indicator when fetching data
//- hover for chart points to show values
//- improve mobile layout
//- if date older than when station founded is selected, don't include station
//- better error message
//- improve layout before data is loaded
//- improve station selection layout
//- remember selected station when loading data again from different month

//features:
//compare historical data between two locations

var stations = [];
var station_distances = [];
var weather_data = [];
const top_padding = 20;
const bottom_padding = 20;
const left_padding = 40;
const right_padding = 20;
//page load actions
window.addEventListener('load', function() {
    populateYears(); //populate year select options
    selectActiveMonth(); //set current month as selected
    autoFillLocation();
    fetchStations(); //fetch regions for location suggestions
});

//load data from fmi api
function loadData(): void 
{
    if((document.getElementById("location") as HTMLInputElement).value != "")
    {
        searchClosestStations();
    }
}

//searches closest stations based on given location within 75km range
function searchClosestStations(): void
{
    station_distances = [];
    //attempt to find closest stations
    var locationInput = document.getElementById("location") as HTMLInputElement;
    for(var i=0; i<locations.length; i++)
    {
        if(locations[i].city.toLowerCase() == locationInput.value.toLowerCase())
        {
            var coord_lat: number = parseFloat(locations[i].lat);
            var coord_lng: number = parseFloat(locations[i].lng);
            
            for(var j=0; j<stations.length; j++)
            {
                var station_coords = stations[j].pos.split(" ");
                var station_lat: number = parseFloat(station_coords[0]);
                var station_lng: number = parseFloat(station_coords[1]);

                var distance_to_station = parseFloat(calcDistance(coord_lat, coord_lng, station_lat, station_lng).toFixed(1));

                //ignore stations if they are over 75km away
                if(distance_to_station < 75)
                {
                    station_distances.push({fmisid: stations[j].fmisid, name: stations[j].name, region: stations[j].region, pos: stations[j].pos, begin: stations[j].begin, distance: distance_to_station});
                }
            }
            station_distances.sort((a, b) => a.distance - b.distance)
            //restrict maximum amount of stations to 10
            if(station_distances.length >= 10)
            {
                station_distances = station_distances.slice(0, 10);
            }

            //populate station select
            var select = document.getElementById("station_select");
            select.innerHTML = "";
            for(var j=0; j<station_distances.length; j++)
            {
                var option = document.createElement("option");
                option.value = station_distances[j].fmisid;
                option.text = station_distances[j].name;
                select.appendChild(option);
            }
            break;
        }
    }

    if(station_distances.length > 0)
    {
        connectToAPI();
    }
    else
    {
        //no stations found within 75km range or incorrect input
        alert("No results found, check if you have typed correct location");
    }
}

//fetch data from FMI API based on input fields
function connectToAPI(): void
{
    getStationInfo();
    //fetch amount of days in month
    const numDays = (y, m) => new Date(y, m, 0).getDate();

    var month = (document.getElementById("month_select") as HTMLSelectElement).value;
    var year = (document.getElementById("year_select") as HTMLSelectElement).value;
    var start_date = year + "-" + month + "-01T00:00:00Z";
    var end_date = year + "-" + month + "-" + numDays(year, parseInt(month)) + "T00:00:00Z";

    var fmisid = (document.getElementById("station_select") as HTMLSelectElement).value;

    var data_url: string = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&fmisid="+fmisid+"&parameters=tday,tmin,tmax&starttime="+start_date+"&endtime="+end_date;

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
function parseData(data: string): void 
{
    var split_data: string[] = data.split("<wfs:member>");
    weather_data = []; //clear previous data
    var weather_obj: { date: string, tday?: string, tmin?: string, tmax?: string } = {
        date: ""
    };
    for(var i=1; i<split_data.length; i++) 
    {
        var str: string = split_data[i];
        var time: string = str.split('<BsWfs:Time>').pop().split('</BsWfs:Time>')[0];

        //var pos: string = str.split('<gml:pos>').pop().split('</gml:pos>')[0];
        var parameter: string = str.split('<BsWfs:ParameterName>').pop().split('</BsWfs:ParameterName>')[0];
        var value: string = str.split('<BsWfs:ParameterValue>').pop().split('</BsWfs:ParameterValue>')[0];

        weather_obj.date = time;
        if(parameter == "tday") {
            weather_obj.tday = value;
        }
        else if(parameter == "tmin") {
            weather_obj.tmin = value;
        }
        else if(parameter == "tmax") {
            weather_obj.tmax = value;
            //push object into other array when done with last value of the day
            var obj_clone = structuredClone(weather_obj);
            weather_data.push(obj_clone);
        }
        else{}
    }
    if(weather_data.length != 0)
    {
        drawTable();
        drawCanvas();
    }
    else
    {
        document.getElementById("weather_data").innerHTML = "No data available for the selected time period.";
        
        var canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px Arial";
        ctx.fillText("No data available for the selected time period", 30, 30);
    }
}

function getStationInfo(): void
{
    var fmisid = (document.getElementById("station_select") as HTMLSelectElement).value;
    for(var i=0; i<station_distances.length; i++)
    {
        if(station_distances[i].fmisid == fmisid)
        {
            var date = station_distances[i].begin.split("T")[0].split("-");
            var format_date = date[2]+"."+date[1]+"."+date[0];

            document.getElementById("station_distance").textContent="Distance: " + station_distances[i].distance + " km";
            document.getElementById("station_active").textContent="Active since: " + format_date;
        }
    }
}

function fetchStations(): void
{
    var regions_url: string = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::ef::stations";
    fetch(regions_url)
    .then(response => response.text())
    .then(data => {
        parseStations(data);
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}

function parseStations(data: string): void
{
    var split_data: string[] = data.split("<wfs:member>");
    stations = [];
    for(var i=1; i<split_data.length; i++) 
    {
        var str: string = split_data[i];

        if(str.search("Automaattinen sääasema") != -1) //only include automatic weather stations
        {
            var fmisid: string = str.split('codeSpace="http://xml.fmi.fi/namespace/stationcode/fmisid">').pop().split('</gml:identifier>')[0];
            var name: string = str.split('codeSpace="http://xml.fmi.fi/namespace/locationcode/name">').pop().split('</gml:name>')[0];
            var region: string = str.split('codeSpace="http://xml.fmi.fi/namespace/location/region">').pop().split('</gml:name>')[0];
            var pos: string = str.split('<gml:pos>').pop().split('</gml:pos>')[0];
            var begin: string = str.split('<gml:beginPosition>').pop().split('</gml:beginPosition>')[0];

            stations.push({fmisid: fmisid, name: name, region: region, pos: pos, begin: begin});
        }
    }
}

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcDistance(lat1: number, lon1: number, lat2: number, lon2:number) 
{
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

// Converts numeric degrees to radians
function toRad(value: number) 
{
    return value * Math.PI / 180;
}

//auto fill location input with suggestions
function autoFillLocation(): void
{
    //const municipalities = locations.municipalities;
    var municipalities = [];
    for(var i=0; i<locations.length; i++)
    {
        municipalities.push(locations[i].city);
    }

    var locationInput = document.getElementById("location") as HTMLInputElement;
    locationInput.addEventListener("input", function() 
    {
        var inputValue = locationInput.value.toLowerCase();
        var suggestions = municipalities.filter(municipality => municipality.toLowerCase().startsWith(inputValue));
        
        var suggestionsDiv = document.getElementById("suggestions");
        suggestionsDiv.innerHTML = ""; // Clear previous suggestions
        suggestions.forEach(suggestion => 
        {
            var suggestionElement = document.createElement("div");
            suggestionElement.textContent = suggestion;

            suggestionElement.addEventListener("click", function() 
            {
                locationInput.value = suggestion;
                suggestionsDiv.style.display = "none";
            });

            suggestionsDiv.appendChild(suggestionElement);
        });
        suggestionsDiv.style.display = "block";
        if(inputValue === "") 
        {
            suggestionsDiv.style.display = "none";
        }
    });
}

//display data in table
function drawTable(): void 
{
    //display data in table
    var html: string = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
    
    for(var j=0; j<weather_data.length; j++) {
        html += "<tr><td>" + weather_data[j].date.split("T")[0] + "</td><td>" + weather_data[j].tday + "</td><td>" + weather_data[j].tmin + "</td><td>" + weather_data[j].tmax + "</td></tr>";
        document.getElementById("weather_data").innerHTML = html;
    }
}

//display data in canvas chart
function drawCanvas(): void 
{
    var canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "10px Arial";

    var chart_range = calcChartRange();
    //get values between highest and lowest in steps of 10
    var chart_numbers = [];
    for(var j=chart_range.lowest; j<=chart_range.highest; j++)
    {
        chart_numbers.push(j);
        j = j+9;        
    }

    const height_padded = canvas.height - top_padding - bottom_padding;

    //draw horizontal lines for each step
    for(var k=0; k<chart_numbers.length; k++)
    {
        var pixels_between_steps = height_padded / (chart_numbers.length - 1);
        var y = canvas.height - bottom_padding - pixels_between_steps*k;

        ctx.fillText(chart_numbers[k] + " °C", 5, y);
        ctx.beginPath();
        ctx.moveTo(left_padding, y);
        ctx.lineTo(canvas.width - right_padding, y);
        ctx.strokeStyle = "#cccccc";
        ctx.setLineDash([]);
        ctx.stroke();

        //draw half step line (5c) for better readability
        ctx.beginPath();
        ctx.moveTo(left_padding, y-pixels_between_steps/2);
        ctx.lineTo(canvas.width - right_padding, y-pixels_between_steps/2);
        ctx.strokeStyle = "#dddddd";
        ctx.setLineDash([1, 1]);
        ctx.stroke();
    }

    //draw vertical lines for days
    var pixels_between_days = (canvas.width - left_padding - right_padding) / (weather_data.length - 1);
    for(var d=0; d<weather_data.length; d++)
    {
        var x = left_padding + pixels_between_days*d;
        ctx.beginPath();
        ctx.moveTo(x, top_padding);
        ctx.lineTo(x, canvas.height - bottom_padding);
        ctx.strokeStyle = "#eeeeee";
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillText((d+1).toString(), x-5, canvas.height - 5);
    }

    //draw temperature lines
    drawLines(ctx, chart_range, height_padded, pixels_between_days);
    //scroll to chart
    window.scrollTo({
        top: 1000,
        left: 0,
        behavior: "smooth",
    });
}

//draw temperature lines and points
function drawLines(ctx: CanvasRenderingContext2D, chart_range: { highest: number; lowest: number; }, height_padded: number, pixels_between_days: number): void
{
    for(var a=1; a<weather_data.length; a++)
    {
        drawPoints(a, ctx, chart_range, height_padded, pixels_between_days);
    }
     
}

//draw points with delay for animation effect
function drawPoints(a: number, ctx: CanvasRenderingContext2D, chart_range: { highest: number; lowest: number; }, height_padded: number, pixels_between_days: number): void
{
    var canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
    window.setTimeout(() => {
        if(weather_data[a].tday && (document.querySelectorAll('.legend_checkbox')[1] as HTMLInputElement).checked)
        {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "green");
        }
        if(weather_data[a].tmin && (document.querySelectorAll('.legend_checkbox')[2] as HTMLInputElement).checked)
        {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "blue");            
        }
        if(weather_data[a].tmax && (document.querySelectorAll('.legend_checkbox')[0] as HTMLInputElement).checked)
        {
            var y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
            var y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

            drawChartSection(a, ctx, pixels_between_days, y, y_prev, "red");   
        }
    }, 20*a);
}

//draw section of the chart
function drawChartSection(a: number, ctx: CanvasRenderingContext2D, pixels_between_days: number, y: number, y_prev: number, color: string): void
{
    var x = left_padding + pixels_between_days*a;
    var x_prev = left_padding + pixels_between_days*(a-1);

    ctx.beginPath();
    ctx.moveTo(x_prev, y_prev);
    ctx.lineTo(x, y); 
    ctx.strokeStyle = color;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.fillRect(x-2,y-2,4,4);
}

//calculate highest and lowest temperature in data range
function calcChartRange(): { highest: number; lowest: number;}
{
    var highest_temp_on_range = 10;
    var lowest_temp_on_range = 0;

    for(var j=1; j<weather_data.length; j++) 
    {
        if(parseFloat(weather_data[j].tmax) > highest_temp_on_range) 
        {
            highest_temp_on_range = parseFloat(weather_data[j].tmax);
        }
        if(parseFloat(weather_data[j].tmin) < lowest_temp_on_range) 
        {
            lowest_temp_on_range = parseFloat(weather_data[j].tmin);
        }
    }

    highest_temp_on_range = Math.ceil(highest_temp_on_range / 10) * 10;
    lowest_temp_on_range = Math.floor(lowest_temp_on_range / 10) * 10;

    var obj = {highest: highest_temp_on_range, lowest: lowest_temp_on_range};
    return obj;
}

//populate year select options
function populateYears(): void 
{
    var select = document.getElementById("year_select");
    var currentYear = new Date().getFullYear();

    for (var year = 1900; year <= currentYear; year++) 
    {
        var option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        select.appendChild(option);
    }
    (<HTMLSelectElement>select).value = currentYear.toString(); //set current year as selected
}

//set current month as selected
function selectActiveMonth(): void 
{
    var monthSelect = document.getElementById("month_select") as HTMLSelectElement;
    var currentMonth = new Date().getMonth() + 1;
    monthSelect.value = currentMonth.toString().padStart(2, '0'); //pad single digit months with leading zero
}

function legendChanged(): void
{
    drawCanvas();
}

/* 

info
https://en.ilmatieteenlaitos.fi/open-data-manual-fmi-wfs-services
https://en.ilmatieteenlaitos.fi/open-data-manual-time-series-data
https://www.ilmatieteenlaitos.fi/tallennetut-kyselyt
https://github.com/fmidev/metoclient
https://en.ilmatieteenlaitos.fi/open-data-manual
https://en.ilmatieteenlaitos.fi/open-data-manual-wfs-examples-and-guidelines
https://www.ilmatieteenlaitos.fi/avoin-data-saahavaintojen-vrk-ja-kk-arvot
https://www.ilmatieteenlaitos.fi/havaintoasemat

list of stations
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::ef::stations

https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::timevaluepair&place=kajaani&maxlocations=5&parameters=tday,tmin,tmax&starttime=1960-07-01T00:00:00Z&endtime=1960-07-31T00:00:00Z

*/