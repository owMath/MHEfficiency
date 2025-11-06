// JavaScript para página de Previsão OEE
// Calcula OEE ponderada usando dados históricos reais e faz previsão para próximos períodos

class PrevisaoOEE {
    constructor() {
        if (!this.checkAuth()) {
            return;
        }

        this.chart = null;
        this.historicalOEE = [];
        this.forecastOEE = [];
        this.currentPeriod = 30; // dias
        this.forecastType = 'days'; // hours, days, weeks
        this.forecastLength = 7; // número de períodos para prever

        this.initialize();
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = localStorage.getItem('token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, mergedOptions);
            
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('Erro na requisição:', error);
            return null;
        }
    }

    async initialize() {
        this.setupEventListeners();
        await this.loadData();
    }

    setupEventListeners() {
        const periodSelect = document.getElementById('periodSelect');
        const forecastSelect = document.getElementById('forecastSelect');
        const refreshBtn = document.getElementById('refreshBtn');

        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.currentPeriod = parseInt(e.target.value);
                this.loadData();
            });
        }

        if (forecastSelect) {
            forecastSelect.addEventListener('change', (e) => {
                this.forecastType = e.target.value;
                this.updateForecastLength();
                this.loadData();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData();
            });
        }
    }

    updateForecastLength() {
        switch (this.forecastType) {
            case 'hours':
                this.forecastLength = 24;
                break;
            case 'days':
                this.forecastLength = 7;
                break;
            case 'weeks':
                this.forecastLength = 4;
                break;
            default:
                this.forecastLength = 7;
        }
    }

    async loadData() {
        this.showLoading();
        this.updateForecastLength();

        try {
            // Buscar máquinas do usuário
            const maquinas = await this.getUserMachines();
            if (!maquinas || maquinas.length === 0) {
                this.showError('Nenhuma máquina encontrada');
                return;
            }

            // Calcular OEE histórica para cada período
            this.historicalOEE = await this.calculateHistoricalOEE(maquinas);
            
            // Calcular OEE ponderada
            const weightedOEE = this.calculateWeightedOEE(this.historicalOEE);
            
            // Fazer previsão
            this.forecastOEE = this.calculateForecast(weightedOEE);
            
            // Renderizar gráfico
            this.renderChart();
            
            // Atualizar estatísticas
            this.updateStats(weightedOEE);

            this.hideLoading();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showError('Erro ao carregar dados. Tente novamente.');
        }
    }

    async getUserMachines() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/auth/maquinas-operador');
            if (response && response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            console.error('Erro ao buscar máquinas:', error);
        }
        return [];
    }

    async calculateHistoricalOEE(maquinas) {
        const historicalData = [];
        const now = new Date();
        const periodDays = this.currentPeriod;
        
        // Calcular OEE para cada dia do período
        for (let i = periodDays - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            // Calcular OEE média para todas as máquinas neste período
            const oeeValues = await Promise.all(
                maquinas.map(maquina => this.calculateOEEForPeriod(maquina, date, endDate))
            );
            
            // Calcular média ponderada (média simples das máquinas)
            const avgOEE = oeeValues.length > 0
                ? oeeValues.reduce((sum, val) => sum + val, 0) / oeeValues.length
                : 0;
            
            historicalData.push({
                date: new Date(date),
                oee: Math.max(0, Math.min(100, avgOEE))
            });
        }
        
        return historicalData;
    }

    async calculateOEEForPeriod(maquina, startDate, endDate) {
        try {
            const machineId = maquina.machineId || maquina._id;
            
            // Buscar dados de produção para o período
            const producaoResponse = await this.makeAuthenticatedRequest(
                `/api/producao?machineId=${encodeURIComponent(machineId)}&period=year`
            );
            
            if (!producaoResponse || !producaoResponse.ok) {
                return 0;
            }
            
            const producaoData = await producaoResponse.json();
            const ciclos = (producaoData.data || []).filter(ciclo => {
                const cicloDate = ciclo.timestamp 
                    ? new Date(ciclo.timestamp)
                    : new Date(ciclo.createdAt || ciclo.created_at);
                return cicloDate >= startDate && cicloDate <= endDate;
            });
            
            // Buscar paradas para o período
            const paradasResponse = await this.makeAuthenticatedRequest(
                `/api/paradas-maquina?machineId=${encodeURIComponent(machineId)}&period=year`
            );
            
            let paradas = [];
            if (paradasResponse && paradasResponse.ok) {
                const paradasData = await paradasResponse.json();
                paradas = (paradasData.data || []).filter(parada => {
                    const paradaDate = parada.timestamp 
                        ? new Date(parada.timestamp)
                        : new Date(parada.createdAt || parada.created_at);
                    return paradaDate >= startDate && paradaDate <= endDate;
                });
            }
            
            // Buscar descartes para o período
            const descartesResponse = await this.makeAuthenticatedRequest(
                `/api/descartes?maquina=${encodeURIComponent(machineId)}&dataInicio=${startDate.toISOString()}&dataFim=${endDate.toISOString()}&limit=1000`
            );
            
            let descartes = [];
            if (descartesResponse && descartesResponse.ok) {
                const descartesData = await descartesResponse.json();
                descartes = descartesData.data || [];
            }
            
            // Calcular componentes do OEE
            const disponibilidade = this.calculateDisponibilidade(startDate, endDate, paradas);
            const performance = this.calculatePerformance(startDate, endDate, ciclos);
            const qualidade = this.calculateQualidade(ciclos, descartes);
            
            // Calcular OEE
            const oee = (disponibilidade * performance * qualidade) / 10000;
            return Math.max(0, Math.min(100, oee));
            
        } catch (error) {
            console.error(`Erro ao calcular OEE para máquina ${maquina.machineId}:`, error);
            return 0;
        }
    }

    calculateDisponibilidade(startDate, endDate, paradas) {
        const totalMinutes = (endDate - startDate) / (1000 * 60);
        
        if (totalMinutes <= 0) return 100;
        
        let totalParadasMinutos = 0;
        paradas.forEach(parada => {
            const paradaInicio = parada.timestampInicio 
                ? new Date(parada.timestampInicio)
                : new Date(parada.createdAt || parada.created_at);
            const paradaFim = parada.timestampFim 
                ? new Date(parada.timestampFim)
                : new Date(parada.timestamp || new Date());
            
            // Só considerar paradas dentro do período
            if (paradaInicio >= startDate && paradaFim <= endDate) {
                const duracaoMinutos = (paradaFim - paradaInicio) / (1000 * 60);
                totalParadasMinutos += Math.max(0, duracaoMinutos);
            }
        });
        
        const tempoRealMinutos = Math.max(0, totalMinutes - totalParadasMinutos);
        const disponibilidade = totalMinutes > 0 ? (tempoRealMinutos / totalMinutes) * 100 : 100;
        
        return Math.max(0, Math.min(100, disponibilidade));
    }

    calculatePerformance(startDate, endDate, ciclos) {
        // Calcular tempo efetivo (descontando paradas aproximadas)
        const totalMinutes = (endDate - startDate) / (1000 * 60);
        const tempoEfetivoMinutos = totalMinutes * 0.9; // Aproximação: 90% do tempo disponível
        
        // Estimar produção teórica (assumindo 1 ciclo por minuto como padrão)
        const producaoTeorica = tempoEfetivoMinutos;
        const producaoReal = ciclos.length;
        
        if (producaoTeorica <= 0) return 0;
        
        const performance = (producaoReal / producaoTeorica) * 100;
        return Math.max(0, Math.min(100, performance));
    }

    calculateQualidade(ciclos, descartes) {
        const totalProducao = ciclos.length;
        
        if (totalProducao === 0) return 0;
        
        // Contar ciclos defeituosos
        const ciclosDefeituosos = ciclos.filter(c => c.isDefective).length;
        const totalDescartes = descartes.length;
        
        const totalDefeituosos = ciclosDefeituosos + totalDescartes;
        const conformes = Math.max(0, totalProducao - totalDefeituosos);
        
        const qualidade = (conformes / totalProducao) * 100;
        return Math.max(0, Math.min(100, qualidade));
    }

    calculateWeightedOEE(historicalData) {
        if (historicalData.length === 0) return 0;
        
        // Média ponderada: pesos maiores para dados mais recentes
        let weightedSum = 0;
        let totalWeight = 0;
        
        historicalData.forEach((data, index) => {
            const weight = index + 1; // Peso crescente para dados mais recentes
            weightedSum += data.oee * weight;
            totalWeight += weight;
        });
        
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    calculateForecast(weightedOEE) {
        const forecast = [];
        const historical = this.historicalOEE;
        
        if (historical.length < 2) {
            // Se não há dados suficientes, usar média simples
            for (let i = 1; i <= this.forecastLength; i++) {
                const futureDate = new Date();
                if (this.forecastType === 'hours') {
                    futureDate.setHours(futureDate.getHours() + i);
                } else if (this.forecastType === 'days') {
                    futureDate.setDate(futureDate.getDate() + i);
                } else if (this.forecastType === 'weeks') {
                    futureDate.setDate(futureDate.getDate() + (i * 7));
                }
                
                forecast.push({
                    date: futureDate,
                    oee: weightedOEE
                });
            }
            return forecast;
        }
        
        // Calcular tendência usando os últimos valores
        const recentValues = historical.slice(-7); // Últimos 7 dias
        const avgRecent = recentValues.reduce((sum, d) => sum + d.oee, 0) / recentValues.length;
        
        // Calcular variação média
        let totalVariation = 0;
        for (let i = 1; i < recentValues.length; i++) {
            totalVariation += recentValues[i].oee - recentValues[i - 1].oee;
        }
        const avgVariation = recentValues.length > 1 ? totalVariation / (recentValues.length - 1) : 0;
        
        // Prever valores futuros com tendência
        for (let i = 1; i <= this.forecastLength; i++) {
            const futureDate = new Date();
            if (this.forecastType === 'hours') {
                futureDate.setHours(futureDate.getHours() + i);
            } else if (this.forecastType === 'days') {
                futureDate.setDate(futureDate.getDate() + i);
            } else if (this.forecastType === 'weeks') {
                futureDate.setDate(futureDate.getDate() + (i * 7));
            }
            
            // Previsão com tendência e decaimento (tendência diminui ao longo do tempo)
            const decayFactor = 1 / (1 + i * 0.1); // Decaimento exponencial
            const predictedOEE = avgRecent + (avgVariation * i * decayFactor);
            
            forecast.push({
                date: futureDate,
                oee: Math.max(0, Math.min(100, predictedOEE))
            });
        }
        
        return forecast;
    }

    renderChart() {
        const ctx = document.getElementById('oeeForecastChart');
        if (!ctx) return;
        
        // Destruir gráfico anterior se existir
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Preparar dados para o gráfico
        const historicalLabels = this.historicalOEE.map(d => this.formatDate(d.date));
        const historicalData = this.historicalOEE.map(d => d.oee);
        
        const forecastLabels = this.forecastOEE.map(d => this.formatDate(d.date));
        const forecastData = this.forecastOEE.map(d => d.oee);
        
        // Combinar labels e dados
        const allLabels = [...historicalLabels, ...forecastLabels];
        const historicalExtended = [...historicalData, ...new Array(forecastData.length).fill(null)];
        const forecastExtended = [...new Array(historicalData.length).fill(null), ...forecastData];
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'OEE Histórica',
                        data: historicalExtended,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Previsão OEE',
                        data: forecastExtended,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'OEE (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Data/Hora'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    formatDate(date) {
        if (this.forecastType === 'hours') {
            return date.toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (this.forecastType === 'days') {
            return date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    updateStats(weightedOEE) {
        const currentOEEEl = document.getElementById('currentOEE');
        const forecastOEEEl = document.getElementById('forecastOEE');
        const trendOEEEl = document.getElementById('trendOEE');
        
        if (currentOEEEl) {
            currentOEEEl.textContent = weightedOEE.toFixed(2) + '%';
        }
        
        if (forecastOEEEl && this.forecastOEE.length > 0) {
            const avgForecast = this.forecastOEE.reduce((sum, d) => sum + d.oee, 0) / this.forecastOEE.length;
            forecastOEEEl.textContent = avgForecast.toFixed(2) + '%';
        }
        
        if (trendOEEEl) {
            const trend = this.calculateTrend();
            trendOEEEl.className = 'stat-value ' + trend.class;
            trendOEEEl.innerHTML = `<i class="fas ${trend.icon}"></i> ${trend.text}`;
        }
    }

    calculateTrend() {
        if (this.historicalOEE.length < 2 || this.forecastOEE.length === 0) {
            return { class: 'stable', icon: 'fa-minus', text: 'Estável' };
        }
        
        const recentAvg = this.historicalOEE.slice(-7).reduce((sum, d) => sum + d.oee, 0) / Math.min(7, this.historicalOEE.length);
        const forecastAvg = this.forecastOEE.reduce((sum, d) => sum + d.oee, 0) / this.forecastOEE.length;
        
        const diff = forecastAvg - recentAvg;
        
        if (diff > 2) {
            return { class: 'up', icon: 'fa-arrow-up', text: 'Aumentando' };
        } else if (diff < -2) {
            return { class: 'down', icon: 'fa-arrow-down', text: 'Diminuindo' };
        } else {
            return { class: 'stable', icon: 'fa-minus', text: 'Estável' };
        }
    }

    showLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        const errorEl = document.getElementById('errorMessage');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (errorEl) errorEl.style.display = 'none';
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingMessage');
        if (loadingEl) loadingEl.style.display = 'none';
    }

    showError(message) {
        const loadingEl = document.getElementById('loadingMessage');
        const errorEl = document.getElementById('errorMessage');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'flex';
            const span = errorEl.querySelector('span');
            if (span) span.textContent = message;
        }
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new PrevisaoOEE();
});

