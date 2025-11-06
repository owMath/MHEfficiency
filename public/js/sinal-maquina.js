// JavaScript para página de Sinal da Máquina
class SinalMaquina {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.sensorData = [];
        this.machines = [];
        this.chart = null;
        this.refreshInterval = null;
        this.selectedMachineId = 'all';
        this.selectedPeriod = 'hour';
        // Paginação do histórico
        this.currentHistoryPage = 1;
        this.historyRowsPerPage = 10;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.setupDateFilters();
        this.loadMachinesFromApi();
        this.loadSensorData();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
        
        // Iniciar atualização automática dos dados
        this.startAutoRefresh();
        
        // Adicionar link de aprovação se for empresa
        this.addApprovalLinkIfNeeded();
    }

    // Função para verificar se usuário está logado
    checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = 'login.html';
            return false;
        }
        
        const userData = JSON.parse(user);
        
        // Verificar se operador está pendente
        if (userData.tipoUsuario === 'operador' && userData.status === 'pendente') {
            this.showPendingMessage();
            return false;
        }
        
        // Verificar se usuário está inativo
        if (userData.status === 'inativo') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return false;
        }
        
        return true;
    }

    // Função para mostrar mensagem de pendência
    showPendingMessage() {
        const statusMessage = document.querySelector('.status-message');
        if (statusMessage) {
            statusMessage.innerHTML = `
                <div style="background: #fef3c7; color: #92400e; padding: 1rem; border-radius: 8px; text-align: center;">
                    <i class="fas fa-clock"></i>
                    Sua conta está aguardando aprovação da empresa.
                </div>
            `;
        }
    }

    // Função para carregar dados do usuário
    loadUserData() {
        const userName = document.querySelector('.username');
        
        if (userName && this.user) {
            userName.textContent = this.user.nome;
        }
    }

    setupEventListeners() {
        // Filtro de máquina
        const machineFilter = document.getElementById('machineFilter');
        if (machineFilter) {
            machineFilter.addEventListener('change', (e) => {
                this.filterByMachine(e.target.value);
            });
        }

        // Delegação de eventos para paginação do histórico (evita inline handlers bloqueados por CSP)
        const historyPagination = document.getElementById('historyPagination');
        if (historyPagination) {
            historyPagination.addEventListener('click', (e) => {
                const prevBtn = e.target.closest('button.pagination-btn[data-dir="prev"]');
                const nextBtn = e.target.closest('button.pagination-btn[data-dir="next"]');
                if (prevBtn && !prevBtn.disabled) {
                    this.goToHistoryPage(this.currentHistoryPage - 1);
                } else if (nextBtn && !nextBtn.disabled) {
                    this.goToHistoryPage(this.currentHistoryPage + 1);
                }
            });
        }

        // Botão aplicar filtros
        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.applyDateFilters();
            });
        }

        // Botões de exportação
        const exportPDF = document.getElementById('exportPDF');
        if (exportPDF) {
            exportPDF.addEventListener('click', () => {
                this.exportToPDF();
            });
        }

        const exportCSV = document.getElementById('exportCSV');
        if (exportCSV) {
            exportCSV.addEventListener('click', () => {
                this.exportToCSV();
            });
        }

        // Filtros de período
        const historyFilter = document.getElementById('historyFilter');
        if (historyFilter) {
            historyFilter.addEventListener('change', (e) => {
                this.selectedPeriod = e.target.value;
                this.currentHistoryPage = 1;
                this.loadSensorData();
            });
        }

        // Botão de refresh
        const refreshData = document.getElementById('refreshData');
        if (refreshData) {
            refreshData.addEventListener('click', () => {
                this.loadSensorData();
            });
        }

        // Botão de logout
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }

        // Botão de menu mobile
        const menuToggle = document.querySelector('.menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Fechar sidebar ao clicar fora dela em mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 767) {
                const sidebar = document.querySelector('.sidebar');
                const menuToggle = document.querySelector('.menu-toggle');
                
                if (sidebar && sidebar.classList.contains('open') && 
                    !sidebar.contains(e.target) && 
                    !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    // Configurar filtros de data
    setupDateFilters() {
        const now = new Date();
        const startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 1 dia atrás
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput && endDateInput) {
            startDateInput.value = this.formatDateTimeLocal(startDate);
            endDateInput.value = this.formatDateTimeLocal(now);
        }
    }

    // Formatar data para input datetime-local
    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Carregar máquinas a partir da API (DB)
    async loadMachinesFromApi() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/sensor-data/machines');
            if (response && response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    this.machines = data.data;
                    this.populateMachineFilter();
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar máquinas da API:', error);
        }
    }

    // Popular filtro de máquinas
    populateMachineFilter() {
        const machineFilter = document.getElementById('machineFilter');
        if (!machineFilter) {
            return;
        }

        // Limpar opções existentes (exceto "Todas as Máquinas")
        while (machineFilter.children.length > 1) {
            machineFilter.removeChild(machineFilter.lastChild);
        }

        // Operadores e empresas têm acesso igual ao filtro
        machineFilter.disabled = false;
        machineFilter.title = 'Selecione uma máquina para filtrar os dados';
        
        // Esconder informação do filtro
        this.hideFilterInfo();
        
        // Adicionar opções de máquinas encontradas nos dados de sensor
        if (this.machines && this.machines.length > 0) {
            this.machines.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine.machineId;
                option.textContent = machine.nome;
                machineFilter.appendChild(option);
            });
        }
    }

    // Carregar dados de sensor
    async loadSensorData() {
        try {
            const params = new URLSearchParams();
            if (this.selectedMachineId && this.selectedMachineId !== 'all') {
                params.set('machineId', this.selectedMachineId);
            }
            if (this.selectedPeriod) {
                params.set('period', this.selectedPeriod);
            }
            const url = `/api/sensor-data${params.toString() ? `?${params.toString()}` : ''}`;
            const response = await this.makeAuthenticatedRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                
                // Verificar se a resposta tem a estrutura esperada
                if (data.success !== undefined) {
                    this.sensorData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.sensorData = data;
                } else {
                    console.error('Formato de dados inesperado:', data);
                    this.sensorData = [];
                }
                
                this.showNotification(`Carregados ${this.sensorData.length} registros de sensor com sucesso!`, 'success');
            } else {
                console.error('❌ Erro ao carregar dados de sensor:', response?.status);
                this.sensorData = [];
                this.showNotification('Erro ao carregar dados de sensor', 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados de sensor:', error);
            this.sensorData = [];
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
        }

        this.updateAllMetrics();
        this.initializeChart();
        this.currentHistoryPage = 1;
        this.updateHistoryTable();
        this.updateAlerts();
        
        // Lista de máquinas já é carregada via API
    }

    // Atualizar todas as métricas
    updateAllMetrics() {
        if (this.sensorData.length === 0) {
            this.updateMetricValues();
            return;
        }

        // Pegar o último registro para mostrar valores atuais
        const latestData = this.sensorData[this.sensorData.length - 1];
        this.updateMetricValues(latestData);
    }

    // Atualizar valores das métricas
    updateMetricValues(data = null) {
        if (!data) {
            // Valores padrão quando não há dados
            document.getElementById('connectionStatus').textContent = 'Sem dados';
            document.getElementById('rssiValue').textContent = '-- dBm';
            document.getElementById('snrValue').textContent = '-- dB';
            document.getElementById('latencyValue').textContent = '-- ms';
            document.getElementById('throughputValue').textContent = '-- Mbps';
            document.getElementById('packetLossValue').textContent = '-- %';
            return;
        }

        // Atualizar status da conexão
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            // Status pode estar no nível raiz ou dentro de networkMetrics
            const networkMetrics = data.networkMetrics || {};
            const status = data.status || networkMetrics.status || 'Desconhecido';
            const statusLower = String(status).toLowerCase();
            let statusClass = 'offline';
            
            if (statusLower === 'online') {
                statusClass = 'online';
            } else if (statusLower === 'weak_signal' || statusLower === 'weak signal') {
                statusClass = 'warning';
            }
            
            statusElement.textContent = String(status).toUpperCase();
            statusElement.className = `metric-value ${statusClass}`;
        }

        // Atualizar métricas de rede
        const networkMetrics = data.networkMetrics || {};
        
        document.getElementById('rssiValue').textContent = `${networkMetrics.rssi || '--'} dBm`;
        document.getElementById('snrValue').textContent = `${networkMetrics.snr || '--'} dB`;
        document.getElementById('latencyValue').textContent = `${networkMetrics.latency || '--'} ms`;
        document.getElementById('throughputValue').textContent = `${networkMetrics.throughput || '--'} Mbps`;
        document.getElementById('packetLossValue').textContent = `${networkMetrics.packetLoss || '--'} %`;
    }

    // Inicializar gráfico
    initializeChart() {
        // Destruir gráfico existente antes de criar novo
        this.destroyChart();
        
        this.createNetworkChart();
    }

    // Destruir gráfico existente
    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    // Criar gráfico de rede
    createNetworkChart() {
        const ctx = document.getElementById('networkChart');
        if (!ctx) return;

        // Preparar dados para o gráfico
        const chartData = this.prepareChartData();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'RSSI',
                        data: chartData.rssi,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'SNR',
                        data: chartData.snr,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Latência',
                        data: chartData.latency,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Packet Loss',
                        data: chartData.packetLoss,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        yAxisID: 'y2'
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
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'RSSI/SNR (dB)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Latência (ms)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Packet Loss (%)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Horário'
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

    // Preparar dados para o gráfico
    prepareChartData() {
        if (this.sensorData.length === 0) {
            return {
                labels: [],
                rssi: [],
                snr: [],
                latency: [],
                packetLoss: []
            };
        }

        // Ordenar dados por timestamp
        const sortedData = [...this.sensorData].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        const labels = [];
        const rssi = [];
        const snr = [];
        const latency = [];
        const packetLoss = [];

        sortedData.forEach(data => {
            const timestamp = new Date(data.timestamp);
            const timeLabel = timestamp.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            labels.push(timeLabel);
            
            const networkMetrics = data.networkMetrics || {};
            rssi.push(networkMetrics.rssi || null);
            snr.push(networkMetrics.snr || null);
            latency.push(networkMetrics.latency || null);
            packetLoss.push(networkMetrics.packetLoss || null);
        });

        return { labels, rssi, snr, latency, packetLoss };
    }

    // Atualizar tabela de histórico
    updateHistoryTable(period = 'hour') {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        // Limpar tabela
        tbody.innerHTML = '';

        if (this.sensorData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhum dado de sensor encontrado</h3>
                        <p>Não há dados de sensor para o período selecionado.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Calcular paginação
        const totalItems = this.sensorData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.historyRowsPerPage));
        if (this.currentHistoryPage > totalPages) this.currentHistoryPage = totalPages;

        const startIndex = (this.currentHistoryPage - 1) * this.historyRowsPerPage;
        const endIndex = startIndex + this.historyRowsPerPage;

        // Adicionar linhas da página atual
        this.sensorData.slice(startIndex, endIndex).forEach(data => {
            const row = document.createElement('tr');
            
            const timestamp = new Date(data.timestamp);
            const dateTime = timestamp.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Status pode estar no nível raiz ou dentro de networkMetrics
            const networkMetrics = data.networkMetrics || {};
            const status = data.status || networkMetrics.status || 'Desconhecido';
            // Normalizar status para minúsculas para comparação
            const statusLower = String(status).toLowerCase();
            let statusClass = 'offline'; // padrão
            
            // Classificar status baseado no valor
            if (statusLower === 'online') {
                statusClass = 'online';
            } else if (statusLower === 'weak_signal' || statusLower === 'weak signal') {
                statusClass = 'warning';
            } else if (statusLower === 'offline' || statusLower === 'off') {
                statusClass = 'offline';
            } else {
                statusClass = 'offline'; // qualquer outro status assume offline
            }

            row.innerHTML = `
                <td>${dateTime}</td>
                <td>${data.machineId}</td>
                <td><span class="status-badge ${statusClass}">${String(status).toUpperCase()}</span></td>
                <td>${networkMetrics.rssi || '--'} dBm</td>
                <td>${networkMetrics.snr || '--'} dB</td>
                <td>${networkMetrics.latency || '--'} ms</td>
                <td>${networkMetrics.throughput || '--'} Mbps</td>
                <td>${networkMetrics.packetLoss || '--'} %</td>
            `;
            
            tbody.appendChild(row);
        });

        // Renderizar paginação
        this.renderHistoryPagination({ current: this.currentHistoryPage, pages: totalPages, total: totalItems });
    }

    // Renderizar controles de paginação do histórico
    renderHistoryPagination(pagination) {
        const container = document.getElementById('historyPagination');
        if (!container) return;

        if (!pagination || pagination.pages <= 1) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'flex';
        const { current, pages, total } = pagination;

        container.innerHTML = `
            <button class="pagination-btn" data-dir="prev" ${current === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
                Anterior
            </button>
            <div class="pagination-info">Página ${current} de ${pages} (${total} registros)</div>
            <button class="pagination-btn" data-dir="next" ${current === pages ? 'disabled' : ''}>
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    // Ir para uma página específica no histórico
    goToHistoryPage(page) {
        if (page < 1) return;
        const totalPages = Math.max(1, Math.ceil(this.sensorData.length / this.historyRowsPerPage));
        if (page > totalPages) return;
        this.currentHistoryPage = page;
        this.updateHistoryTable();
    }

    // Atualizar alertas
    updateAlerts() {
        const alertsContainer = document.getElementById('alertsContainer');
        const alertStatus = document.getElementById('alertStatus');
        
        if (!alertsContainer || !alertStatus) return;

        // Limpar alertas existentes
        alertsContainer.innerHTML = '';

        if (this.sensorData.length === 0) {
            alertStatus.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <span>Nenhum dado disponível para análise</span>
            `;
            return;
        }

        const alerts = [];
        const latestData = this.sensorData[this.sensorData.length - 1];
        const networkMetrics = latestData.networkMetrics || {};
        // Status pode estar no nível raiz ou dentro de networkMetrics
        const status = latestData.status || networkMetrics.status || 'unknown';

        // Verificar condições de alerta
        if (networkMetrics.rssi && networkMetrics.rssi < -80) {
            alerts.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                message: `RSSI baixo: ${networkMetrics.rssi} dBm`,
                description: 'Sinal de rede fraco detectado'
            });
        }

        if (networkMetrics.latency && networkMetrics.latency > 100) {
            alerts.push({
                type: 'error',
                icon: 'fas fa-times-circle',
                message: `Latência alta: ${networkMetrics.latency} ms`,
                description: 'Latência de rede acima do normal'
            });
        }

        if (networkMetrics.packetLoss && networkMetrics.packetLoss > 5) {
            alerts.push({
                type: 'error',
                icon: 'fas fa-exclamation-circle',
                message: `Packet Loss alto: ${networkMetrics.packetLoss}%`,
                description: 'Perda de pacotes acima do normal'
            });
        }

        if (status === 'offline' || status === 'off') {
            alerts.push({
                type: 'error',
                icon: 'fas fa-wifi',
                message: 'Máquina offline',
                description: 'Máquina não está conectada'
            });
        }

        // Atualizar status geral
        if (alerts.length === 0) {
            alertStatus.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Todos os sinais estão normais</span>
            `;
            alertStatus.className = 'alert-status normal';
        } else {
            alertStatus.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <span>${alerts.length} alerta(s) detectado(s)</span>
            `;
            alertStatus.className = 'alert-status warning';
        }

        // Adicionar alertas ao container
        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `alert alert-${alert.type}`;
            alertElement.innerHTML = `
                <div class="alert-icon">
                    <i class="${alert.icon}"></i>
                </div>
                <div class="alert-content">
                    <h4>${alert.message}</h4>
                    <p>${alert.description}</p>
                </div>
            `;
            alertsContainer.appendChild(alertElement);
        });
    }

    // Filtrar por máquina
    filterByMachine(machineId) {
        this.selectedMachineId = machineId || 'all';
        this.currentHistoryPage = 1;
        this.loadSensorData();
    }

    // (removido) Filtragem agora ocorre no backend via loadSensorData

    // Aplicar filtros de data
    applyDateFilters() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            this.showNotification('Por favor, selecione as datas inicial e final', 'warning');
            return;
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            this.showNotification('A data inicial deve ser anterior à data final', 'warning');
            return;
        }
        
        this.filterByDateRange(start, end);
    }

    // Filtrar por intervalo de datas (no backend)
    async filterByDateRange(startDate, endDate) {
        try {
            const params = new URLSearchParams();
            params.set('startDate', startDate.toISOString());
            params.set('endDate', endDate.toISOString());
            if (this.selectedMachineId && this.selectedMachineId !== 'all') {
                params.set('machineId', this.selectedMachineId);
            }
            const url = `/api/sensor-data?${params.toString()}`;
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                if (data.success !== undefined) {
                    this.sensorData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.sensorData = data;
                } else {
                    this.sensorData = [];
                }
                this.updateAllMetrics();
                this.initializeChart();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
                this.updateAlerts();
                this.showNotification(`Filtrado: ${this.sensorData.length} registros no período selecionado`, 'success');
            } else {
                this.showNotification('Erro ao aplicar filtros de data', 'error');
            }
        } catch (error) {
            console.error('Erro ao aplicar filtros de data:', error);
            this.showNotification('Erro ao aplicar filtros de data', 'error');
        }
    }

    // Carregar dados com filtro de período
    async loadSensorDataWithPeriod(period) {
        try {
            const response = await this.makeAuthenticatedRequest(`/api/sensor-data?period=${period}`);
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success !== undefined) {
                    this.sensorData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.sensorData = data;
                } else {
                    this.sensorData = [];
                }
                
                this.updateAllMetrics();
                this.initializeChart();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
                this.updateAlerts();
            } else {
                this.showNotification('Erro ao filtrar por período', 'error');
            }
        } catch (error) {
            console.error('Erro ao filtrar por período:', error);
            this.showNotification('Erro ao filtrar por período', 'error');
        }
    }

    // Iniciar atualização automática
    startAutoRefresh() {
        // Atualizar dados a cada 30 segundos
        this.refreshInterval = setInterval(() => {
            this.loadSensorData();
        }, 30000);
    }

    // Parar atualização automática
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Exportar para PDF
    async exportToPDF() {
        try {
            this.showNotification('Gerando PDF...', 'info');
            
            // Criar novo documento PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            // Configurações do PDF
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPosition = 20;
            
            // Título principal
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Relatório de Sinal da Máquina', pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 15;
            
            // Data de geração
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const now = new Date();
            const dateString = now.toLocaleString('pt-BR');
            doc.text(`Gerado em: ${dateString}`, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 20;
            
            // Informações do período
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const machineFilter = document.getElementById('machineFilter').value;
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Período de Análise:', 20, yPosition);
            yPosition += 8;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            if (startDate && endDate) {
                const startFormatted = new Date(startDate).toLocaleDateString('pt-BR');
                const endFormatted = new Date(endDate).toLocaleDateString('pt-BR');
                doc.text(`De: ${startFormatted} até: ${endFormatted}`, 20, yPosition);
            } else {
                doc.text('Período: Últimos dados disponíveis', 20, yPosition);
            }
            yPosition += 8;
            
            if (machineFilter && machineFilter !== 'all') {
                doc.text(`Máquina: ${machineFilter}`, 20, yPosition);
            } else {
                doc.text('Máquina: Todas as máquinas', 20, yPosition);
            }
            yPosition += 15;
            
            // Métricas principais
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Métricas de Rede:', 20, yPosition);
            yPosition += 8;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const connectionStatus = document.getElementById('connectionStatus').textContent;
            const rssiValue = document.getElementById('rssiValue').textContent;
            const snrValue = document.getElementById('snrValue').textContent;
            const latencyValue = document.getElementById('latencyValue').textContent;
            const throughputValue = document.getElementById('throughputValue').textContent;
            const packetLossValue = document.getElementById('packetLossValue').textContent;
            
            doc.text(`• Status da Conexão: ${connectionStatus}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• RSSI: ${rssiValue}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• SNR: ${snrValue}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• Latência: ${latencyValue}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• Throughput: ${throughputValue}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• Packet Loss: ${packetLossValue}`, 20, yPosition);
            yPosition += 15;
            
            // Tabela de dados
            if (this.sensorData.length > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Histórico de Dados de Sensor:', 20, yPosition);
                yPosition += 8;
                
                // Cabeçalho da tabela
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                const tableHeaders = ['Data/Hora', 'Máquina', 'Status', 'RSSI', 'SNR', 'Latência'];
                const colWidths = [40, 25, 20, 20, 20, 25];
                let xPosition = 20;
                
                tableHeaders.forEach((header, index) => {
                    doc.text(header, xPosition, yPosition);
                    xPosition += colWidths[index];
                });
                yPosition += 5;
                
                // Linha separadora
                doc.line(20, yPosition, pageWidth - 20, yPosition);
                yPosition += 3;
                
                // Dados da tabela
                doc.setFont('helvetica', 'normal');
                const maxRows = Math.min(this.sensorData.length, 25); // Limitar a 25 linhas
                
                for (let i = 0; i < maxRows; i++) {
                    const data = this.sensorData[i];
                    const timestamp = new Date(data.timestamp).toLocaleString('pt-BR');
                    const status = data.status || 'Desconhecido';
                    const networkMetrics = data.networkMetrics || {};
                    
                    // Verificar se cabe na página
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    xPosition = 20;
                    doc.text(timestamp.substring(0, 16), xPosition, yPosition);
                    xPosition += colWidths[0];
                    doc.text(data.machineId, xPosition, yPosition);
                    xPosition += colWidths[1];
                    doc.text(status, xPosition, yPosition);
                    xPosition += colWidths[2];
                    doc.text(`${networkMetrics.rssi || '--'}`, xPosition, yPosition);
                    xPosition += colWidths[3];
                    doc.text(`${networkMetrics.snr || '--'}`, xPosition, yPosition);
                    xPosition += colWidths[4];
                    doc.text(`${networkMetrics.latency || '--'}`, xPosition, yPosition);
                    
                    yPosition += 5;
                }
                
                if (this.sensorData.length > 25) {
                    yPosition += 5;
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'italic');
                    doc.text(`... e mais ${this.sensorData.length - 25} registros`, 20, yPosition);
                }
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Nenhum dado de sensor encontrado para o período selecionado.', 20, yPosition);
            }
            
            // Rodapé
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.text('Sistema OEE - MH Efficiency', pageWidth - 20, pageHeight - 10, { align: 'right' });
            }
            
            // Salvar o PDF
            const fileName = `relatorio_sinal_maquina_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showNotification('PDF exportado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showNotification('Erro ao gerar PDF. Tente novamente.', 'error');
        }
    }

    // Exportar para CSV
    exportToCSV() {
        if (this.sensorData.length === 0) {
            this.showNotification('Nenhum dado para exportar', 'warning');
            return;
        }
        
        const headers = ['Data/Hora', 'Máquina', 'Status', 'RSSI', 'SNR', 'Latência', 'Throughput', 'Packet Loss'];
        const csvData = this.sensorData.map(data => {
            const timestamp = new Date(data.timestamp).toLocaleString('pt-BR');
            const networkMetrics = data.networkMetrics || {};
            
            return [
                timestamp,
                data.machineId,
                data.status || 'Desconhecido',
                networkMetrics.rssi || '--',
                networkMetrics.snr || '--',
                networkMetrics.latency || '--',
                networkMetrics.throughput || '--',
                networkMetrics.packetLoss || '--'
            ];
        });
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `sinal_maquina_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Arquivo CSV exportado com sucesso!', 'success');
    }

    // Atualizar timestamp
    updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR');

        const headerRight = document.querySelector('.user-info') || document.querySelector('.main-header');
        if (!headerRight) return;

        let timestampElement = headerRight.querySelector('.timestamp');
        if (!timestampElement) {
            timestampElement = document.createElement('span');
            timestampElement.className = 'timestamp';
            timestampElement.style.cssText = 'font-size: 0.8rem; color: #6b7280; margin-left: 1rem;';
            headerRight.appendChild(timestampElement);
        }

        timestampElement.textContent = `Última atualização: ${timeString}`;
    }

    // Mostrar notificação
    showNotification(message, type = 'success') {
        // Criar elemento de notificação se não existir
        let notification = document.querySelector('.notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 2000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 400px;
                word-wrap: break-word;
            `;
            document.body.appendChild(notification);
        }

        // Definir cor baseada no tipo
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        notification.style.background = colors[type] || colors.success;
        notification.textContent = message;
        notification.style.transform = 'translateX(0)';

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
        }, type === 'error' ? 5000 : 3000);
    }

    // Função para fazer requisições autenticadas
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
                // Token expirado ou inválido
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('Erro na requisição:', error);
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
            return null;
        }
    }

    // Logout
    handleLogout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            this.showNotification('Saindo do sistema...');
            this.stopAutoRefresh();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    }

    // Toggle sidebar
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }

    // Função para adicionar link de aprovação se for empresa
    addApprovalLinkIfNeeded() {
        if (this.user && this.user.tipoUsuario === 'empresa') {
            this.addApprovalLink();
        }
    }

    // Função para adicionar link de aprovação
    addApprovalLink() {
        const navList = document.querySelector('.nav-list');
        if (navList && !navList.querySelector('a[href="aprovacao-operadores.html"]')) {
            const approvalItem = document.createElement('li');
            approvalItem.className = 'nav-item';
            approvalItem.innerHTML = `
                <a href="aprovacao-operadores.html" class="nav-link">
                    <i class="fas fa-user-check"></i>
                    <span>Aprovação de Operadores</span>
                </a>
            `;
            navList.appendChild(approvalItem);
        }
    }

    // Mostrar informação do filtro
    showFilterInfo(message) {
        const filterInfo = document.getElementById('filterInfo');
        const filterInfoText = document.getElementById('filterInfoText');
        
        if (filterInfo && filterInfoText) {
            filterInfoText.textContent = message;
            filterInfo.style.display = 'flex';
        }
    }

    // Esconder informação do filtro
    hideFilterInfo() {
        const filterInfo = document.getElementById('filterInfo');
        
        if (filterInfo) {
            filterInfo.style.display = 'none';
        }
    }
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.sinalMaquina = new SinalMaquina();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.sinalMaquina) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});

// Cleanup quando a página for fechada
window.addEventListener('beforeunload', () => {
    if (window.sinalMaquina) {
        window.sinalMaquina.stopAutoRefresh();
    }
});
