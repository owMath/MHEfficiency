// JavaScript para página de Máquinas
class MaquinasPage {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.machines = [];
        this.filteredMachines = [];
        this.ordensAtivas = new Map(); // Armazena ordens ativas por machineId
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
        const user = JSON.parse(localStorage.getItem('user'));
        const userName = document.querySelector('.username');
        
        if (userName && user) {
            userName.textContent = user.nome;
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        // Busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMachines(e.target.value);
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

    // Carregar máquinas da API
    async loadMachines() {
        const loadingState = document.getElementById('loadingState');
        const machinesGrid = document.getElementById('machinesGrid');
        const emptyState = document.getElementById('emptyState');

        try {
            // Mostrar loading
            if (loadingState) loadingState.style.display = 'flex';
            if (machinesGrid) machinesGrid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'none';

            const response = await this.makeAuthenticatedRequest('/api/paradas-maquina/machines');
            
            if (!response || !response.ok) {
                throw new Error('Erro ao carregar máquinas');
            }

            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                this.machines = data.data;
                this.filteredMachines = [...this.machines];
                // Carregar ordens ativas para determinar status das máquinas
                await this.loadOrdensAtivas();
                this.renderMachines();
                // Iniciar atualização periódica do status (apenas uma vez)
                this.startStatusUpdateInterval();
            } else {
                this.machines = [];
                this.filteredMachines = [];
                this.showEmptyState();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar máquinas:', error);
            this.showError('Erro ao carregar máquinas. Tente novamente.');
            this.showEmptyState();
        } finally {
            if (loadingState) loadingState.style.display = 'none';
        }
    }

    // Filtrar máquinas baseado na busca
    filterMachines(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.filteredMachines = [...this.machines];
        } else {
            this.filteredMachines = this.machines.filter(machine => {
                const machineId = (machine.machineId || '').toLowerCase();
                const nome = (machine.nome || machine.configuracoes?.nome || '').toLowerCase();
                return machineId.includes(term) || nome.includes(term);
            });
        }
        
        this.renderMachines();
    }

    // Renderizar máquinas no grid
    renderMachines() {
        const machinesGrid = document.getElementById('machinesGrid');
        const emptyState = document.getElementById('emptyState');

        if (!machinesGrid) return;

        if (this.filteredMachines.length === 0) {
            machinesGrid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        machinesGrid.innerHTML = this.filteredMachines.map(machine => {
            const machineId = machine.machineId || 'N/A';
            const nome = machine.nome || machine.configuracoes?.nome || `Máquina ${machineId}`;
            const tipo = machine.configuracoes?.tipo || machine.tipo || 'simulador';
            const status = this.determineMachineStatus(machine);

            return `
                <div class="machine-card" data-machine-id="${machineId}">
                    <div class="machine-header">
                        <div class="machine-title">
                            <h3 class="machine-id">${nome}</h3>
                            <p class="machine-type">${this.getMachineTypeLabel(tipo)}</p>
                        </div>
                        <div class="machine-status">
                            <span class="status-badge ${status}">${this.getStatusLabel(status)}</span>
                        </div>
                    </div>
                    <div class="machine-metrics">
                        <div class="metric">
                            <span class="metric-label">OEE</span>
                            <span class="metric-value" data-metric="oee">0.0%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Disponibilidade</span>
                            <span class="metric-value" data-metric="disponibilidade">0.0%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Performance</span>
                            <span class="metric-value" data-metric="performance">0.0%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Qualidade</span>
                            <span class="metric-value" data-metric="qualidade">0.0%</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Carregar métricas para cada máquina
        this.filteredMachines.forEach(machine => {
            this.loadMachineMetrics(machine.machineId);
        });
    }
    
    // Iniciar atualização periódica do status
    startStatusUpdateInterval() {
        // Limpar intervalo anterior se existir
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        // Atualizar status e métricas a cada 30 segundos
        this.statusUpdateInterval = setInterval(async () => {
            await this.loadOrdensAtivas();
            this.renderMachines();
            // Atualizar métricas para todas as máquinas
            this.machines.forEach(machine => {
                this.loadMachineMetrics(machine.machineId);
            });
        }, 30000); // 30 segundos
    }

    // Carregar ordens de produção ativas para todas as máquinas
    async loadOrdensAtivas() {
        try {
            this.ordensAtivas.clear();
            
            // Buscar ordens ativas para cada máquina em paralelo
            const promises = this.machines.map(async (machine) => {
                try {
                    const response = await this.makeAuthenticatedRequest(
                        `/api/ordens-producao?maquina=${machine.machineId}&status=em-producao`
                    );
                    
                    if (response && response.ok) {
                        const data = await response.json();
                        const ordens = data.data || [];
                        if (ordens.length > 0) {
                            // Se houver pelo menos uma ordem em produção, a máquina está online
                            this.ordensAtivas.set(machine.machineId, ordens[0]);
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao verificar ordem para máquina ${machine.machineId}:`, error);
                }
            });
            
