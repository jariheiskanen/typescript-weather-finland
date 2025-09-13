//compile with tsc .\script.ts
//export {}


//page load actions
window.addEventListener('load', function() {
    updateTimestamp();
    populateYears(); //populate year select options
    selectActiveMonth(); //set current month as selected

    loadData();
});

//page load timestamp
function updateTimestamp(): void {
    var now: string = new Date().toLocaleString('fi-FI');
    document.getElementById("timestamp").innerHTML = now;
}

function loadData(): void {
    //fetch amount of days in month
    const numDays = (y, m) => new Date(y, m, 0).getDate();

    var month = (document.getElementById("month_select") as HTMLSelectElement).value;
    var year = (document.getElementById("year_select") as HTMLSelectElement).value;
    var start_date = year + "-" + month + "-01T00:00:00Z";
    var end_date = year + "-" + month + "-" + numDays(year, parseInt(month)) + "T00:00:00Z";

    var data_url: string = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::daily::simple&place=kajaani&parameters=tday,tmin,tmax&starttime="+start_date+"&endtime="+end_date;

    fetch(data_url)
    .then(response => response.text())
    .then(data => {
        parseData(data);
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });
}

function parseData(data: string): void 
{
    var split_data: string[] = data.split("<wfs:member>");

    //track if date changed
    var loopTime: string = "";
   
    var obj_array = [];
    var weather_obj: { date: string, tday?: string, tmin?: string, tmax?: string } = {
        date: ""
    };
    for(var i=1; i<split_data.length; i++) 
    {
        var str: string = split_data[i];
        var time: string = str.split('<BsWfs:Time>').pop().split('</BsWfs:Time>')[0];

        //check if day changes for data grouping
        if (time != loopTime) 
        {
            //clone object and push object into array here
            var obj_clone = structuredClone(weather_obj);
            obj_array.push(obj_clone);
            
        }
        loopTime = time;

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
        }
        else{}
    }
    //display data in table
    var html: string = "<table><tr><th>Date</th><th>Avg (°C)</th><th>Min (°C)</th><th>Max (°C)</th></tr>";
    
    for(var j=1; j<obj_array.length; j++) {
        html += "<tr><td>" + obj_array[j].date.split("T")[0] + "</td><td>" + obj_array[j].tday + "</td><td>" + obj_array[j].tmin + "</td><td>" + obj_array[j].tmax + "</td></tr>";
        document.getElementById("weather_data").innerHTML = html;
    }
}

function populateYears(): void 
{
    var select = document.getElementById("year_select");
    var currentYear = new Date().getFullYear();

    //check how old data is available from FMI
    //https://www.ilmatieteenlaitos.fi/avoin-data-saahavaintojen-vrk-ja-kk-arvot
    //https://www.ilmatieteenlaitos.fi/havaintoasemat

    for (var year = 1950; year <= currentYear; year++) 
    {
        var option = document.createElement("option");
        option.value = year.toString();
        option.text = year.toString();
        select.appendChild(option);
    }
    (<HTMLSelectElement>select).value = currentYear.toString(); //set current year as selected
}

function selectActiveMonth(): void 
{
    var monthSelect = document.getElementById("month_select") as HTMLSelectElement;
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