(function () {
    'use strict';

    // Open-Meteo is keyless: this plugin is served as a public static file, so
    // whatever it contains is world-readable. The previous provider
    // (WeatherAPI.com) needed an API key that ended up published here and had
    // to be revoked; a keyless provider removes that class of leak entirely.
    var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
    var GEO_URL = 'https://get.geojs.io/v1/ip/geo.json';
    var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes: bounds the request rate
    var REQUEST_TIMEOUT_MS = 5000;

    // WMO weather codes -> Russian description (Open-Meteo returns codes, not text)
    var WMO_TEXT = {
        0: 'Ясно', 1: 'Преимущественно ясно', 2: 'Переменная облачность', 3: 'Пасмурно',
        45: 'Туман', 48: 'Изморозь',
        51: 'Слабая морось', 53: 'Морось', 55: 'Сильная морось',
        56: 'Ледяная морось', 57: 'Сильная ледяная морось',
        61: 'Небольшой дождь', 63: 'Дождь', 65: 'Сильный дождь',
        66: 'Ледяной дождь', 67: 'Сильный ледяной дождь',
        71: 'Небольшой снег', 73: 'Снег', 75: 'Сильный снег', 77: 'Снежные зёрна',
        80: 'Небольшие ливни', 81: 'Ливни', 82: 'Сильные ливни',
        85: 'Небольшой снегопад', 86: 'Сильный снегопад',
        95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза с градом'
    };

    function describeWeatherCode(code) {
        return WMO_TEXT[code] || 'Неизвестно';
    }

    function WeatherInterface() {
        var html;
        var network = new Lampa.Reguest();
        var cache = { key: null, at: 0, temp: null, condition: null };

        this.create = function () {
            html = $('<div class="weather-widget">' +
                    '<div class="weather-temp" id="weather-temp"> </div>' +
                    '<div class="weather-condition" id="weather-condition"></div>' +
                    '</div>');
        };

        function showWeather(temp, condition) {
            if (typeof temp !== 'number' || isNaN(temp)) return;
            console.log("Погода", "Температура: " + Math.floor(temp));
            console.log("Погода", "Обстановка: " + condition);
            $('#weather-temp').text(Math.floor(temp) + '°');
            $('#weather-condition').text(condition).toggleClass('long-text', condition.length > 10);
        }

        function processWeatherData(result) {
            var current = result.current;
            if (!current) return;
            cache.temp = current.temperature_2m;
            cache.condition = describeWeatherCode(current.weather_code);
            cache.at = Date.now();
            showWeather(cache.temp, cache.condition);
        }

        function processError() {
            console.log('Error retrieving weather data');
        }

        this.getWeatherData = function (position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            var key = lat + ',' + lon;

            // Serve from cache when possible: keyless providers are still rate
            // limited per client, and the widget re-requests on every render.
            if (cache.key === key && (Date.now() - cache.at) < CACHE_TTL_MS) {
                showWeather(cache.temp, cache.condition);
                return;
            }
            cache.key = key;

            var url = FORECAST_URL +
                '?latitude=' + lat + '&longitude=' + lon +
                '&current=temperature_2m,weather_code&timezone=auto';

            network.clear();
            network.timeout(REQUEST_TIMEOUT_MS);
            network.silent(url, processWeatherData, processError);
        };

        this.getWeatherByIP = function () {
            $.get(GEO_URL, function (locationData) {
                var lat = parseFloat(locationData.latitude || locationData.lat);
                var lon = parseFloat(locationData.longitude || locationData.lon);
                if (isNaN(lat) || isNaN(lon)) {
                    console.log('Error retrieving weather data');
                    return;
                }
                console.log("Погода", "Город: " + locationData.city);
                this.getWeatherData({ coords: { latitude: lat, longitude: lon } });
            }
                .bind(this));
        };

        this.getWeather = function () {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    this.getWeatherData.bind(this),
                    this.getWeatherByIP.bind(this));
            } else {
                this.getWeatherByIP();
            }
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            if (html) {
                html.remove();
                html = null;
            }
        };
    }

    var weatherInterface = new WeatherInterface();
    var isTimeVisible = true;

    $(document).ready(function () {
	setTimeout(function(){
        // Создаем интерфейс погоды
        weatherInterface.create();
        var weatherWidget = weatherInterface.render();
        $('.head__time').after(weatherWidget);

        // Функция для переключения между отображением времени и виджета погоды
        function toggleDisplay() {
            if (isTimeVisible) {
                $('.head__time').hide();
                $('.weather-widget').show();
            } else {
                $('.head__time').show();
                $('.weather-widget').hide();
            }
            isTimeVisible = !isTimeVisible;
        }

        // Устанавливаем интервал для переключения между временем и погодой каждые 10 секунд
        setInterval(toggleDisplay, 10000);

        // Получаем начальные данные о погоде
        weatherInterface.getWeather();

        // Скрываем виджет погоды при загрузке страницы
        $('.weather-widget').hide();
		var width_element = document.querySelector('.head__time');
		console.log(width_element.offsetWidth);
		$('.weather-widget').css('width', width_element.offsetWidth + 'px');
		$('.head__time').css('width', width_element.offsetWidth + 'px');
    },5000)
	});

})();
