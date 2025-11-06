// JavaScript para página de Paradas de Máquina
class ParadasMaquina {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.machines = [];
        this.stopsData = [];
        this.motivosParada = [];
        this.charts = {};
        // Paginação do histórico
        this.currentHistoryPage = 1;
        this.historyRowsPerPage = 10;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadStopsData(); // Carregar dados (máquinas serão carregadas automaticamente)
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
            });
        }

        // Filtros de período
        const shiftFilter = document.getElementById('shiftFilter');
        if (shiftFilter) {
            shiftFilter.addEventListener('change', (e) => {
                this.updateShiftChart(e.target.value);
            });
        }

        const historyFilter = document.getElementById('historyFilter');
        if (historyFilter) {
            historyFilter.addEventListener('change', (e) => {
                this.loadStopsDataWithPeriod(e.target.value);
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

    // Carregar máquinas da empresa
    async loadMachinesFromStops() {
        try {
            console.log('🔧 Iniciando carregamento de máquinas...');
            
            // Buscar máquinas cadastradas da API
            const response = await this.makeAuthenticatedRequest('/api/paradas-maquina/machines');
            
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success && data.data && data.data.length > 0) {
                    // Usar dados da API com nomes reais das máquinas
                    this.machines = data.data.map(machine => ({
                        machineId: machine.machineId,
                        nome: machine.nome || `Máquina ${machine.machineId}`
                    }));
                    
                    console.log('🔧 Máquinas carregadas da API:', this.machines);
                    this.populateMachineFilter();
                    return true;
                }
            }
            
            // Fallback: usar dados já carregados em this.stopsData
            if (this.stopsData && this.stopsData.length > 0) {
                console.log('📊 Usando fallback: extraindo dos dados de paradas');
                
                // Extrair machineId únicos das paradas já carregadas
                const uniqueMachineIds = [...new Set(this.stopsData.map(stop => stop.machineId).filter(id => id))];
                
                console.log('🔧 MachineIds únicos encontrados:', uniqueMachineIds);
                    
                // Criar estrutura de máquinas baseada nos machineId únicos
                this.machines = uniqueMachineIds.map(machineId => ({
                    machineId: machineId,
                    nome: `Máquina ${machineId}` // Usar o próprio machineId como nome
                }));
                    
                console.log('🔧 Máquinas criadas do fallback:', this.machines);
                this.populateMachineFilter();
                return true;
            }
            
            console.log('⚠️ Nenhuma máquina encontrada');
            return false;
        } catch (error) {
            console.error('❌ Erro ao carregar máquinas:', error);
            
            // Fallback: tentar extrair dos dados de paradas se disponível
            if (this.stopsData && this.stopsData.length > 0) {
                console.log('📊 Usando fallback após erro: extraindo dos dados de paradas');
                const uniqueMachineIds = [...new Set(this.stopsData.map(stop => stop.machineId).filter(id => id))];
                
                this.machines = uniqueMachineIds.map(machineId => ({
                    machineId: machineId,
                    nome: `Máquina ${machineId}`
                }));
                
                console.log('🔧 Máquinas criadas do fallback:', this.machines);
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
            console.error('❌ Elemento machineFilter não encontrado');
            return;
        }

        console.log('🔧 Populando filtro de máquinas...');
        console.log('👤 Tipo de usuário:', this.user.tipoUsuario);
        console.log('🔧 Máquinas disponíveis:', this.machines);

        // Limpar opções existentes (exceto "Todas as Máquinas")
        while (machineFilter.children.length > 1) {
            machineFilter.removeChild(machineFilter.lastChild);
        }

        // Operadores e empresas agora têm acesso igual ao filtro
        console.log('🔧 Habilitando filtro para usuário:', this.user.tipoUsuario);
        machineFilter.disabled = false;
        machineFilter.title = 'Selecione uma máquina para filtrar os dados';
        
        // Esconder informação do filtro
        this.hideFilterInfo();
        
        // Adicionar opções de máquinas encontradas nas paradas
        if (this.machines && this.machines.length > 0) {
            this.machines.forEach(machine => {
                console.log('➕ Adicionando máquina ao filtro:', machine);
                const option = document.createElement('option');
                option.value = machine.machineId;
                option.textContent = machine.nome;
                machineFilter.appendChild(option);
            });
            console.log('✅ Filtro populado com', this.machines.length, 'máquinas');
        } else {
            console.log('⚠️ Nenhuma máquina encontrada para adicionar ao filtro');
        }
    }

    // Carregar dados de paradas
    async loadStopsData() {
        try {
            console.log('🔍 Tentando carregar dados de paradas...');
            // Usar rota de debug que funciona
            const response = await fetch('/api/paradas-maquina/debug');
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('✅ Dados recebidos da API:', data);
                
                // Verificar se a resposta tem a estrutura esperada
                if (data.success !== undefined) {
                    // Se é uma resposta com estrutura {success: true, data: [...]}
                    this.stopsData = data.data || [];
                } else if (Array.isArray(data)) {
                    // Se é um array direto
                    this.stopsData = data;
                } else {
                    console.error('Formato de dados inesperado:', data);
                    this.stopsData = [];
                }
                
                console.log('📊 Paradas carregadas:', this.stopsData.length);
                this.showNotification(`Carregadas ${this.stopsData.length} paradas com sucesso!`, 'success');
            } else {
                console.error('❌ Erro ao carregar dados de paradas:', response?.status);
                this.stopsData = [];
                this.showNotification('Erro ao carregar dados de paradas', 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados de paradas:', error);
            this.stopsData = [];
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
        }

        this.updateAllMetrics();
        this.initializeCharts();
        this.currentHistoryPage = 1;
        this.updateHistoryTable();
        
        // Carregar máquinas baseadas nas paradas após carregar os dados
        // Usar setTimeout para garantir que os dados estejam disponíveis
        setTimeout(() => {
            this.loadMachinesFromStops();
        }, 100);
    }

    // Atualizar todas as métricas
    updateAllMetrics() {
        this.updateTotalStops();
        this.updateTotalDowntime();
        this.updateLongestStop();
    }

    // Atualizar total de paradas
    updateTotalStops() {
        const totalStops = this.stopsData.length;
        const totalElement = document.getElementById('totalStops');
        if (totalElement) {
            totalElement.textContent = totalStops;
        }
    }

    // Atualizar tempo total parado
    updateTotalDowntime() {
        const totalSeconds = this.stopsData.reduce((sum, stop) => {
            // Usar duration_seconds se disponível, senão duration
            const duration = stop.duration_seconds || stop.duration || 0;
            return sum + duration;
        }, 0);
        
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const downtimeElement = document.getElementById('totalDowntime');
        if (downtimeElement) {
            if (minutes > 0) {
                downtimeElement.textContent = `${minutes}m ${seconds}s`;
            } else {
                downtimeElement.textContent = `${seconds}s`;
            }
        }
    }

    // Atualizar parada mais longa
    updateLongestStop() {
        if (this.stopsData.length === 0) {
            const longestElement = document.getElementById('longestStop');
            if (longestElement) {
                longestElement.textContent = '0s';
            }
            return;
        }
        
        const longestDuration = Math.max(...this.stopsData.map(stop => {
            // Usar duration_seconds se disponível, senão duration
            return stop.duration_seconds || stop.duration || 0;
        }));
        
        const minutes = Math.floor(longestDuration / 60);
        const seconds = longestDuration % 60;
        
        const longestElement = document.getElementById('longestStop');
        if (longestElement) {
            if (minutes > 0) {
                longestElement.textContent = `${minutes}m ${seconds}s`;
            } else {
                longestElement.textContent = `${seconds}s`;
            }
        }
    }

    // Inicializar gráficos
    initializeCharts() {
        // Destruir gráficos existentes antes de criar novos
        this.destroyCharts();
        
        this.createStopsChart();
        this.createReasonChart();
        this.createShiftChart();
    }

    // Destruir gráficos existentes
    destroyCharts() {
        Object.keys(this.charts).forEach(chartKey => {
            if (this.charts[chartKey]) {
                this.charts[chartKey].destroy();
                this.charts[chartKey] = null;
            }
        });
    }

    // Criar gráfico de paradas por dia
    createStopsChart() {
        const ctx = document.getElementById('stopsChart');
        if (!ctx) return;

        // Agrupar paradas por dia da semana
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const stopsByDay = {};
        
        daysOfWeek.forEach(day => {
            stopsByDay[day] = 0;
        });

        this.stopsData.forEach(stop => {
            // Converter timestamp para Date se for string
            const timestamp = typeof stop.timestamp === 'string' ? new Date(stop.timestamp) : stop.timestamp;
            const dayOfWeek = daysOfWeek[timestamp.getDay()];
            stopsByDay[dayOfWeek]++;
        });

        this.charts.stops = new Chart(ctx, {
            type: 'line',
            data: {
                labels: daysOfWeek,
                datasets: [{
                    label: 'Paradas',
                    data: Object.values(stopsByDay),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
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
                        ticks: {
                            stepSize: 10
                        }
                    }
                }
            }
        });
    }

    // Criar gráfico de distribuição por motivo
    createReasonChart() {
        const ctx = document.getElementById('reasonChart');
        if (!ctx) return;

        // Agrupar por motivo - priorizar motivo estruturado, depois texto livre
        const reasonCounts = {};
        this.stopsData.forEach(stop => {
            let motivoKey = '';
            
            // Se tem motivo estruturado, usar ele
            if (stop.motivoParada && stop.motivoParada.nome) {
                motivoKey = stop.motivoParada.nome;
            } else if (stop.reason && stop.reason.trim() !== '') {
                // Senão, usar o texto livre se existir
                motivoKey = stop.reason;
            } else if (!stop.classified) {
                // Apenas marcar como não classificada se realmente não estiver classificada
                motivoKey = 'Não Classificada';
            } else {
                // Se está classificada mas não tem motivo claro, usar um label genérico
                motivoKey = 'Motivo não especificado';
            }
            
            reasonCounts[motivoKey] = (reasonCounts[motivoKey] || 0) + 1;
        });

        const labels = Object.keys(reasonCounts);
        const data = Object.values(reasonCounts);
        
        // Usar cores dos motivos estruturados quando disponível, senão cores padrão
        const colors = [];
        labels.forEach(label => {
            const stop = this.stopsData.find(s => 
                (s.motivoParada && s.motivoParada.nome === label) || 
                (s.reason === label && !s.motivoParada)
            );
            
            if (stop && stop.motivoParada && stop.motivoParada.cor) {
                colors.push(stop.motivoParada.cor);
            } else {
                // Cores padrão para motivos não estruturados
                const defaultColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
                colors.push(defaultColors[colors.length % defaultColors.length]);
            }
        });

        this.charts.reason = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    // Criar gráfico de paradas por turno
    createShiftChart() {
        const ctx = document.getElementById('shiftChart');
        if (!ctx) return;

        // Definir turnos
        const shifts = [
            { name: '1º Turno (6h-14h)', start: 6, end: 14 },
            { name: '2º Turno (14h-22h)', start: 14, end: 22 },
            { name: '3º Turno (22h-6h)', start: 22, end: 6 }
        ];

        const shiftCounts = {};
        shifts.forEach(shift => {
            shiftCounts[shift.name] = 0;
        });

        this.stopsData.forEach(stop => {
            // Converter timestamp para Date se for string
            const timestamp = typeof stop.timestamp === 'string' ? new Date(stop.timestamp) : stop.timestamp;
            const hour = timestamp.getHours();
            shifts.forEach(shift => {
                if (shift.start < shift.end) {
                    // Turno normal (ex: 6h-14h)
                    if (hour >= shift.start && hour < shift.end) {
                        shiftCounts[shift.name]++;
                    }
                } else {
                    // Turno que cruza meia-noite (ex: 22h-6h)
                    if (hour >= shift.start || hour < shift.end) {
                        shiftCounts[shift.name]++;
                    }
                }
            });
        });

        const colors = ['#ef4444', '#f59e0b', '#3b82f6'];

        this.charts.shift = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: shifts.map(s => s.name),
                datasets: [{
                    label: 'Paradas',
                    data: Object.values(shiftCounts),
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
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
                        ticks: {
                            stepSize: 5
                        }
                    }
                }
            }
        });
    }

    // Atualizar tabela de histórico com paginação
    updateHistoryTable(period = 'week') {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        // Limpar tabela
        tbody.innerHTML = '';

        if (this.stopsData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhuma parada encontrada</h3>
                        <p>Não há dados de paradas para o período selecionado.</p>
                    </td>
                </tr>
            `;
            // Renderizar paginação vazia
            this.renderHistoryPagination(null);
            return;
        }

        // Calcular paginação
        const totalItems = this.stopsData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.historyRowsPerPage));
        if (this.currentHistoryPage > totalPages) this.currentHistoryPage = totalPages;

        const startIndex = (this.currentHistoryPage - 1) * this.historyRowsPerPage;
        const endIndex = startIndex + this.historyRowsPerPage;

        // Adicionar linhas da página atual
        this.stopsData.slice(startIndex, endIndex).forEach(stop => {
            const row = document.createElement('tr');
            
            // Converter timestamp para Date se for string
            const timestamp = typeof stop.timestamp === 'string' ? new Date(stop.timestamp) : stop.timestamp;
            const dateTime = timestamp.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Usar duration_seconds se disponível, senão duration
            const durationSeconds = stop.duration_seconds || stop.duration || 0;
            const duration = durationSeconds >= 60 
                ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
                : `${durationSeconds}s`;

            // Normalizar status para maiúsculas
            let status = stop.status || (stop.classified ? 'CLASSIFICADA' : 'NÃO CLASSIFICADA');
            if (status === 'Classificada') status = 'CLASSIFICADA';
            if (status === 'Não Classificada') status = 'NÃO CLASSIFICADA';
            
            const statusClass = status === 'CLASSIFICADA' ? 'classificada' : 'nao-classificada';

            // Obter nome do operador que editou a parada
            const operatorName = stop.editedBy ? stop.editedBy.name || stop.editedBy : stop.operator || 'N/A';

            // Obter motivo de parada
            let motivoText = stop.reason || 'Não especificado';
            if (stop.motivoParada && stop.motivoParada.nome) {
                motivoText = `${stop.motivoParada.nome}${stop.reason ? ' - ' + stop.reason : ''}`;
            }

            row.innerHTML = `
                <td>${dateTime}</td>
                <td>${stop.machineId}</td>
                <td>${motivoText}</td>
                <td>${duration}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${operatorName}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-stop-id="${stop._id}" title="Editar Motivo">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="btn-action btn-delete" data-stop-id="${stop._id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });

        // Renderizar paginação
        this.renderHistoryPagination({ current: this.currentHistoryPage, pages: totalPages, total: totalItems });

        // Adicionar event listeners para os botões de ação
        this.addActionButtonListeners();
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
            <div class="pagination-info">Página ${current} de ${pages} (${total} paradas)</div>
            <button class="pagination-btn" data-dir="next" ${current === pages ? 'disabled' : ''}>
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    // Ir para uma página específica no histórico
    goToHistoryPage(page) {
        if (page < 1) return;
        const totalPages = Math.max(1, Math.ceil(this.stopsData.length / this.historyRowsPerPage));
        if (page > totalPages) return;
        this.currentHistoryPage = page;
        this.updateHistoryTable();
    }

    // Adicionar event listeners para botões de ação
    addActionButtonListeners() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        // Event listener para botões de editar
        tbody.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit')) {
                const button = e.target.closest('.btn-edit');
                const stopId = button.getAttribute('data-stop-id');
                if (stopId) {
                    this.editStop(stopId);
                }
            }
            
            if (e.target.closest('.btn-delete')) {
                const button = e.target.closest('.btn-delete');
                const stopId = button.getAttribute('data-stop-id');
                if (stopId) {
                    this.deleteStop(stopId);
                }
            }
        });
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
                this.loadStopsDataWithPeriod(selectedPeriod);
            } else {
                // Recarregar todos os dados sem filtros
                this.loadStopsData();
            }
            return;
        }

        // Recarregar dados com filtro específico, mantendo período se houver
        this.loadStopsDataWithFilter(machineId);
    }

    // Carregar dados com filtro específico de máquina (mantém filtro de período se selecionado)
    async loadStopsDataWithFilter(machineId) {
        try {
            console.log('🔍 Filtrando dados para máquina:', machineId);
            
            // Verificar se há filtro de período selecionado
            const historyFilter = document.getElementById('historyFilter');
            const selectedPeriod = historyFilter && historyFilter.value ? historyFilter.value : 'week';
            
            // Usar a API que suporta ambos os filtros
            const url = `/api/paradas-maquina?period=${selectedPeriod}&machineId=${machineId}`;
            console.log('🔍 Aplicando filtros combinados - Período:', selectedPeriod, 'Máquina:', machineId);
            
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                
                // Verificar se a resposta tem a estrutura esperada
                if (data.success !== undefined) {
                    this.stopsData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.stopsData = data;
                } else {
                    this.stopsData = [];
                }
                
                console.log('✅ Dados filtrados:', this.stopsData.length, 'paradas para máquina', machineId);
                
                this.updateAllMetrics();
                this.initializeCharts();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
                this.showNotification(`Filtrado: ${this.stopsData.length} paradas da máquina ${machineId}`, 'success');
            } else {
                this.showNotification('Erro ao filtrar dados', 'error');
            }
        } catch (error) {
            console.error('Erro ao filtrar dados:', error);
            this.showNotification('Erro ao filtrar dados', 'error');
        }
    }

    // Atualizar gráfico de turnos
    updateShiftChart(period) {
        // Recarregar dados com filtro de período, mantendo o filtro de máquina se houver
        this.loadStopsDataWithPeriod(period);
    }

    // Carregar dados com filtro de período (mantém filtro de máquina se selecionado)
    async loadStopsDataWithPeriod(period) {
        try {
            // Verificar se há filtro de máquina selecionado
            const machineFilter = document.getElementById('machineFilter');
            const selectedMachineId = machineFilter && machineFilter.value !== 'all' ? machineFilter.value : null;
            
            // Construir URL com ambos os filtros se necessário
            let url = `/api/paradas-maquina?period=${period}`;
            if (selectedMachineId) {
                url += `&machineId=${selectedMachineId}`;
                console.log('🔍 Aplicando filtros combinados - Período:', period, 'Máquina:', selectedMachineId);
            } else {
                console.log('🔍 Aplicando filtro de período:', period);
            }
            
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                
                // Verificar se a resposta tem a estrutura esperada
                if (data.success !== undefined) {
                    this.stopsData = data.data || [];
                } else if (Array.isArray(data)) {
                    this.stopsData = data;
                } else {
                    this.stopsData = [];
                }
                
                console.log('✅ Dados carregados com filtro de período:', this.stopsData.length, 'paradas');
                
                this.updateAllMetrics();
                this.initializeCharts();
                this.currentHistoryPage = 1;
                this.updateHistoryTable();
            } else {
                this.showNotification('Erro ao filtrar por período', 'error');
            }
        } catch (error) {
            console.error('Erro ao filtrar por período:', error);
            this.showNotification('Erro ao filtrar por período', 'error');
        }
    }

    // Classificar parada
    async classifyStop(stopId) {
        try {
            const response = await this.makeAuthenticatedRequest('/api/paradas-maquina/classify', {
                method: 'POST',
                body: JSON.stringify({
                    stopId: stopId,
                    reason: 'Classificado pelo usuário',
                    operator: this.user.nome
                })
            });

            if (response && response.ok) {
                const result = await response.json();
                // Atualizar dados locais
                const stop = this.stopsData.find(s => s._id === stopId);
                if (stop) {
                    stop.classified = true;
                    stop.operator = this.user.nome;
                }
                this.updateHistoryTable();
                this.showNotification('Parada classificada com sucesso!');
            } else {
                this.showNotification('Erro ao classificar parada', 'error');
            }
        } catch (error) {
            console.error('Erro ao classificar parada:', error);
            this.showNotification('Erro ao classificar parada', 'error');
        }
    }

    // Editar parada
    async editStop(stopId) {
        const stop = this.stopsData.find(s => s._id === stopId);
        if (stop) {
            // Carregar motivos de parada disponíveis
            await this.loadMotivosParada();
            this.showEditModal(stop);
        }
    }

    // Carregar motivos de parada
    async loadMotivosParada() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/motivos-parada');
            if (response && response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    this.motivosParada = data.data;
                    console.log('✅ Motivos de parada carregados:', this.motivosParada.length);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar motivos de parada:', error);
            this.motivosParada = [];
        }
    }

    // Mostrar modal de edição
    showEditModal(stop) {
        // Criar modal se não existir
        let modal = document.getElementById('editStopModal');
        if (!modal) {
            modal = this.createEditModal();
        }

        // Preencher dados do modal
        document.getElementById('editStopId').value = stop._id;
        document.getElementById('editStopMachine').value = stop.machineId;
        document.getElementById('editStopReason').value = stop.reason || '';
        document.getElementById('editStopDuration').value = stop.duration_seconds || stop.duration || 0;
        document.getElementById('editStopOperator').value = stop.operator || '';

        // Preencher dropdown de motivos
        const motivoSelect = document.getElementById('editStopMotivo');
        motivoSelect.innerHTML = '<option value="">Selecione um motivo</option>';
        
        this.motivosParada.forEach(motivo => {
            const option = document.createElement('option');
            option.value = motivo._id;
            option.textContent = `${motivo.nome} (${this.getClasseLabel(motivo.classe)})`;
            if (stop.motivoParada && stop.motivoParada._id === motivo._id) {
                option.selected = true;
            }
            motivoSelect.appendChild(option);
        });

        // Mostrar modal
        modal.style.display = 'flex';
    }

    // Criar modal de edição
    createEditModal() {
        const modal = document.createElement('div');
        modal.id = 'editStopModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Editar Parada de Máquina</h3>
                    <button class="modal-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="editStopForm">
                        <input type="hidden" id="editStopId">
                        
                        <div class="form-group">
                            <label for="editStopMachine">Máquina</label>
                            <input type="text" id="editStopMachine" readonly>
                        </div>
                        
                        <div class="form-group">
                            <label for="editStopMotivo">Classe de Parada *</label>
                            <select id="editStopMotivo" name="motivoParada" required>
                                <option value="">Selecione um motivo</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="editStopReason">Motivo (Texto Livre)</label>
                            <input type="text" id="editStopReason" name="reason" placeholder="Descrição adicional do motivo">
                        </div>
                        
                        <div class="form-group">
                            <label for="editStopDuration">Duração (segundos)</label>
                            <input type="number" id="editStopDuration" name="duration_seconds" min="1" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="editStopOperator">Operador</label>
                            <input type="text" id="editStopOperator" name="operator">
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" data-action="close-modal">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adicionar event listener para o formulário
        document.getElementById('editStopForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStopEdit();
        });
        
        // Adicionar event listeners para botões de fechar
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="close-modal"]')) {
                this.closeEditModal();
            }
        });
        
        return modal;
    }

    // Fechar modal de edição
    closeEditModal() {
        const modal = document.getElementById('editStopModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Salvar edição da parada
    async saveStopEdit() {
        try {
            const formData = new FormData(document.getElementById('editStopForm'));
            const stopId = document.getElementById('editStopId').value;
            
            const updateData = {
                motivoParada: formData.get('motivoParada') || null,
                reason: formData.get('reason') || '',
                duration_seconds: parseInt(formData.get('duration_seconds')),
                operator: formData.get('operator') || ''
            };

            const response = await this.makeAuthenticatedRequest(`/api/paradas-maquina/${stopId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            if (response && response.ok) {
                this.showNotification('Parada atualizada com sucesso!', 'success');
                this.closeEditModal();
                // Recarregar dados e atualizar gráficos
                await this.loadStopsData();
                this.updateAllMetrics();
                this.initializeCharts();
                this.updateHistoryTable();
            } else {
                const errorData = await response.json();
                this.showNotification(errorData.message || 'Erro ao atualizar parada', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            this.showNotification('Erro ao atualizar parada', 'error');
        }
    }

    // Excluir parada
    async deleteStop(stopId) {
        const stop = this.stopsData.find(s => s._id === stopId);
        if (!stop) {
            this.showNotification('Parada não encontrada', 'error');
            return;
        }

        // Confirmar exclusão
        const confirmMessage = `Tem certeza que deseja excluir esta parada?\n\nMáquina: ${stop.machineId}\nMotivo: ${stop.reason}\nDuração: ${stop.duration_seconds || stop.duration || 0}s`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await this.makeAuthenticatedRequest(`/api/paradas-maquina/${stopId}`, {
                method: 'DELETE'
            });

            if (response && response.ok) {
                this.showNotification('Parada excluída com sucesso!', 'success');
                this.loadStopsData(); // Recarregar dados
            } else {
                const errorData = await response.json();
                this.showNotification(errorData.message || 'Erro ao excluir parada', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir parada:', error);
            this.showNotification('Erro ao excluir parada', 'error');
        }
    }

    // Obter label da classe
    getClasseLabel(classe) {
        const labels = {
            equipamento: 'Equipamento',
            processo: 'Processo',
            operacional: 'Operacional',
            organizacional: 'Organizacional'
        };
        return labels[classe] || classe;
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
    window.paradasMaquina = new ParadasMaquina();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.paradasMaquina) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});
