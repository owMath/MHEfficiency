// JavaScript para página de Análise de Produção
// Logger simples com níveis controláveis via localStorage.LOG_LEVEL (silent, error, warn, info, debug)
const Logger = (() => {
    const levelMap = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const getLevelName = () => (localStorage.getItem('LOG_LEVEL') || 'info').toLowerCase();
    const getLevel = () => levelMap[getLevelName()] ?? levelMap.info;
    const prefix = '[AnaliseProducao]';
    const should = (min) => getLevel() >= min;
    return {
        setLevel: (name) => localStorage.setItem('LOG_LEVEL', name),
        debug: (...args) => { if (should(4)) console.debug(prefix, ...args); },
        info: (...args) => { if (should(3)) console.info(prefix, ...args); },
        warn: (...args) => { if (should(2)) console.warn(prefix, ...args); },
        error: (...args) => { if (should(1)) console.error(prefix, ...args); }
    };
})();
class AnaliseProducao {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.machines = [];
        this.productionData = [];
        this.ordensProducao = [];
        this.chart = null;
        this.productsPieChart = null;
        this.productsBarChart = null;
        // Paginação do histórico
        this.currentHistoryPage = 1;
        this.historyRowsPerPage = 10;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.setupDateFilters();
        this.loadProductionData();
        this.loadOrdensProducao();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
        
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
                this.loadOrdensProducao(); // Atualizar gráficos de produtos
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
                this.loadOrdensProducao(); // Atualizar gráficos de produtos
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
                this.loadProductionDataWithPeriod(e.target.value);
                this.loadOrdensProducao(); // Atualizar gráficos de produtos
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
        const startDate = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000)); // 4 dias atrás
        
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

    // Carregar máquinas da empresa
    async loadMachinesFromProduction() {
        try {
            Logger.info('Carregando lista de máquinas');
            
            // Buscar máquinas cadastradas da API
            const response = await this.makeAuthenticatedRequest('/api/producao/machines');
            
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success && data.data && data.data.length > 0) {
                    // Usar dados da API com nomes reais das máquinas
                    this.machines = data.data.map(machine => ({
                        machineId: machine.machineId,
                        nome: machine.nome || `Máquina ${machine.machineId}`
                    }));
                    Logger.info('Máquinas carregadas da API', { total: this.machines.length });
                    Logger.debug('Detalhes das máquinas', this.machines);
                    this.populateMachineFilter();
                    return true;
                }
            }
            
            // Fallback: usar dados já carregados em this.productionData
            if (this.productionData && this.productionData.length > 0) {
                Logger.warn('Usando fallback: extraindo máquinas dos ciclos de produção');
                
                // Extrair machineId únicos dos ciclos já carregados
                const uniqueMachineIds = [...new Set(this.productionData.map(cycle => cycle.machineId).filter(id => id))];
                Logger.debug('MachineIds únicos encontrados', uniqueMachineIds);
                    
                // Criar estrutura de máquinas baseada nos machineId únicos
                this.machines = uniqueMachineIds.map(machineId => ({
                    machineId: machineId,
                    nome: `Máquina ${machineId}` // Usar o próprio machineId como nome
                }));
                Logger.info('Máquinas definidas via fallback', { total: this.machines.length });
                Logger.debug('Detalhes das máquinas (fallback)', this.machines);
                this.populateMachineFilter();
                return true;
            }
            
            Logger.warn('Nenhuma máquina encontrada');
            return false;
        } catch (error) {
            Logger.error('Erro ao carregar máquinas', error);
            
            // Fallback: tentar extrair dos ciclos de produção se disponível
            if (this.productionData && this.productionData.length > 0) {
                Logger.warn('Usando fallback após erro: extraindo dos ciclos de produção');
                const uniqueMachineIds = [...new Set(this.productionData.map(cycle => cycle.machineId).filter(id => id))];
                
                this.machines = uniqueMachineIds.map(machineId => ({
                    machineId: machineId,
                    nome: `Máquina ${machineId}`
                }));
                Logger.info('Máquinas definidas via fallback', { total: this.machines.length });
                this.populateMachineFilter();
                return true;
            }
        }
        
        return false;
    }

    // Popular filtro de máquinas
    populateMachineFilter() {
        const machineFilter = document.getElementById('machineFilter');
        if (!machineFilter) {
            Logger.error('Elemento machineFilter não encontrado');
            return;
        }

        Logger.info('Populando filtro de máquinas', { total: this.machines.length });
        Logger.debug('Máquinas disponíveis', this.machines);

        // Limpar opções existentes (exceto "Todas as Máquinas")
        while (machineFilter.children.length > 1) {
            machineFilter.removeChild(machineFilter.lastChild);
        }

        // Operadores e empresas agora têm acesso igual ao filtro
        Logger.debug('Habilitando filtro para usuário', { tipo: this.user.tipoUsuario });
        machineFilter.disabled = false;
        machineFilter.title = 'Selecione uma máquina para filtrar os dados';
        
        // Esconder informação do filtro
        this.hideFilterInfo();
        
        // Adicionar opções de máquinas encontradas nos ciclos
        if (this.machines && this.machines.length > 0) {
            this.machines.forEach(machine => {
                Logger.debug('Adicionando máquina ao filtro', machine);
                const option = document.createElement('option');
                option.value = machine.machineId;
                option.textContent = machine.nome;
                machineFilter.appendChild(option);
            });
            Logger.info('Filtro populado', { total: this.machines.length });
        } else {
            Logger.warn('Nenhuma máquina para adicionar ao filtro');
        }
    }

    // Carregar dados de produção
    async loadProductionData() {
        try {
            Logger.info('Carregando dados de produção');
            const response = await fetch('/api/producao/debug');
            
            if (response && response.ok) {
                const data = await response.json();
                Logger.debug('Dados recebidos da API (bruto)', data);
                
                // Verificar se a resposta tem a estrutura esperada
                if (data.success !== undefined) {
                    this.productionData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.productionData = data;
                } else {
                    Logger.error('Formato de dados inesperado', data);
                    this.productionData = [];
                }
                
                Logger.info('Ciclos carregados', { total: this.productionData.length });
                this.showNotification(`Carregados ${this.productionData.length} ciclos com sucesso!`, 'success');
            } else {
                Logger.error('Erro ao carregar dados de produção', { status: response?.status });
                this.productionData = [];
                this.showNotification('Erro ao carregar dados de produção', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao carregar dados de produção', error);
            this.productionData = [];
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
        }

        this.updateAllMetrics();
        this.initializeChart();
        this.currentHistoryPage = 1;
        this.updateHistoryTable();
        
        // Carregar máquinas baseadas nos ciclos após carregar os dados
        setTimeout(() => {
            this.loadMachinesFromProduction();
        }, 100);
    }

    // Atualizar todas as métricas
    updateAllMetrics() {
        this.updateTotalCycles();
        this.updateConformCycles();
        this.updateConformityRate();
    }

    // Atualizar total de ciclos
    updateTotalCycles() {
        const totalCycles = this.productionData.length;
        const totalElement = document.getElementById('totalCycles');
        if (totalElement) {
            totalElement.textContent = totalCycles;
        }
    }

    // Atualizar ciclos conformes
    updateConformCycles() {
        const conformCycles = this.productionData.filter(cycle => !cycle.isDefective).length;
        const conformElement = document.getElementById('conformCycles');
        if (conformElement) {
            conformElement.textContent = conformCycles;
        }
    }

    // Atualizar taxa de conformidade
    updateConformityRate() {
        const totalCycles = this.productionData.length;
        const conformCycles = this.productionData.filter(cycle => !cycle.isDefective).length;
        const rate = totalCycles > 0 ? Math.round((conformCycles / totalCycles) * 100) : 0;
        
        const rateElement = document.getElementById('conformityRate');
        if (rateElement) {
            rateElement.textContent = `${rate}%`;
        }
    }

    // Inicializar gráfico
    initializeChart() {
        // Destruir gráfico existente antes de criar novo
        this.destroyChart();
        
        this.createProductionChart();
    }

    // Destruir gráfico existente
    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    // Criar gráfico de produção (0-1)
    createProductionChart() {
        const ctx = document.getElementById('productionChart');
        if (!ctx) return;

        // Preparar dados para o gráfico
        const chartData = this.prepareChartData();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Dados Produção Un 1',
                    data: chartData.values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return value;
                            }
                        }
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
        if (this.productionData.length === 0) {
            return {
                labels: [],
                values: []
            };
        }

        // Ordenar dados por timestamp
        const sortedData = [...this.productionData].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        const labels = [];
        const values = [];

        sortedData.forEach(cycle => {
            const timestamp = new Date(cycle.timestamp);
            const timeLabel = timestamp.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            labels.push(timeLabel);
            // 0 para defeituoso, 1 para conforme
            values.push(cycle.isDefective ? 0 : 1);
        });

        return { labels, values };
    }

    // Atualizar tabela de histórico com paginação
    updateHistoryTable(period = 'week') {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        // Limpar tabela
        tbody.innerHTML = '';

        if (this.productionData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhum ciclo encontrado</h3>
                        <p>Não há dados de ciclos para o período selecionado.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Calcular paginação
        const totalItems = this.productionData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.historyRowsPerPage));
        if (this.currentHistoryPage > totalPages) this.currentHistoryPage = totalPages;

        const startIndex = (this.currentHistoryPage - 1) * this.historyRowsPerPage;
        const endIndex = startIndex + this.historyRowsPerPage;

        // Adicionar linhas da página atual
        this.productionData.slice(startIndex, endIndex).forEach(cycle => {
            const row = document.createElement('tr');
            
            const timestamp = new Date(cycle.timestamp);
            const dateTime = timestamp.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const status = cycle.isDefective ? 'DEFEITUOSO' : 'CONFORME';
            const statusClass = cycle.isDefective ? 'defeituoso' : 'conforme';
            const efficiency = cycle.isDefective ? '0%' : '100%';

            row.innerHTML = `
                <td>${dateTime}</td>
                <td>${cycle.machineId}</td>
                <td>Produto Padrão</td>
                <td>${cycle.totalPieces || 1}</td>
                <td>N/A</td>
                <td>${efficiency}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
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
            <div class="pagination-info">Página ${current} de ${pages} (${total} ciclos)</div>
            <button class="pagination-btn" data-dir="next" ${current === pages ? 'disabled' : ''}>
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    // Ir para uma página específica no histórico
    goToHistoryPage(page) {
        if (page < 1) return;
        const totalPages = Math.max(1, Math.ceil(this.productionData.length / this.historyRowsPerPage));
        if (page > totalPages) return;
        this.currentHistoryPage = page;
        this.updateHistoryTable();
    }

    // Filtrar por máquina (mantém filtro de período se selecionado)
    filterByMachine(machineId) {
        // Se selecionou "Todas as Máquinas"
        if (machineId === 'all') {
            // Verificar se há filtro de período ativo
            const historyFilter = document.getElementById('historyFilter');
            const selectedPeriod = historyFilter && historyFilter.value ? historyFilter.value : 'week';
            
            if (selectedPeriod) {
                // Manter apenas o filtro de período
                this.loadProductionDataWithPeriod(selectedPeriod);
            } else {
                // Recarregar todos os dados sem filtros
                this.loadProductionData();
            }
            return;
        }

        // Recarregar dados com filtro específico, mantendo período se houver
        this.loadProductionDataWithFilter(machineId);
    }

    // Carregar dados com filtro específico de máquina (mantém filtro de período se selecionado)
    async loadProductionDataWithFilter(machineId) {
        try {
            Logger.info('Filtrando dados por máquina', { machineId });
            
            // Verificar se há filtro de período selecionado
            const historyFilter = document.getElementById('historyFilter');
            const selectedPeriod = historyFilter && historyFilter.value ? historyFilter.value : 'week';
            
            // Usar a API que suporta ambos os filtros
            const url = `/api/producao?period=${selectedPeriod}&machineId=${machineId}`;
            Logger.info('Aplicando filtros combinados', { period: selectedPeriod, machineId });
            
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success !== undefined) {
                    this.productionData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.productionData = data;
                } else {
                    this.productionData = [];
                }
                
                Logger.info('Dados filtrados', { total: this.productionData.length, machineId });
                
                this.updateAllMetrics();
                this.initializeChart();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
                this.showNotification(`Filtrado: ${this.productionData.length} ciclos da máquina ${machineId}`, 'success');
            } else {
                this.showNotification('Erro ao filtrar dados', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao filtrar dados', error);
            this.showNotification('Erro ao filtrar dados', 'error');
        }
    }

    // Aplicar filtros de data
    async applyDateFilters() {
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
        
        try {
            // Sempre recarregar os dados brutos antes de filtrar
            const response = await this.makeAuthenticatedRequest('/api/producao/debug');
            if (response && response.ok) {
                const data = await response.json();
                let allProductionData = [];
                if (data.success !== undefined) {
                    allProductionData = data.data || [];
                } else if (Array.isArray(data)) {
                    allProductionData = data;
                }
                
                // Filtro por máquina (se selecionada)
                const machineFilter = document.getElementById('machineFilter');
                const selectedMachine = machineFilter ? machineFilter.value : 'all';
                let filtered = selectedMachine === 'all' 
                    ? allProductionData 
                    : allProductionData.filter(cycle => cycle.machineId === selectedMachine);
                
                // Filtro por intervalo de datas
                filtered = filtered.filter(cycle => {
                    const cycleDate = new Date(cycle.timestamp);
                    return cycleDate >= start && cycleDate <= end;
                });
                
                this.productionData = filtered;
                this.updateAllMetrics();
                this.initializeChart();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
                this.showNotification(`Filtrado: ${filtered.length} ciclos no período selecionado`, 'success');
            } else {
                this.showNotification('Erro ao aplicar filtros. Tente novamente.', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao aplicar filtros', error);
            this.showNotification('Erro ao aplicar filtros', 'error');
        }
    }

    // Filtrar por intervalo de datas
    filterByDateRange(startDate, endDate) {
        const filteredData = this.productionData.filter(cycle => {
            const cycleDate = new Date(cycle.timestamp);
            return cycleDate >= startDate && cycleDate <= endDate;
        });
        
        this.productionData = filteredData;
        this.updateAllMetrics();
        this.initializeChart();
        this.currentHistoryPage = 1;
        this.updateHistoryTable();
        
        this.showNotification(`Filtrado: ${filteredData.length} ciclos no período selecionado`, 'success');
    }

    // Carregar dados com filtro de período (mantém filtro de máquina se selecionado)
    async loadProductionDataWithPeriod(period) {
        try {
            // Verificar se há filtro de máquina selecionado
            const machineFilter = document.getElementById('machineFilter');
            const selectedMachineId = machineFilter && machineFilter.value !== 'all' ? machineFilter.value : null;
            
            // Construir URL com ambos os filtros se necessário
            let url = `/api/producao?period=${period}`;
            if (selectedMachineId) {
                url += `&machineId=${selectedMachineId}`;
                Logger.info('Aplicando filtros combinados', { period, machineId: selectedMachineId });
            } else {
                Logger.info('Aplicando filtro de período', { period });
            }
            
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success !== undefined) {
                    this.productionData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.productionData = data;
                } else {
                    this.productionData = [];
                }
                
                Logger.info('Dados carregados com filtro de período', { total: this.productionData.length });
                
                this.updateAllMetrics();
                this.initializeChart();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
            } else {
                this.showNotification('Erro ao filtrar por período', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao filtrar por período', error);
            this.showNotification('Erro ao filtrar por período', 'error');
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
            doc.text('Relatório de Análise de Produção', pageWidth / 2, yPosition, { align: 'center' });
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
            doc.text('Métricas Principais:', 20, yPosition);
            yPosition += 8;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const totalCycles = document.getElementById('totalCycles').textContent;
            const conformCycles = document.getElementById('conformCycles').textContent;
            const conformityRate = document.getElementById('conformityRate').textContent;
            
            doc.text(`• Total de Ciclos: ${totalCycles}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• Ciclos Conformes: ${conformCycles}`, 20, yPosition);
            yPosition += 6;
            doc.text(`• Taxa de Conformidade: ${conformityRate}`, 20, yPosition);
            yPosition += 15;
            
            // Tabela de dados
            if (this.productionData.length > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Histórico de Ciclos:', 20, yPosition);
                yPosition += 8;
                
                // Cabeçalho da tabela
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                const tableHeaders = ['Data/Hora', 'Máquina', 'Status', 'Conformidade'];
                const colWidths = [50, 30, 30, 30];
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
                const maxRows = Math.min(this.productionData.length, 25); // Limitar a 25 linhas
                
                for (let i = 0; i < maxRows; i++) {
                    const cycle = this.productionData[i];
                    const timestamp = new Date(cycle.timestamp).toLocaleString('pt-BR');
                    const status = cycle.isDefective ? 'DEFEITUOSO' : 'CONFORME';
                    const conformity = cycle.isDefective ? '0%' : '100%';
                    
                    // Verificar se cabe na página
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    xPosition = 20;
                    doc.text(timestamp.substring(0, 16), xPosition, yPosition);
                    xPosition += colWidths[0];
                    doc.text(cycle.machineId, xPosition, yPosition);
                    xPosition += colWidths[1];
                    doc.text(status, xPosition, yPosition);
                    xPosition += colWidths[2];
                    doc.text(conformity, xPosition, yPosition);
                    
                    yPosition += 5;
                }
                
                if (this.productionData.length > 25) {
                    yPosition += 5;
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'italic');
                    doc.text(`... e mais ${this.productionData.length - 25} ciclos`, 20, yPosition);
                }
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Nenhum dado de produção encontrado para o período selecionado.', 20, yPosition);
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
            const fileName = `relatorio_producao_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showNotification('PDF exportado com sucesso!', 'success');
            
        } catch (error) {
            Logger.error('Erro ao gerar PDF', error);
            this.showNotification('Erro ao gerar PDF. Tente novamente.', 'error');
        }
    }

    // Exportar para CSV
    exportToCSV() {
        if (this.productionData.length === 0) {
            this.showNotification('Nenhum dado para exportar', 'warning');
            return;
        }
        
        const headers = ['Data/Hora', 'Máquina', 'Produto', 'Quantidade', 'Status', 'Conformidade'];
        const csvData = this.productionData.map(cycle => {
            const timestamp = new Date(cycle.timestamp).toLocaleString('pt-BR');
            const status = cycle.isDefective ? 'DEFEITUOSO' : 'CONFORME';
            const conformity = cycle.isDefective ? '0%' : '100%';
            
            return [
                timestamp,
                cycle.machineId,
                'Produto Padrão',
                cycle.totalPieces || 1,
                status,
                conformity
            ];
        });
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `producao_${new Date().toISOString().split('T')[0]}.csv`);
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
            Logger.error('Erro na requisição', error);
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
            return null;
        }
    }

    // Logout
    handleLogout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            this.showNotification('Saindo do sistema...');
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

    // Carregar ordens de produção com filtros
    async loadOrdensProducao() {
        try {
            Logger.info('Carregando ordens de produção');
            
            // Obter filtros atuais
            const machineFilter = document.getElementById('machineFilter');
            const selectedMachine = machineFilter ? machineFilter.value : 'all';
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;

            // Construir query string
            let queryParams = [];
            if (selectedMachine && selectedMachine !== 'all') {
                queryParams.push(`maquina=${encodeURIComponent(selectedMachine)}`);
            }
            // Buscar todas as ordens (sem limite de paginação para os gráficos)
            queryParams.push('limit=1000');

            const url = `/api/ordens-producao${queryParams.length > 0 ? '?' + queryParams.join('&') : ''}`;
            const response = await this.makeAuthenticatedRequest(url);

            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    let ordens = data.data || [];
                    
                    // Filtrar por data se houver filtros de data
                    if (startDate && endDate) {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        
                        ordens = ordens.filter(ordem => {
                            const ordemDate = new Date(ordem.createdAt);
                            return ordemDate >= start && ordemDate <= end;
                        });
                    }

                    this.ordensProducao = ordens;
                    Logger.info('Ordens de produção carregadas', { total: this.ordensProducao.length });
                    
                    this.updateProductsCharts();
                } else {
                    Logger.error('Erro ao carregar ordens de produção', data);
                    this.ordensProducao = [];
                    this.updateProductsCharts();
                }
            } else {
                Logger.error('Erro ao carregar ordens de produção', { status: response?.status });
                this.ordensProducao = [];
                this.updateProductsCharts();
            }
        } catch (error) {
            Logger.error('Erro ao carregar ordens de produção', error);
            this.ordensProducao = [];
            this.updateProductsCharts();
        }
    }

    // Agregar dados de produtos
    aggregateProductsData() {
        if (!this.ordensProducao || this.ordensProducao.length === 0) {
            return {
                labels: [],
                quantities: [],
                colors: []
            };
        }

        // Agrupar por produto
        const productsMap = new Map();

        this.ordensProducao.forEach(ordem => {
            const produto = ordem.produto;
            if (!produto || !produto._id) return;

            const produtoId = produto._id.toString();
            const produtoNome = produto.nomeProduto || produto.codigoProduto || `Produto ${produtoId.substring(0, 8)}`;
            
            if (!productsMap.has(produtoId)) {
                productsMap.set(produtoId, {
                    nome: produtoNome,
                    quantidade: 0,
                    quantidadeProduzida: 0
                });
            }

            const produtoData = productsMap.get(produtoId);
            produtoData.quantidade += ordem.quantidade || 0;
            produtoData.quantidadeProduzida += ordem.quantidadeProduzida || 0;
        });

        // Converter para arrays ordenados por quantidade (decrescente)
        const productsArray = Array.from(productsMap.values())
            .sort((a, b) => b.quantidade - a.quantidade);

        // Gerar cores diferentes para cada produto
        const colors = this.generateColors(productsArray.length);

        return {
            labels: productsArray.map(p => p.nome),
            quantities: productsArray.map(p => p.quantidade),
            quantitiesProduced: productsArray.map(p => p.quantidadeProduzida),
            colors: colors
        };
    }

    // Gerar cores para os gráficos
    generateColors(count) {
        const baseColors = [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
            '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#ef4444'
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }

        return colors;
    }

    // Atualizar gráficos de produtos
    updateProductsCharts() {
        this.updateProductsPieChart();
        this.updateProductsBarChart();
    }

    // Atualizar gráfico de pizza
    updateProductsPieChart() {
        const ctx = document.getElementById('productsPieChart');
        if (!ctx) return;

        // Destruir gráfico existente
        if (this.productsPieChart) {
            this.productsPieChart.destroy();
            this.productsPieChart = null;
        }

        const chartData = this.aggregateProductsData();

        if (chartData.labels.length === 0) {
            // Criar gráfico vazio
            this.productsPieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Sem dados'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            display: true
                        },
                        tooltip: {
                            enabled: false
                        }
                    }
                }
            });
            return;
        }

        this.productsPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Quantidade',
                    data: chartData.quantities,
                    backgroundColor: chartData.colors,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        display: true,
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} unidades (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Atualizar gráfico de barras
    updateProductsBarChart() {
        const ctx = document.getElementById('productsBarChart');
        if (!ctx) return;

        // Destruir gráfico existente
        if (this.productsBarChart) {
            this.productsBarChart.destroy();
            this.productsBarChart = null;
        }

        const chartData = this.aggregateProductsData();

        if (chartData.labels.length === 0) {
            // Criar gráfico vazio
            this.productsBarChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Sem dados'],
                    datasets: [{
                        label: 'Quantidade',
                        data: [0],
                        backgroundColor: ['#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            return;
        }

        this.productsBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Quantidade Total',
                    data: chartData.quantities,
                    backgroundColor: chartData.colors.map(c => c + '80'), // Adicionar transparência
                    borderColor: chartData.colors,
                    borderWidth: 2
                }, {
                    label: 'Quantidade Produzida',
                    data: chartData.quantitiesProduced,
                    backgroundColor: chartData.colors.map(c => c + '40'),
                    borderColor: chartData.colors.map(c => c + 'CC'),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                return `${label}: ${value} unidades`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                return Number.isInteger(value) ? value : '';
                            }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.analiseProducao = new AnaliseProducao();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.analiseProducao) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});
