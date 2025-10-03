//TODO
//create mobile layout

//features:
//compare historical data between two locations
//show average temp for a month

interface Station 
{
    fmisid: string;
    name?: string;
    begin?: string;    
    pos?: string;
    region?: string;
    distance?: number  
}

interface Weather
{
    date: string;
    tday?: string;
    tmin?: string;
    tmax?: string;
    snow?: string;
    rrday?: string;
}

var station_distances: Station[] = [];
var stations: Station[] = [];
var weather_data: Weather[] = [];

const top_padding = 100;
const bottom_padding = 20;
const left_padding = 40;
const right_padding = 40;

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
    let select = document.getElementById("station_select");
    let locationInput = document.getElementById("location") as HTMLInputElement;

    //if location is same as previous search, skip station searching
    if(select.getAttribute("data-prev-search") != locationInput.value.toLowerCase())
    {
        station_distances = [];
        //attempt to find closest stations        
        for(let i=0; i<locations.length; i++)
        {
            if(locations[i].city.toLowerCase() == locationInput.value.toLowerCase())
            {
                let coord_lat: number = parseFloat(locations[i].lat);
                let coord_lng: number = parseFloat(locations[i].lng);
                
                for(let j=0; j<stations.length; j++)
                {
                    let station_coords: string[] = stations[j].pos.split(" ");
                    let station_lat: number = parseFloat(station_coords[0]);
                    let station_lng: number = parseFloat(station_coords[1]);

                    let distance_to_station = parseFloat(calcDistance(coord_lat, coord_lng, station_lat, station_lng).toFixed(1));

                    //ignore stations if they are over 75km away
                    if(distance_to_station < 75)
                    {
                        //ignore station if it was not active in selected year
                        let station_start_year = parseInt(stations[j].begin.split("-")[0]);
                        let year = parseInt((document.getElementById("year_select") as HTMLSelectElement).value);

                        if(station_start_year <= year)
                        {
                            station_distances.push({fmisid: stations[j].fmisid, name: stations[j].name, region: stations[j].region, pos: stations[j].pos, begin: stations[j].begin, distance: distance_to_station});
                        }
                    }
                }
                station_distances.sort((a, b) => a.distance - b.distance)
                //restrict maximum amount of stations to 10
                if(station_distances.length >= 10)
                {
                    station_distances = station_distances.slice(0, 10);
                }

                //populate station select
                select.innerHTML = "";
                for(let j=0; j<station_distances.length; j++)
                {
                    let option = document.createElement("option");
                    option.value = station_distances[j].fmisid;
                    option.text = station_distances[j].name;
                    select.appendChild(option);
                }
                break;
            }
        }
        select.setAttribute("data-prev-search", locationInput.value.toLowerCase());
    }

    if(station_distances.length > 0)
    {
        document.getElementById("search_error").textContent = "";
        connectToAPI();
    }
    else
    {
        //no stations found within 75km range, time period or incorrect input
        document.getElementById("search_error").textContent="No results found. Try another location or date.";
    }
}

//fetch data from FMI API based on input fields
function connectToAPI(): void
{
    //fetch amount of days in month
    const numDays = (y, m) => new Date(y, m, 0).getDate();

    let month = (document.getElementById("month_select") as HTMLSelectElement).value;
    let year = (document.getElementById("year_select") as HTMLSelectElement).value;
    let start_date = year + "-" + month + "-01T00:00:00Z";
    let end_date = year + "-" + month + "-" + numDays(year, parseInt(month)) + "T00:00:00Z";

    let fmisid = (document.getElementById("station_select") as HTMLSelectElement).value;

    let data_url: string = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&fmisid="+fmisid+"&parameters=tday,tmin,tmax,snow,rrday&starttime="+start_date+"&endtime="+end_date;

    fetch(data_url)
    .then(response => response.text())
    .then(data => {
        parseData(data);
    })
    .catch(error => {
        alert("API error");
        console.error('Error fetching data:', error);
    });
}

