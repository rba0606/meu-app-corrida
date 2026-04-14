// --- Configurações e Estado ---
let state = {
    isRunning: false,
    watchID: null,
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    totalDistance: 0, // em km
    pathCoords: [], // array de [lat, lon] para o mapa
    distDataForChart: [0], // dados para o gráfico
    timeLabelsForChart: ['00:00']
};

// --- Elementos da Interface ---
const ui = {
    dist: document.getElementById('distValue'),
    time: document.getElementById('timeValue'),
    pace: document.getElementById('paceValue'),
    gps: document.getElementById('gpsStatus'),
    btn: document.getElementById('btnAction'),
    timeLabel: document.getElementById('currentTimeLabel')
};

// --- Inicialização do Mapa (Leaflet) ---
// Começa focado no Brasil por padrão
const map = L.map('map', {
    zoomControl: false, // removemos os botões +/- para limpar o visual
    attributionControl: false // removemos o texto da Leaflet
}).setView([-15.7801, -47.9292], 15); 

// Camada do Mapa (CartoDB Dark Matter - combina com o visual moderno)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

// Linha que desenha o caminho da corrida
let polyline = L.polyline([], {color: '#d4fc79', weight: 5, opacity: 0.8}).addTo(map);

// Marcador da posição atual
let currentPosMarker = L.circleMarker([0,0], { radius: 8, color: '#fff', fillColor: '#007aff', fillOpacity: 1 }).addTo(map);


// --- Inicialização do Gráfico (Chart.js) ---
const ctx = document.getElementById('runChart').getContext('2d');
const runChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: state.timeLabelsForChart,
        datasets: [{
            data: state.distDataForChart,
            borderColor: 'rgba(0,0,0,0.3)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.4 // deixa a linha curva/suave
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false }, // esconde eixo X
            y: { display: false, beginAtZero: true } // esconde eixo Y
        }
    }
});


// --- Funções Auxiliares de Cálculo ---

// Cálculo de distância entre dois pontos (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Formatação de Tempo (HH:MM:SS)
function formatTime(s) {
    const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

// Formatação de Tempo Curto (MM:SS)
function formatTimeShort(s) {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Cálculo de Ritmo (min/km)
function calculatePace(seconds, kilometers) {
    if (kilometers === 0) return "0'00\"";
    const totalMinutes = seconds / 60;
    const paceDecimal = totalMinutes / kilometers;
    const paceMinutes = Math.floor(paceDecimal);
    const paceSeconds = Math.floor((paceDecimal - paceMinutes) * 60);
    return `${paceMinutes}'${paceSeconds.toString().padStart(2, '0')}"`;
}


// --- Lógica Principal ---

// Função chamada a cada atualização do GPS
function onLocationUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;

    // Atualiza status do GPS
    if (accuracy > 30) {
        ui.gps.innerText = "Sinal Fraco";
        ui.gps.style.color = "#ff9f0a";
    } else {
        ui.gps.innerText = "GPS OK";
        ui.gps.style.color = "#32d74b";
    }

    const newCoord = [latitude, longitude];

    // Se houver uma posição anterior, calcula a distância
    if (state.pathCoords.length > 0) {
        const lastCoord = state.pathCoords[state.pathCoords.length - 1];
        const distStep = calculateDistance(lastCoord[0], lastCoord[1], latitude, longitude);
        
        // Filtro de imprecisão: ignora movimentos menores que 3 metros
        if (distStep > 0.003) {
            state.totalDistance += distStep;
        }
    }

    // Atualiza Estado
    state.pathCoords.push(newCoord);

    // Atualiza Interface (Mapa e Distância)
    ui.dist.innerText = state.totalDistance.toFixed(2);
    
    // Desenha a linha e move o marcador
    polyline.setLatLngs(state.pathCoords);
    currentPosMarker.setLatLng(newCoord);
    
    // Dá zoom automático no percurso
    if (state.pathCoords.length > 1) {
        map.fitBounds(polyline.getBounds(), {padding: [20, 20]});
    } else {
        map.setView(newCoord, 18);
    }
}

function onLocationError(error) {
    console.error(error);
    ui.gps.innerText = "Erro GPS";
    ui.gps.style.color = "#ff453a";
}

// Controla o cronômetro e estatísticas de tempo
function startTimer() {
    state.timerInterval = setInterval(() => {
        state.elapsedSeconds++;
        ui.time.innerText = formatTime(state.elapsedSeconds);
        ui.pace.innerText = calculatePace(state.elapsedSeconds, state.totalDistance);
        
        // Atualiza Gráfico a cada 10 segundos
        if (state.elapsedSeconds % 10 === 0) {
            updateChart();
        }
    }, 1000);
}

// Atualiza o gráfico de distância x tempo
function updateChart() {
    const timeStr = formatTimeShort(state.elapsedSeconds);
    ui.timeLabel.innerText = timeStr;
    
    state.timeLabelsForChart.push(timeStr);
    state.distDataForChart.push(state.totalDistance.toFixed(2));
    
    // Mantém apenas os últimos 10 pontos para o gráfico não ficar gigante
    if (state.timeLabelsForChart.length > 10) {
        state.timeLabelsForChart.shift();
        state.distDataForChart.shift();
    }
    
    runChart.update('none'); // atualiza sem animação para poupar bateria
}


// --- Event Listeners ---

ui.btn.addEventListener('click', () => {
    if (!state.isRunning) {
        // --- INICIAR CORRIDA ---
        state.isRunning = true;
        state.startTime = new Date();
        
        // Ativa o rastreamento GPS contínuo (enableHighAccuracy é vital)
        state.watchID = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        });

        startTimer();

        // Altera visual do botão
        ui.btn.innerHTML = '<span class="icon-pause">⏸️</span> Pausar Atividade';
        ui.btn.classList.remove('btn-primary');
        ui.btn.style.backgroundColor = '#ff453a'; // Vermelho

    } else {
        // --- PARAR CORRIDA ---
        state.isRunning = false;
        
        // Pára o GPS
        if (state.watchID) navigator.geolocation.clearWatch(state.watchID);
        
        // Pára o cronômetro
        clearInterval(state.timerInterval);

        ui.gps.innerText = "Pausado";
        ui.gps.style.color = var(--text-secondary);

        // Altera visual do botão
        ui.btn.innerHTML = '▶️ Retomar Corrida';
        ui.btn.style.backgroundColor = var(--action-primary);
    }
});