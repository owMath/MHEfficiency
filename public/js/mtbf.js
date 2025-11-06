// JavaScript para página de MTBF
class MTBFPage {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.machines = [];
        this.stopsData = [];
        this.mtbfData = {};
        this.charts = {};
        this.selectedMachine = 'all';
        this.selectedPeriod = 'month';
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadMachines();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
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
                this.selectedMachine = e.target.value;
                this.loadMTBFData();
            });
        }

        // Filtros de período
        const periodFilter = document.getElementById('periodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', (e) => {
                this.selectedPeriod = e.target.value;
                this.loadMTBFData();
            });
        }

        const chartPeriodFilter = document.getElementById('chartPeriodFilter');
        if (chartPeriodFilter) {
            chartPeriodFilter.addEventListener('change', (e) => {
                this.updateMTBFChart(e.target.value);
            });
        }

        const evolutionPeriodFilter = document.getElementById('evolutionPeriodFilter');
        if (evolutionPeriodFilter) {
            evolutionPeriodFilter.addEventListener('change', (e) => {
                this.updateEvolutionChart(e.target.value);
            });
        }

        const tablePeriodFilter = document.getElementById('tablePeriodFilter');
        if (tablePeriodFilter) {
            tablePeriodFilter.addEventListener('change', (e) => {
                this.updateMTBFTable(e.target.value);
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

    // Carregar máquinas
    async loadMachines() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/paradas-maquina/machines');
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    this.machines = data.data;
                    this.populateMachineFilter();
                }
            }
        } catch (error) {
            console.error('Erro ao carregar máquinas:', error);
        }
        
        // Carregar dados de MTBF após carregar máquinas
        this.loadMTBFData();
    }

    // Popular filtro de máquinas
    populateMachineFilter() {
        const machineFilter = document.getElementById('machineFilter');
        if (!machineFilter) return;

        // Limpar opções existentes (exceto "Todas as Máquinas")
        machineFilter.innerHTML = '<option value="all">Todas as Máquinas</option>';

        // Adicionar máquinas
        this.machines.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.machineId;
            option.textContent = machine.machineId;
            machineFilter.appendChild(option);
        });
    }

    // Carregar dados de paradas e calcular MTBF
    async loadMTBFData() {
        try {
            const machineId = this.selectedMachine !== 'all' ? this.selectedMachine : null;
            const period = this.selectedPeriod;
            
            let url = `/api/paradas-maquina?period=${period}`;
            if (machineId) {
                url += `&machineId=${encodeURIComponent(machineId)}`;
            }

            const response = await this.makeAuthenticatedRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                this.stopsData = data.data || [];
                
                // Calcular MTBF
                this.calculateMTBF();
                this.updateMetrics();
                this.updateMTBFTable(this.selectedPeriod);
            }
        } catch (error) {
            console.error('Erro ao carregar dados de MTBF:', error);
            this.showNotification('Erro ao carregar dados de MTBF', 'error');
        }
    }

    // Calcular MTBF
    calculateMTBF() {
        this.mtbfData = {};
        
        // Agrupar paradas por máquina
        const stopsByMachine = {};
        
        this.stopsData.forEach(stop => {
            const machineId = stop.machineId || 'UNKNOWN';
            if (!stopsByMachine[machineId]) {
                stopsByMachine[machineId] = [];
            }
            stopsByMachine[machineId].push(stop);
        });

        // Calcular MTBF para cada máquina
        Object.keys(stopsByMachine).forEach(machineId => {
            const stops = stopsByMachine[machineId];
            
            // Ordenar paradas por timestamp
            stops.sort((a, b) => {
                const timeA = new Date(a.timestamp || a.createdAt);
                const timeB = new Date(b.timestamp || b.createdAt);
                return timeA - timeB;
            });

            // Calcular tempo total de operação
            // Assumindo que o período começa na primeira parada
            const firstStop = stops[0];
            const lastStop = stops[stops.length - 1];
            
            const startTime = new Date(firstStop.timestamp || firstStop.createdAt);
            const endTime = new Date();
            
            // Tempo total em horas
            const totalTimeHours = (endTime - startTime) / (1000 * 60 * 60);
            
            // Número de falhas
            const numFailures = stops.length;
            
            // MTBF = Tempo Total / Número de Falhas (em horas)
            const mtbf = numFailures > 0 ? totalTimeHours / numFailures : 0;
            
            // Tempo total de parada em horas
            let totalDowntimeHours = 0;
            stops.forEach(stop => {
                const duration = stop.duration_seconds || stop.duration || 0;
                totalDowntimeHours += duration / 3600; // Converter segundos para horas
            });

            // Tempo de operação = Tempo total - Tempo de parada
            const operatingTimeHours = totalTimeHours - totalDowntimeHours;
            const mtbfOperating = numFailures > 0 ? operatingTimeHours / numFailures : 0;

            this.mtbfData[machineId] = {
                mtbf: mtbf,
                mtbfOperating: mtbfOperating,
                numFailures: numFailures,
                totalTimeHours: totalTimeHours,
                operatingTimeHours: operatingTimeHours,
                totalDowntimeHours: totalDowntimeHours,
                lastFailure: lastStop ? new Date(lastStop.timestamp || lastStop.createdAt) : null
            };
        });
    }

    // Atualizar métricas
    updateMetrics() {
        // MTBF Geral (média de todas as máquinas)
        const mtbfValues = Object.values(this.mtbfData).map(d => d.mtbf).filter(v => v > 0);
        const mtbfGeral = mtbfValues.length > 0 
            ? mtbfValues.reduce((a, b) => a + b, 0) / mtbfValues.length 
            : 0;

        document.getElementById('mtbfGeral').textContent = 
            mtbfGeral > 0 ? `${mtbfGeral.toFixed(2)}h` : '--';

        // MTBF da máquina selecionada
        if (this.selectedMachine !== 'all' && this.mtbfData[this.selectedMachine]) {
            const machineData = this.mtbfData[this.selectedMachine];
            document.getElementById('mtbfMaquina').textContent = 
                `${machineData.mtbf.toFixed(2)}h`;
            document.getElementById('machineName').textContent = this.selectedMachine;
        } else {
            document.getElementById('mtbfMaquina').textContent = '--';
            document.getElementById('machineName').textContent = 'Selecione uma máquina';
        }

        // Número de falhas
        const totalFailures = Object.values(this.mtbfData).reduce((sum, d) => sum + d.numFailures, 0);
        document.getElementById('numeroFalhas').textContent = totalFailures;

        // Atualizar gráfico
        this.updateMTBFChart(this.selectedPeriod);
    }

    // Atualizar gráfico de MTBF por máquina
    updateMTBFChart(period) {
        this.loadMTBFDataForPeriod(period).then(() => {
            const canvas = document.getElementById('mtbfPorMaquinaChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            
            // Destruir gráfico anterior se existir
            if (this.charts.mtbfPorMaquina) {
                this.charts.mtbfPorMaquina.destroy();
            }

            const machines = Object.keys(this.mtbfData);
            const mtbfValues = machines.map(m => this.mtbfData[m].mtbf);

            this.charts.mtbfPorMaquina = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: machines,
                    datasets: [{
                        label: 'MTBF (horas)',
                        data: mtbfValues,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'MTBF (horas)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        });
    }

    // Atualizar gráfico de evolução do MTBF
    updateEvolutionChart(period) {
        // Implementação futura para mostrar evolução temporal
        console.log('Evolução do MTBF para período:', period);
    }

    // Carregar dados de MTBF para um período específico
    async loadMTBFDataForPeriod(period) {
        try {
            const url = `/api/paradas-maquina?period=${period}`;
            const response = await this.makeAuthenticatedRequest(url);
            
            if (response && response.ok) {
                const data = await response.json();
                this.stopsData = data.data || [];
                this.calculateMTBF();
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    // Atualizar tabela de MTBF
    async updateMTBFTable(period) {
        await this.loadMTBFDataForPeriod(period);
        
        const tbody = document.getElementById('mtbfTableBody');
        if (!tbody) return;

        if (Object.keys(this.mtbfData).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <i class="fas fa-info-circle"></i>
                            <h3>Nenhum dado disponível</h3>
                            <p>Não há dados de paradas para calcular o MTBF no período selecionado.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        Object.keys(this.mtbfData).forEach(machineId => {
            const data = this.mtbfData[machineId];
            const row = document.createElement('tr');
            
            const statusBadge = data.numFailures === 0 
                ? '<span class="status-badge" style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem;">Excelente</span>'
                : data.mtbf > 100 
                ? '<span class="status-badge" style="background: #dbeafe; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem;">Bom</span>'
                : '<span class="status-badge" style="background: #fef3c7; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem;">Atenção</span>';

            const lastFailureText = data.lastFailure 
                ? new Date(data.lastFailure).toLocaleString('pt-BR')
                : 'N/A';

            row.innerHTML = `
                <td><strong>${machineId}</strong></td>
                <td>${data.mtbf.toFixed(2)}h</td>
                <td>${data.numFailures}</td>
                <td>${data.operatingTimeHours.toFixed(2)}h</td>
                <td>${statusBadge}</td>
                <td>${lastFailureText}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // Função auxiliar para fazer requisições autenticadas
    async makeAuthenticatedRequest(url) {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return null;
        }

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

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

    // Mostrar notificação
    showNotification(message, type = 'info') {
        const statusMessage = document.querySelector('.status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.classList.add('show');
            
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 3000);
        }
    }

    // Atualizar timestamp
    updateTimestamp() {
        const timestamp = document.querySelector('.timestamp');
        if (timestamp) {
            const now = new Date();
            timestamp.textContent = now.toLocaleString('pt-BR');
        }
    }

    // Logout
    handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // Toggle sidebar mobile
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new MTBFPage();
});