//parse fetched data
function parseData(data: string): void 
{
    let split_data: string[] = data.split("<wfs:member>");
    weather_data = []; //clear previous data
    let weather_obj: Weather = {
        date: ""
    };
    for(let i=1; i<split_data.length; i++) 
    {
        let str: string = split_data[i];
        let time: string = str.split('<BsWfs:Time>').pop().split('</BsWfs:Time>')[0];

        //var pos: string = str.split('<gml:pos>').pop().split('</gml:pos>')[0];
        let parameter: string = str.split('<BsWfs:ParameterName>').pop().split('</BsWfs:ParameterName>')[0];
        let value: string = str.split('<BsWfs:ParameterValue>').pop().split('</BsWfs:ParameterValue>')[0];

        weather_obj.date = time;
        if(parameter == "tday") {
            weather_obj.tday = value;
        }
        else if(parameter == "tmin") {
            weather_obj.tmin = value;
        }
        else if(parameter == "tmax") {
            weather_obj.tmax = value;
        }
        else if(parameter == "snow") {
            weather_obj.snow = value;
        }
        else if(parameter == "rrday") {
            weather_obj.rrday = value;
            //push object into other array when done with last value of the day
            let obj_clone = structuredClone(weather_obj);
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
        
        let canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px Arial";
        let txt = "No data available for the selected time period";
        ctx.fillText(txt, canvas.width/2-ctx.measureText(txt).width/2, canvas.height/2);

        getStationInfo();
    }
}

function getStationInfo(): void
{
    let fmisid = (document.getElementById("station_select") as HTMLSelectElement).value;
    for(let i=0; i<station_distances.length; i++)
    {
        if(station_distances[i].fmisid == fmisid)
        {
            let date = station_distances[i].begin.split("T")[0].split("-");
            let format_date = date[2]+"."+date[1]+"."+date[0];

            /*
            let station = (document.getElementById("station_select") as HTMLSelectElement);
            var text = station.options[station.selectedIndex].text;
            */

            let month = (document.getElementById("month_select") as HTMLSelectElement).value;
            let year = (document.getElementById("year_select") as HTMLSelectElement).value;

            let canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
            let ctx = canvas.getContext("2d");
            ctx.font = "16px Roboto";
            ctx.fillText(month + "/" + year, left_padding, 30);
            ctx.font = "14px Roboto";
            ctx.fillText("Active since: " + format_date, left_padding, 62);
            ctx.fillText("Distance: " + station_distances[i].distance + " km", left_padding, 85);
        }
    }
}

function fetchStations(): void
{
    let regions_url: string = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::ef::stations";
    fetch(regions_url)
    .then(response => response.text())
    .then(data => {
        parseStations(data);
    })
    .catch(error => {
        alert("API error");
        console.error('Error fetching data:', error);
    });
}

function parseStations(data: string): void
{
    let split_data: string[] = data.split("<wfs:member>");
    stations = [];
    for(let i=1; i<split_data.length; i++) 
    {
        let str: string = split_data[i];

        if(str.search("Automaattinen sääasema") != -1) //only include automatic weather stations
        {
            let fmisid: string = str.split('codeSpace="http://xml.fmi.fi/namespace/stationcode/fmisid">').pop().split('</gml:identifier>')[0];
            let name: string = str.split('codeSpace="http://xml.fmi.fi/namespace/locationcode/name">').pop().split('</gml:name>')[0];
            let region: string = str.split('codeSpace="http://xml.fmi.fi/namespace/location/region">').pop().split('</gml:name>')[0];
            let pos: string = str.split('<gml:pos>').pop().split('</gml:pos>')[0];
            let begin: string = str.split('<gml:beginPosition>').pop().split('</gml:beginPosition>')[0];

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
    let municipalities = [];
    for(let i=0; i<locations.length; i++)
    {
        municipalities.push(locations[i].city);
    }

    let locationInput = document.getElementById("location") as HTMLInputElement;
    locationInput.addEventListener("input", function() 
    {
        let inputValue = locationInput.value.toLowerCase();
        let suggestions = municipalities.filter(municipality => municipality.toLowerCase().startsWith(inputValue));
        
        let suggestionsDiv = document.getElementById("suggestions");
        suggestionsDiv.innerHTML = ""; // Clear previous suggestions
        suggestions.forEach(suggestion => 
        {
            let suggestionElement = document.createElement("div");
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

//disabled
//display data in table
function drawTable(): void 
{
    //display data in table
    let html: string = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
    
    for(let j=0; j<weather_data.length; j++) {
        html += "<tr><td>" + weather_data[j].date.split("T")[0] + "</td><td>" + weather_data[j].tday + "</td><td>" + weather_data[j].tmin + "</td><td>" + weather_data[j].tmax + "</td></tr>";
        document.getElementById("weather_data").innerHTML = html;
    }
}

//display data in canvas chart
function drawCanvas(): void 
{
    let canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
    let ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "10px Arial";

    let chart_range = calcChartRange();
    //get values between highest and lowest in steps of 10
    let chart_numbers = [];
    for(let j=chart_range.lowest; j<=chart_range.highest; j++)
    {
        chart_numbers.push(j);
        j = j+9;        
    }

    let highest_snow = 0;
    let highest_rain = 0;
    for(let j=0; j<weather_data.length; j++)
    {
        if(parseInt(weather_data[j].snow) > highest_snow)
        {
            highest_snow = parseInt(weather_data[j].snow);
        }
        if(parseInt(weather_data[j].rrday) > highest_rain)
        {
            highest_rain = parseInt(weather_data[j].rrday);
        }
    }

    const height_padded = canvas.height - top_padding - bottom_padding;

    //draw horizontal lines for each step
    for(let k=0; k<chart_numbers.length; k++)
    {
        let pixels_between_steps = height_padded / (chart_numbers.length - 1);
        let y = canvas.height - bottom_padding - pixels_between_steps*k;

        ctx.fillText(chart_numbers[k] + " °C", 5, y);
        ctx.beginPath();
        ctx.moveTo(left_padding, y);
        ctx.lineTo(canvas.width - right_padding, y);
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        
        if(k < chart_numbers.length-1)
        {
            //draw half step line (5c) for better readability
            ctx.beginPath();
            ctx.moveTo(left_padding, y-pixels_between_steps/2);
            ctx.lineTo(canvas.width - right_padding, y-pixels_between_steps/2);
            ctx.strokeStyle = "#dddddd";
            ctx.lineWidth = 1;
            ctx.setLineDash([1, 1]);
            ctx.stroke();
        }

        
        //record in Finland for snow is below 200cm and for rain below 200mm
        //so both can use same range, 100 by default, 200 if value in range goes over 100
        if((document.getElementById('toggle_rain') as HTMLInputElement).checked)
        {
            //rainfall markers
            if(highest_rain <= 100)
            {
                let rain_steps = 100/(chart_numbers.length-1);
                ctx.fillText(Math.round(rain_steps*k) + " mm", canvas.width - right_padding+10, y);
            }
            else
            {
                let rain_steps = 200/(chart_numbers.length-1);
                ctx.fillText(Math.round(rain_steps*k) + " mm", canvas.width - right_padding+10, y);
            }
        }
        if((document.getElementById('toggle_snow') as HTMLInputElement).checked)
        {
            //snow depth markers
            if(highest_snow <= 100)
            {
                let snow_steps = 100/(chart_numbers.length-1);
                ctx.fillText(Math.round(snow_steps*k) + " cm", canvas.width - right_padding+10, y);
            }
            else
            {
                let snow_steps = 200/(chart_numbers.length-1);
                ctx.fillText(Math.round(snow_steps*k) + " cm", canvas.width - right_padding+10, y);
            }
        }        
    }

    //draw vertical lines for days
    let pixels_between_days = (canvas.width - left_padding - right_padding) / (weather_data.length - 1);
    for(let d=0; d<weather_data.length; d++)
    {
        let x = left_padding + pixels_between_days*d;
        ctx.beginPath();
        ctx.moveTo(x, top_padding);
        ctx.lineTo(x, canvas.height - bottom_padding);
        ctx.strokeStyle = "#eeeeee";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillText((d+1).toString(), x-5, canvas.height - 5);
    }

    document.getElementById("result_view").style.display = "block";
    document.getElementById("hover_wrapper").innerHTML = "";
    //draw temperature lines
    drawLines(ctx, chart_range, height_padded, pixels_between_days, highest_snow, highest_rain);
    getStationInfo();
    //scroll to chart
    window.scrollTo({
        top: 420,
        left: 0,
        behavior: "smooth",
    });
}

//draw temperature lines and points
function drawLines(ctx: CanvasRenderingContext2D, chart_range: { highest: number; lowest: number; }, height_padded: number, pixels_between_days: number, highest_snow: number, highest_rain: number): void
{
    for(let a=0; a<weather_data.length; a++)
    {
        drawPoints(a, ctx, chart_range, height_padded, pixels_between_days, highest_snow, highest_rain);
    }
}

//draw points with delay for animation effect
function drawPoints(a: number, ctx: CanvasRenderingContext2D, chart_range: { highest: number; lowest: number; }, height_padded: number, pixels_between_days: number, highest_snow: number, highest_rain: number): void
{
    let canvas = document.getElementById("weather_chart") as HTMLCanvasElement;
    window.setTimeout(() => {
        //draw snow/rain first so temperature gets drawn over it
        if(parseInt(weather_data[a].snow) > 0 && (document.getElementById('toggle_snow') as HTMLInputElement).checked)
        {
            let max_snow = 100;
            if(highest_snow > 100)
            {
                max_snow = 200;
            }
            let x = left_padding + pixels_between_days*(a);
            let y_start = canvas.height - bottom_padding;
            let snow_per_pixel = height_padded/max_snow;
            let y_end = y_start - snow_per_pixel*parseInt(weather_data[a].snow);

            ctx.beginPath();
            ctx.moveTo(x, y_start);
            ctx.lineTo(x, y_end); 
            ctx.strokeStyle = "#b0def8";
            ctx.lineWidth = 10;
            ctx.setLineDash([]);
            ctx.stroke();

            addBarHover(x, y_start, y_end, a, "snow");
        }
        if(parseInt(weather_data[a].rrday) > 0 && (document.getElementById('toggle_rain') as HTMLInputElement).checked)
        {
            let max_rain = 100;
            if(highest_rain > 100)
            {
                max_rain = 200;
            }
            let x = left_padding + pixels_between_days*(a);
            let y_start = canvas.height - bottom_padding;
            let rain_per_pixel = height_padded/max_rain;
            let y_end = y_start - rain_per_pixel*parseInt(weather_data[a].rrday);

            ctx.beginPath();
            ctx.moveTo(x, y_start);
            ctx.lineTo(x, y_end); 
            ctx.strokeStyle = "#2eaef8ff";
            ctx.lineWidth = 10;
            ctx.setLineDash([]);
            ctx.stroke();

            addBarHover(x, y_start, y_end, a, "rain");
        }

        if(a>0)
        {
            //tday
            if((document.querySelectorAll('.legend_checkbox')[1] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                let y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

                drawChartSection(a, ctx, pixels_between_days, y, y_prev, "green");
            }
            //tmin
            if((document.querySelectorAll('.legend_checkbox')[2] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                let y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

                drawChartSection(a, ctx, pixels_between_days, y, y_prev, "blue");            
            }
            //tmax
            if((document.querySelectorAll('.legend_checkbox')[0] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                let y_prev = canvas.height - bottom_padding - ((parseFloat(weather_data[a-1].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;

                drawChartSection(a, ctx, pixels_between_days, y, y_prev, "red");   
            }
        }
        else //draw first point
        {
            //tday
            if((document.querySelectorAll('.legend_checkbox')[1] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tday) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                drawChartHover(left_padding, y, a, "green");
            }
            //tmin
            if((document.querySelectorAll('.legend_checkbox')[2] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmin) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                drawChartHover(left_padding, y, a, "blue");          
            }
            //tmax
            if((document.querySelectorAll('.legend_checkbox')[0] as HTMLInputElement).checked)
            {
                let y = canvas.height - bottom_padding - ((parseFloat(weather_data[a].tmax) - chart_range.lowest) / (chart_range.highest - chart_range.lowest)) * height_padded;
                drawChartHover(left_padding, y, a, "red");
            }
        }
        
    }, 20*a);
}

//adds hover event for snow and rain bars by creating invisible divs over the bars
function addBarHover(x: number, y_start: number, y_end: number, a: number, type: string): void
{
    let hover_div = document.createElement("div");
    hover_div.className = "hover_div bar_hover";
    hover_div.style.left = (x-5).toString() + "px";
    hover_div.style.top = (y_end-top_padding).toString() + "px";
    hover_div.style.height = ((y_start-top_padding) - (y_end-top_padding)).toString() + "px";
    if(type == "snow")
    {
        hover_div.title = parseInt(weather_data[a].snow) + " cm of snow";
    }
    else if(type == "rain")
    {
        hover_div.title = weather_data[a].rrday + " mm of rain";
    }

    document.getElementById("hover_wrapper").appendChild(hover_div);
}

//draw section of the chart
function drawChartSection(a: number, ctx: CanvasRenderingContext2D, pixels_between_days: number, y: number, y_prev: number, color: string): void
{
    let x = left_padding + pixels_between_days*a;
    let x_prev = left_padding + pixels_between_days*(a-1);

    ctx.beginPath();
    ctx.moveTo(x_prev, y_prev);
    ctx.lineTo(x, y); 
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
    //ctx.fillRect(x-2,y-2,4,4);

    drawChartHover(x, y, a, color);
}

//draw hoverable circles for chart points
function drawChartHover(x: number, y: number, a: number, color: string): void
{
    let hover_div = document.createElement("div");

    hover_div.className = "hover_div chart_point";
    hover_div.style.left = (x-4).toString() + "px";
    hover_div.style.top = (y-4-top_padding).toString() + "px";
    hover_div.style.backgroundColor = color;

    if(color == "red")
    {
        hover_div.title = weather_data[a].tmax + " °C";
    }
    else if(color == "blue")
    {
        hover_div.title = weather_data[a].tmin + " °C";
    }
    else if(color == "green")
    {
        hover_div.title = weather_data[a].tday + " °C";
    }
    document.getElementById("hover_wrapper").appendChild(hover_div);
}

//calculate highest and lowest temperature in data range
function calcChartRange(): { highest: number; lowest: number;}
{
    let highest_temp_on_range = 10;
    let lowest_temp_on_range = 0;

    for(let j=1; j<weather_data.length; j++) 
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

    let obj = {highest: highest_temp_on_range, lowest: lowest_temp_on_range};
    return obj;
}

//populate year select options
function populateYears(): void 
{
    let select = document.getElementById("year_select");
    let currentYear = new Date().getFullYear();

    for (let year = 1900; year <= currentYear; year++) 
    {
        let option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        select.appendChild(option);
    }
    (<HTMLSelectElement>select).value = currentYear.toString(); //set current year as selected
}

//set current month as selected
function selectActiveMonth(): void 
{
    let monthSelect = document.getElementById("month_select") as HTMLSelectElement;
    let currentMonth = new Date().getMonth() + 1;
    monthSelect.value = currentMonth.toString().padStart(2, '0'); //pad single digit months with leading zero
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