            await Promise.all(promises);
        } catch (error) {
            console.error('Erro ao carregar ordens ativas:', error);
        }
    }

    // Determinar status da máquina
    determineMachineStatus(machine) {
        const machineId = machine.machineId;
        
        // Se houver ordem de produção ativa, a máquina está online
        if (this.ordensAtivas.has(machineId)) {
            return 'online';
        }
        
        // Caso contrário, usar configuração manual se existir
        if (machine.configuracoes?.status === 'ativo') {
            return 'online';
        } else if (machine.configuracoes?.status === 'inativo') {
            return 'offline';
        } else if (machine.configuracoes?.status === 'manutencao') {
            return 'warning';
        }
        
        // Por padrão, considerar como offline se não houver ordem ativa
        return 'offline';
    }

    // Obter label do tipo da máquina
    getMachineTypeLabel(tipo) {
        const tipos = {
            'simulador': 'Simulador',
            'real': 'Máquina Real',
            'producao': 'Produção'
        };
        return tipos[tipo] || 'Produção';
    }

    // Obter label do status
    getStatusLabel(status) {
        const labels = {
            'online': 'Online',
            'offline': 'Offline',
            'warning': 'Atenção',
            'unknown': 'Desconhecido'
        };
        return labels[status] || 'Desconhecido';
    }

    // Carregar métricas da máquina (OEE, Disponibilidade, Performance, Qualidade)
    async loadMachineMetrics(machineId) {
        try {
            // Buscar ordem de produção ativa para esta máquina
            const ordemResponse = await this.makeAuthenticatedRequest(
                `/api/ordens-producao?maquina=${machineId}&status=em-producao`
            );

            if (!ordemResponse || !ordemResponse.ok) {
                // Se não houver ordem ativa, usar apenas qualidade dos ciclos de produção
                await this.loadQualidadeOnly(machineId);
                return;
            }

            const ordemData = await ordemResponse.json();
            const ordens = ordemData.data || [];

            if (ordens.length === 0) {
                // Se não houver ordem ativa, usar apenas qualidade dos ciclos de produção
                await this.loadQualidadeOnly(machineId);
                return;
            }

            const ordem = ordens[0];

            // Calcular todas as métricas baseado na ordem de produção
            const disponibilidadeResult = await this.calcularDisponibilidade(ordem, machineId);
            const performanceResult = await this.calcularPerformance(ordem, machineId);
            const qualidadeResult = await this.calcularQualidade(ordem, machineId, performanceResult.producaoReal);

            // Calcular OEE
            const oee = (disponibilidadeResult.disponibilidade * performanceResult.performance * qualidadeResult.qualidade) / 10000;
            const oeeClamped = Math.max(0, Math.min(100, oee));

            // Atualizar métricas na interface
            this.updateMachineMetrics(machineId, {
                oee: oeeClamped,
                disponibilidade: disponibilidadeResult.disponibilidade,
                performance: performanceResult.performance,
                qualidade: qualidadeResult.qualidade
            });
        } catch (error) {
            console.error(`❌ Erro ao carregar métricas da máquina ${machineId}:`, error);
            // Em caso de erro, tentar carregar pelo menos a qualidade
            await this.loadQualidadeOnly(machineId);
        }
    }

    // Carregar apenas qualidade quando não houver ordem ativa
    async loadQualidadeOnly(machineId) {
        try {
            const response = await this.makeAuthenticatedRequest(`/api/producao/stats?machineId=${machineId}&period=week`);
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    const conformityRate = data.data.conformityRate || 0;
                    this.updateMachineMetrics(machineId, {
                        oee: 0,
                        disponibilidade: 0,
                        performance: 0,
                        qualidade: conformityRate
                    });
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar qualidade da máquina ${machineId}:`, error);
        }
    }

    // Calcular Disponibilidade
    async calcularDisponibilidade(ordem, machineId) {
        try {
            if (!ordem || !ordem.vinculoProdutoMaquina) {
                return { disponibilidade: 0 };
            }

            let vinculo = ordem.vinculoProdutoMaquina;
            
            if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.producaoIdeal)) {
                const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
                try {
                    const vinculoResponse = await this.makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                    if (vinculoResponse && vinculoResponse.ok) {
                        const vinculoData = await vinculoResponse.json();
                        vinculo = vinculoData.data || vinculo;
                    }
                } catch (err) {
                    console.warn('Erro ao buscar vínculo completo:', err);
                }
            }

            if (!vinculo) {
                return { disponibilidade: 0 };
            }

            let tempoSetupSegundos = vinculo.tempoSetup || 0;
            if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
                if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                    tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
                }
            }

            let dataInicioOrdem;
            const resetKey = `resetTimestamp_${machineId}`;
            const resetTimestampStored = localStorage.getItem(resetKey);
            
            if (resetTimestampStored) {
                dataInicioOrdem = new Date(resetTimestampStored);
            } else {
                if (ordem.createdAt) {
                    dataInicioOrdem = ordem.createdAt instanceof Date ? ordem.createdAt : new Date(ordem.createdAt);
                } else if (ordem.created_at) {
                    dataInicioOrdem = ordem.created_at instanceof Date ? ordem.created_at : new Date(ordem.created_at);
                } else {
                    dataInicioOrdem = new Date();
                }
            }
            const agora = new Date();

            const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000;
            const setupForcadoKey = `setupFinalizado_${machineId}`;
            const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
            let dataFimSetup = null;
            let setupFinalizado = false;
            
            if (setupForcadoTimestamp) {
                dataFimSetup = new Date(setupForcadoTimestamp);
                setupFinalizado = true;
            } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
                dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
                setupFinalizado = true;
            }

            const dataInicioTeorico = setupFinalizado && dataFimSetup 
                ? dataFimSetup 
                : new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);

            let tempoTeoricoMinutos = 0;
            if (setupFinalizado) {
                tempoTeoricoMinutos = (agora - dataInicioTeorico) / (1000 * 60);
            }

            let totalParadasSegundos = 0;
            
            if (setupFinalizado) {
                const machineIdUppercase = machineId.toString().toUpperCase();
                const paradasResponse = await this.makeAuthenticatedRequest(
                    `/api/paradas-maquina?machineId=${encodeURIComponent(machineIdUppercase)}&period=year`
                );

                if (paradasResponse && paradasResponse.ok) {
                    const paradasData = await paradasResponse.json();
                    const paradas = paradasData.data || [];
                    
                    paradas.forEach(parada => {
                        const paradaMachineId = (parada.machineId || '').toString().toUpperCase();
                        const ordemMachineId = machineId.toString().toUpperCase();
                        
                        if (paradaMachineId !== ordemMachineId) {
                            return;
                        }
                        
                        let paradaTimestamp;
                        if (parada.timestamp) {
                            paradaTimestamp = parada.timestamp instanceof Date 
                                ? parada.timestamp 
                                : new Date(parada.timestamp);
                        } else {
                            return;
                        }
                        
                        const duracaoSegundos = parada.duration_seconds || parada.duration || 0;
                        if (duracaoSegundos <= 0) {
                            return;
                        }
                        
                        const paradaFim = new Date(paradaTimestamp);
                        const paradaInicio = new Date(paradaFim.getTime() - (duracaoSegundos * 1000));
                        const paradaEstaNoPeriodo = paradaInicio >= dataInicioTeorico && paradaFim <= agora;
                        
                        if (paradaEstaNoPeriodo) {
                            totalParadasSegundos += duracaoSegundos;
                        } else {
                            const paradaSeSobrepoe = paradaInicio < agora && paradaFim > dataInicioTeorico;
                            if (paradaSeSobrepoe) {
                                const inicioSobreposicao = paradaInicio < dataInicioTeorico ? dataInicioTeorico : paradaInicio;
                                const fimSobreposicao = paradaFim > agora ? agora : paradaFim;
                                const segundosNoPeriodo = Math.max(0, (fimSobreposicao - inicioSobreposicao) / 1000);
                                totalParadasSegundos += segundosNoPeriodo;
                            }
                        }
                    });
                }
            }

            const totalParadasMinutos = totalParadasSegundos / 60;
            const tempoRealMinutos = Math.max(0, tempoTeoricoMinutos - totalParadasMinutos);

            let disponibilidadePercentual = 0;
            if (tempoTeoricoMinutos > 0) {
                disponibilidadePercentual = (tempoRealMinutos / tempoTeoricoMinutos) * 100;
            } else {
                disponibilidadePercentual = 100;
            }

            return { disponibilidade: disponibilidadePercentual };
        } catch (error) {
            console.error(`Erro ao calcular disponibilidade para ${machineId}:`, error);
            return { disponibilidade: 0 };
        }
    }

    // Calcular Performance
    async calcularPerformance(ordem, machineId) {
        try {
            if (!ordem || !ordem.vinculoProdutoMaquina) {
                return { performance: 0, producaoReal: 0 };
            }

            let vinculo = ordem.vinculoProdutoMaquina;
            
            if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.producaoIdeal)) {
                const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
                try {
                    const vinculoResponse = await this.makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                    if (vinculoResponse && vinculoResponse.ok) {
                        const vinculoData = await vinculoResponse.json();
                        vinculo = vinculoData.data || vinculo;
                    }
                } catch (err) {
                    console.warn('Erro ao buscar vínculo completo:', err);
                }
            }

            if (!vinculo) {
                return { performance: 0, producaoReal: 0 };
            }

            let producaoIdealPorHora = vinculo.producaoIdeal || 0;
            if (producaoIdealPorHora === 0 && vinculo.configuracaoProduto) {
                if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.producaoIdeal) {
                    producaoIdealPorHora = vinculo.configuracaoProduto.producaoIdeal;
                }
            }
            
            const producaoIdealPorMinuto = producaoIdealPorHora / 60;

            let tempoSetupSegundos = vinculo.tempoSetup || 0;
            if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
                if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                    tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
                }
            }

            let dataInicioOrdem;
            const resetKey = `resetTimestamp_${machineId}`;
            const resetTimestampStored = localStorage.getItem(resetKey);
            
            if (resetTimestampStored) {
                dataInicioOrdem = new Date(resetTimestampStored);
            } else {
                if (ordem.createdAt) {
                    dataInicioOrdem = ordem.createdAt instanceof Date ? ordem.createdAt : new Date(ordem.createdAt);
                } else if (ordem.created_at) {
                    dataInicioOrdem = ordem.created_at instanceof Date ? ordem.created_at : new Date(ordem.created_at);
                } else {
                    dataInicioOrdem = new Date();
                }
            }
            const agora = new Date();

            const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000;
            const setupForcadoKey = `setupFinalizado_${machineId}`;
            const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
            let dataFimSetup = null;
            let setupFinalizado = false;
            
            if (setupForcadoTimestamp) {
                dataFimSetup = new Date(setupForcadoTimestamp);
                setupFinalizado = true;
            } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
                dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
                setupFinalizado = true;
            }

            let tempoEfetivoMinutos = 0;
            if (setupFinalizado && dataFimSetup) {
                tempoEfetivoMinutos = (agora - dataFimSetup) / (1000 * 60);
            }

            const producaoTeorica = Math.max(0, producaoIdealPorMinuto * tempoEfetivoMinutos);

            let producaoReal = 0;
            
            if (setupFinalizado && dataFimSetup) {
                const ciclosResponse = await this.makeAuthenticatedRequest(
                    `/api/producao?machineId=${encodeURIComponent(machineId)}&period=year`
                );

                if (ciclosResponse && ciclosResponse.ok) {
                    const ciclosData = await ciclosResponse.json();
                    const ciclos = ciclosData.data || [];
                    
                    const ciclosDesdeFimSetup = ciclos.filter(ciclo => {
                        let cicloDate;
                        if (ciclo.timestamp) {
                            cicloDate = ciclo.timestamp instanceof Date 
                                ? ciclo.timestamp 
                                : new Date(ciclo.timestamp);
                        } else {
                            return false;
                        }
                        
                        const cicloMachineId = (ciclo.machineId || ciclo.machine || '').toString().toUpperCase();
                        const ordemMachineId = machineId.toString().toUpperCase();
                        
                        return cicloDate >= dataFimSetup && cicloDate <= agora && cicloMachineId === ordemMachineId;
                    });
                    
                    producaoReal = ciclosDesdeFimSetup.length;
                }
            }

            let performancePercent = 0;
            if (producaoTeorica > 0) {
                performancePercent = (producaoReal / producaoTeorica) * 100;
            }

            return { performance: performancePercent, producaoReal: producaoReal };
        } catch (error) {
            console.error(`Erro ao calcular performance para ${machineId}:`, error);
            return { performance: 0, producaoReal: 0 };
        }
    }

    // Calcular Qualidade
    async calcularQualidade(ordem, machineId, producaoReal) {
        try {
            if (!ordem || !ordem.maquina) {
                return { qualidade: 0 };
            }

            if (producaoReal === 0) {
                return { qualidade: 0 };
            }

            // Buscar ciclos de produção para calcular qualidade
            const ciclosResponse = await this.makeAuthenticatedRequest(
                `/api/producao?machineId=${encodeURIComponent(machineId)}&period=week`
            );

            if (!ciclosResponse || !ciclosResponse.ok) {
                return { qualidade: 0 };
            }

            const ciclosData = await ciclosResponse.json();
            const ciclos = ciclosData.data || [];

            // Filtrar ciclos do período da ordem
            const ciclosNoPeriodo = ciclos.filter(ciclo => {
                const cicloMachineId = (ciclo.machineId || ciclo.machine || '').toString().toUpperCase();
                const ordemMachineId = machineId.toString().toUpperCase();
                return cicloMachineId === ordemMachineId;
            });

            const totalCiclos = ciclosNoPeriodo.length;
            const ciclosConformes = ciclosNoPeriodo.filter(ciclo => !ciclo.isDefective).length;

            let qualidadePercent = 0;
            if (totalCiclos > 0) {
                qualidadePercent = (ciclosConformes / totalCiclos) * 100;
            }

            return { qualidade: qualidadePercent };
        } catch (error) {
            console.error(`Erro ao calcular qualidade para ${machineId}:`, error);
            return { qualidade: 0 };
        }
    }

    // Atualizar métricas na interface
    updateMachineMetrics(machineId, stats) {
        const card = document.querySelector(`[data-machine-id="${machineId}"]`);
        if (!card) return;

        // Recebe os dados da API e atualiza os valores exibidos nos cards
        // Os dados são processados da resposta da API /api/producao/stats

        const oeeValue = card.querySelector('[data-metric="oee"]');
        const disponibilidadeValue = card.querySelector('[data-metric="disponibilidade"]');
        const performanceValue = card.querySelector('[data-metric="performance"]');
        const qualidadeValue = card.querySelector('[data-metric="qualidade"]');

        // Extrair valores da resposta da API (ajustar nomes conforme a estrutura retornada)
        const oee = stats.oee || stats.oeePercent || 0;
        const disponibilidade = stats.disponibilidade || stats.availability || stats.availabilityPercent || 0;
        const performance = stats.performance || stats.performancePercent || 0;
        const qualidade = stats.qualidade || stats.conformityRate || stats.quality || stats.qualityPercent || 0;

        // Atualizar valores na interface
        if (oeeValue) {
            oeeValue.textContent = `${oee.toFixed(1)}%`;
        }
        if (disponibilidadeValue) {
            disponibilidadeValue.textContent = `${disponibilidade.toFixed(1)}%`;
        }
        if (performanceValue) {
            performanceValue.textContent = `${performance.toFixed(1)}%`;
        }
        if (qualidadeValue) {
            qualidadeValue.textContent = `${qualidade.toFixed(1)}%`;
        }
    }

    // Mostrar estado vazio
    showEmptyState() {
        const machinesGrid = document.getElementById('machinesGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (machinesGrid) machinesGrid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    }

    // Mostrar erro
    showError(message) {
        const statusMessage = document.querySelector('.status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.classList.add('show');
            statusMessage.style.background = '#fee2e2';
            statusMessage.style.color = '#991b1b';
            
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 5000);
        }
    }

    // Logout
    handleLogout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }

    // Toggle sidebar
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
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

    updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR');

        // Insere o timestamp no cabeçalho, ao lado das infos do usuário
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
    
    // Limpar intervalos ao destruir instância
    destroy() {
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
    }
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.maquinasPage = new MaquinasPage();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.innerWidth > 767) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }
});

