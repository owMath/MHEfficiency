// JavaScript para página de Relatórios
class RelatoriosPage {
    constructor() {
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.machines = [];
        this.filters = {
            periodo: '30',
            maquina: 'all',
            indicador: 'OEE',
            agrupar: 'mes'
        };

        this.charts = {}; // Armazenar instâncias dos gráficos

        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadMachines();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
            window.location.href = 'login.html';
            return false;
        }
        
        const userData = JSON.parse(user);
        
        if (userData.tipoUsuario === 'operador' && userData.status === 'pendente') {
            this.showPendingMessage();
            return false;
        }
        
        if (userData.status === 'inativo') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return false;
        }
        
        return true;
    }

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

    loadUserData() {
        const userName = document.querySelector('.username');
        if (userName && this.user) {
            userName.textContent = this.user.nome || 'Usuário';
        }
    }

    setupEventListeners() {
        // Botões de filtros
        document.getElementById('aplicarFiltros')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('limparFiltros')?.addEventListener('click', () => this.clearFilters());

        // Listeners para atualizar filtros automaticamente ao mudar os selects (sem notificação)
        document.getElementById('periodoFilter')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('maquinaFilter')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('indicadorFilter')?.addEventListener('change', () => this.updateFilters());
        document.getElementById('agruparFilter')?.addEventListener('change', () => this.updateFilters());

        // Botões de relatórios pré-definidos
        document.querySelectorAll('.btn-visualizar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const relatorio = e.currentTarget.getAttribute('data-relatorio');
                this.visualizarRelatorio(relatorio);
            });
        });

        document.querySelectorAll('.btn-exportar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const relatorio = e.currentTarget.getAttribute('data-relatorio');
                this.exportarRelatorio(relatorio);
            });
        });

        // Botões de relatório personalizado
        document.getElementById('gerarRelatorioPersonalizado')?.addEventListener('click', () => this.gerarRelatorioPersonalizado());
        document.getElementById('limparPersonalizado')?.addEventListener('click', () => this.limparPersonalizado());

        // Modal
        document.getElementById('fecharModal')?.addEventListener('click', () => this.fecharModal());
        
        // Fechar modal ao clicar fora
        document.getElementById('modalRelatorio')?.addEventListener('click', (e) => {
            if (e.target.id === 'modalRelatorio') {
                this.fecharModal();
            }
        });

        // Logout
        document.querySelector('.logout-btn')?.addEventListener('click', () => this.handleLogout());

        // Menu toggle
        document.querySelector('.menu-toggle')?.addEventListener('click', () => this.toggleSidebar());
    }

    async loadMachines() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/producao/machines');
            if (response && response.ok) {
                const data = await response.json();
                this.machines = data.data || [];
                this.populateMachineFilter();
            }
        } catch (error) {
            console.error('Erro ao carregar máquinas:', error);
        }
    }

    populateMachineFilter() {
        const select = document.getElementById('maquinaFilter');
        if (!select) return;

        // Limpar opções existentes (exceto "Todas")
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }

        // Adicionar máquinas - usar machineId do modelo Machine
        this.machines.forEach(machine => {
            // O modelo Machine tem machineId como campo obrigatório
            const machineId = machine.machineId;
            if (!machineId) {
                console.warn('Máquina sem machineId:', machine);
                return;
            }
            
            const option = document.createElement('option');
            option.value = machineId; // Sempre usa o machineId do modelo
            // Usa nome do modelo ou configuracoes.nome como fallback
            const nome = machine.nome || machine.configuracoes?.nome || `Máquina ${machineId}`;
            option.textContent = nome;
            select.appendChild(option);
        });
    }

    updateFilters() {
        // Atualizar filtros sem mostrar notificação (usado pelos event listeners dos selects)
        this.filters = {
            periodo: document.getElementById('periodoFilter').value,
            maquina: document.getElementById('maquinaFilter').value,
            indicador: document.getElementById('indicadorFilter').value,
            agrupar: document.getElementById('agruparFilter').value
        };
        console.log('Filtros atualizados (silencioso):', this.filters);
    }

    applyFilters() {
        this.filters = {
            periodo: document.getElementById('periodoFilter').value,
            maquina: document.getElementById('maquinaFilter').value,
            indicador: document.getElementById('indicadorFilter').value,
            agrupar: document.getElementById('agruparFilter').value
        };
        
        // Exibir notificação e logs
        console.log('Filtros aplicados:', this.filters);
        this.showNotification('Filtros aplicados com sucesso!', 'success');
    }

    clearFilters() {
        document.getElementById('periodoFilter').value = '30';
        document.getElementById('maquinaFilter').value = 'all';
        document.getElementById('indicadorFilter').value = 'OEE';
        document.getElementById('agruparFilter').value = 'mes';
        this.applyFilters();
    }

    limparPersonalizado() {
        document.querySelectorAll('.indicadores-checkboxes input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        document.getElementById('indOEE').checked = true;
        document.getElementById('indDisponibilidade').checked = true;
        document.getElementById('indPerformance').checked = true;
        document.getElementById('indQualidade').checked = true;
    }

    async visualizarRelatorio(tipo) {
        try {
            this.showModal();
            this.showLoadingModal();

            let dados = {};
            let titulo = '';

            switch (tipo) {
                case 'oee-evolucao':
                    titulo = 'Evolução do OEE';
                    dados = await this.getOEEEvolucao();
                    break;
                case 'paradas':
                    titulo = 'Análise de Paradas';
                    dados = await this.getAnaliseParadas();
                    break;
                case 'desempenho-maquina':
                    titulo = 'Desempenho por Máquina';
                    dados = await this.getDesempenhoMaquina();
                    break;
                case 'perdas-producao':
                    titulo = 'Perdas de Produção';
                    dados = await this.getPerdasProducao();
                    break;
                case 'logistica':
                    titulo = 'Gestão Logística';
                    dados = await this.getLogistica();
                    break;
                case 'ordens-producao':
                    titulo = 'Ordens de Produção';
                    dados = await this.getOrdensProducao();
                    break;
                default:
                    this.hideModal();
                    this.showNotification('Tipo de relatório não encontrado', 'error');
                    return;
            }

            this.renderRelatorio(titulo, dados);
        } catch (error) {
            console.error('Erro ao visualizar relatório:', error);
            this.showNotification('Erro ao carregar relatório', 'error');
            this.hideModal();
        }
    }

    async getOEEEvolucao() {
        const { periodo, maquina, agrupar } = this.filters;
        const periodMap = {
            '7': 'week',
            '30': 'month',
            '90': 'year',
            'month': 'month',
            'year': 'year'
        };
        const period = periodMap[periodo] || 'month';

        const [producaoData, paradasData] = await Promise.all([
            this.fetchProducao(period, maquina),
            this.fetchParadas(period, maquina)
        ]);

        // Agrupar dados
        const agrupado = this.agruparDados(producaoData, paradasData, agrupar);
        
        return {
            labels: agrupado.labels,
            oee: agrupado.oee,
            disponibilidade: agrupado.disponibilidade,
            performance: agrupado.performance,
            qualidade: agrupado.qualidade
        };
    }

    async getAnaliseParadas() {
        const { periodo, maquina } = this.filters;
        const periodMap = {
            '7': 'week',
            '30': 'month',
            '90': 'year',
            'month': 'month',
            'year': 'year'
        };
        const period = periodMap[periodo] || 'month';

        const paradas = await this.fetchParadas(period, maquina);

        // Agrupar por motivo
        const porMotivo = {};
        const porMaquina = {};
        let totalTempo = 0;

        paradas.forEach(parada => {
            const motivo = parada.reason || 'Não especificado';
            const machineId = parada.machineId || 'N/A';
            const duracao = parada.duration_seconds || parada.duration || 0;
            totalTempo += duracao;

            if (!porMotivo[motivo]) {
                porMotivo[motivo] = { count: 0, totalTempo: 0 };
            }
            porMotivo[motivo].count++;
            porMotivo[motivo].totalTempo += duracao;

            if (!porMaquina[machineId]) {
                porMaquina[machineId] = { count: 0, totalTempo: 0 };
            }
            porMaquina[machineId].count++;
            porMaquina[machineId].totalTempo += duracao;
        });

        return {
            total: paradas.length,
            totalTempo: totalTempo,
            porMotivo: porMotivo,
            porMaquina: porMaquina,
            paradas: paradas.slice(0, 100) // Limitar para exibição
        };
    }

    async getDesempenhoMaquina() {
        const { periodo } = this.filters;
        const periodMap = {
            '7': 'week',
            '30': 'month',
            '90': 'year',
            'month': 'month',
            'year': 'year'
        };
        const period = periodMap[periodo] || 'month';

        const machines = this.machines.length > 0 ? this.machines : await this.loadMachinesData();
        
        const resultados = [];

        for (const machine of machines) {
            // Sempre usar machineId do modelo Machine
            const machineId = machine.machineId;
            if (!machineId) {
                console.warn('Máquina sem machineId ignorada:', machine);
                continue;
            }
            
            const [producao, paradas] = await Promise.all([
                this.fetchProducao(period, machineId),
                this.fetchParadas(period, machineId)
            ]);

            const metrics = this.calcularMetricas(producao, paradas);
            
            resultados.push({
                machineId: machineId,
                nome: machine.nome || machine.configuracoes?.nome || `Máquina ${machineId}`,
                ...metrics
            });
        }

        return { maquinas: resultados };
    }

    async getPerdasProducao() {
        const { periodo, maquina } = this.filters;
        const periodMap = {
            '7': 'week',
            '30': 'month',
            '90': 'year',
            'month': 'month',
            'year': 'year'
        };
        const period = periodMap[periodo] || 'month';

        const [producao, paradas, descartes] = await Promise.all([
            this.fetchProducao(period, maquina),
            this.fetchParadas(period, maquina),
            this.fetchDescartes(period, maquina)
        ]);

        const metrics = this.calcularMetricas(producao, paradas, descartes);
        
        // Calcular perdas
        const totalProduzido = producao.length;
        const defeituosos = producao.filter(p => p.isDefective).length;
        const tempoParadas = paradas.reduce((sum, p) => sum + (p.duration_seconds || p.duration || 0), 0);
        const quantidadeDescartes = descartes.reduce((sum, d) => sum + (d.quantidade || 0), 0);

        return {
            perdaDisponibilidade: metrics.perdaDisponibilidade || 0,
            perdaPerformance: metrics.perdaPerformance || 0,
            perdaQualidade: metrics.perdaQualidade || 0,
            totalParadas: paradas.length,
            tempoParadas: tempoParadas,
            defeituosos: defeituosos,
            descartes: quantidadeDescartes,
            producaoPerdida: defeituosos + quantidadeDescartes
        };
    }

    async getLogistica() {
        // Retornar dados básicos de logística (pode ser expandido)
        return {
            message: 'Relatório de logística em desenvolvimento',
            dados: []
        };
    }

    async getOrdensProducao() {
        const { periodo, maquina } = this.filters;
        const periodMap = {
            '7': 'week',
            '30': 'month',
            '90': 'year',
            'month': 'month',
            'year': 'year'
        };
        const period = periodMap[periodo] || 'month';

        const producao = await this.fetchProducao(period, maquina);

        // Agrupar por máquina e status
        const ordens = {};
        producao.forEach(item => {
            const machineId = item.machineId || 'N/A';
            if (!ordens[machineId]) {
                ordens[machineId] = {
                    total: 0,
                    conformes: 0,
                    defeituosos: 0
                };
            }
            ordens[machineId].total++;
            if (item.isDefective) {
                ordens[machineId].defeituosos++;
            } else {
                ordens[machineId].conformes++;
            }
        });

        return { ordens, total: producao.length };
    }

    async gerarRelatorioPersonalizado() {
        const indicadores = [];
        if (document.getElementById('indOEE').checked) indicadores.push('OEE');
        if (document.getElementById('indDisponibilidade').checked) indicadores.push('Disponibilidade');
        if (document.getElementById('indPerformance').checked) indicadores.push('Performance');
        if (document.getElementById('indQualidade').checked) indicadores.push('Qualidade');
        if (document.getElementById('indParadas').checked) indicadores.push('Paradas');
        if (document.getElementById('indProducao').checked) indicadores.push('Produção');
        if (document.getElementById('indLogistica').checked) indicadores.push('Logística');
        if (document.getElementById('indRejeitos').checked) indicadores.push('Rejeitos');

        if (indicadores.length === 0) {
            this.showNotification('Selecione pelo menos um indicador', 'warning');
            return;
        }

        try {
            this.showModal();
            this.showLoadingModal();

            const { periodo, maquina } = this.filters;
            const periodMap = {
                '7': 'week',
                '30': 'month',
                '90': 'year',
                'month': 'month',
                'year': 'year'
            };
            const period = periodMap[periodo] || 'month';

            const [producao, paradas, descartes] = await Promise.all([
                this.fetchProducao(period, maquina),
                this.fetchParadas(period, maquina),
                this.fetchDescartes(period, maquina)
            ]);

            const dados = this.prepararDadosPersonalizado(producao, paradas, descartes, indicadores);
            this.renderRelatorioPersonalizado('Relatório Personalizado', dados, indicadores);
        } catch (error) {
            console.error('Erro ao gerar relatório personalizado:', error);
            this.showNotification('Erro ao gerar relatório', 'error');
            this.hideModal();
        }
    }

    prepararDadosPersonalizado(producao, paradas, descartes, indicadores) {
        const dados = {};
        
        if (indicadores.includes('OEE') || indicadores.includes('Disponibilidade') || 
            indicadores.includes('Performance') || indicadores.includes('Qualidade')) {
            const metrics = this.calcularMetricas(producao, paradas, descartes);
            dados.metricas = metrics;
        }
        
        if (indicadores.includes('Paradas')) {
            dados.paradas = {
                total: paradas.length,
                tempoTotal: paradas.reduce((sum, p) => sum + (p.duration_seconds || p.duration || 0), 0),
                porMotivo: this.agruparParadasPorMotivo(paradas)
            };
        }
        
        if (indicadores.includes('Produção')) {
            dados.producao = {
                total: producao.length,
                conformes: producao.filter(p => !p.isDefective).length,
                defeituosos: producao.filter(p => p.isDefective).length
            };
        }
        
        if (indicadores.includes('Rejeitos')) {
            dados.rejeitos = {
                total: descartes.length,
                quantidade: descartes.reduce((sum, d) => sum + (d.quantidade || 0), 0),
                porCategoria: this.agruparDescartesPorCategoria(descartes)
            };
        }

        return dados;
    }

    calcularMetricas(producao, paradas, descartes = []) {
        // Calcular Qualidade usando dados REAIS de ciclos_producao
        // Os dados vêm da coleção ciclos_producao com campo isDefective
        const total = producao.length;
        const conformes = producao.filter(p => {
            // Garantir que o campo isDefective existe e está correto
            return p.hasOwnProperty('isDefective') ? !p.isDefective : true;
        }).length;
        const qualidade = total > 0 ? (conformes / total) * 100 : 0;

        // Calcular Disponibilidade usando dados REAIS de paradas
        // Periodo em dias baseado no filtro
        const periodDays = {
            '7': 7,
            '30': 30,
            '90': 90,
            'month': 30,
            'year': 365,
            'week': 7,
            'day': 1
        };
        const dias = periodDays[this.filters.periodo] || 30;
        
        // Tempo total disponível: assumindo 8 horas/dia = 28800 segundos por dia
        const tempoTotal = 28800 * dias;
        
        // Soma real do tempo de paradas (duration_seconds ou duration)
        const tempoParadas = paradas.reduce((sum, p) => {
            const dur = p.duration_seconds || p.duration || 0;
            return sum + dur;
        }, 0);
        
        const tempoDisponivel = Math.max(0, tempoTotal - tempoParadas);
        const disponibilidade = tempoTotal > 0 ? (tempoDisponivel / tempoTotal) * 100 : 0;

        // Calcular Performance usando dados REAIS
        // Performance = (Ciclos Reais / Ciclos Ideais) * 100
        // Ciclos reais = quantidade de registros em ciclos_producao
        const ciclosReais = producao.length;
        
        // Para calcular ciclos ideais, precisamos do tempo de ciclo ideal
        // Se não temos essa informação, assumimos um tempo médio de 10s por ciclo
        // Isso pode ser melhorado buscando dados de VinculoProdutoMaquina no futuro
        const tempoCicloIdeal = 10; // segundos (padrão - pode ser ajustado)
        const ciclosIdeais = tempoDisponivel > 0 ? Math.floor(tempoDisponivel / tempoCicloIdeal) : 0;
        const performance = ciclosIdeais > 0 
            ? Math.min(100, (ciclosReais / ciclosIdeais) * 100) 
            : (ciclosReais > 0 ? 100 : 0);

        // Calcular OEE = Disponibilidade * Performance * Qualidade
        const oee = (disponibilidade / 100) * (performance / 100) * (qualidade / 100) * 100;

        return {
            oee: Math.max(0, Math.min(100, oee)),
            disponibilidade: Math.max(0, Math.min(100, disponibilidade)),
            performance: Math.max(0, Math.min(100, performance)),
            qualidade: Math.max(0, Math.min(100, qualidade)),
            perdaDisponibilidade: 100 - disponibilidade,
            perdaPerformance: 100 - performance,
            perdaQualidade: 100 - qualidade
        };
    }

    agruparDados(producao, paradas, agruparPor) {
        const grupos = {};
        
        // Processar dados de produção REAIS da coleção ciclos_producao
        producao.forEach(item => {
            // Garantir que timestamp seja convertido para Date se for string
            let data;
            if (item.timestamp instanceof Date) {
                data = item.timestamp;
            } else if (typeof item.timestamp === 'string') {
                data = new Date(item.timestamp);
            } else if (item.createdAt) {
                // Fallback para createdAt se timestamp não existir
                data = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
            } else {
                return; // Ignorar items sem timestamp válido
            }
            
            // Validar se a data é válida
            if (isNaN(data.getTime())) {
                return; // Ignorar datas inválidas
            }
            
            let chave = '';
            
            switch (agruparPor) {
                case 'dia':
                    chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
                    break;
                case 'semana':
                    const weekStart = new Date(data);
                    weekStart.setDate(data.getDate() - data.getDay());
                    const weekNum = Math.ceil((data.getDate() - data.getDay()) / 7);
                    chave = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                    break;
                case 'mes':
                    // Usar formato YYYY-MM para ordenação correta
                    chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'ano':
                    chave = data.getFullYear().toString();
                    break;
            }
            
            if (!grupos[chave]) {
                grupos[chave] = { producao: [], paradas: [] };
            }
            grupos[chave].producao.push(item);
        });

        // Processar dados de paradas REAIS da coleção paradas_maquina
        paradas.forEach(item => {
            // Garantir que timestamp seja convertido para Date se for string
            let data;
            if (item.timestamp instanceof Date) {
                data = item.timestamp;
            } else if (typeof item.timestamp === 'string') {
                data = new Date(item.timestamp);
            } else if (item.createdAt) {
                // Fallback para createdAt se timestamp não existir
                data = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
            } else {
                return; // Ignorar items sem timestamp válido
            }
            
            // Validar se a data é válida
            if (isNaN(data.getTime())) {
                return; // Ignorar datas inválidas
            }
            
            let chave = '';
            
            switch (agruparPor) {
                case 'dia':
                    chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
                    break;
                case 'semana':
                    const weekStart = new Date(data);
                    weekStart.setDate(data.getDate() - data.getDay());
                    const weekNum = Math.ceil((data.getDate() - data.getDay()) / 7);
                    chave = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
                    break;
                case 'mes':
                    // Usar formato YYYY-MM para ordenação correta
                    chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'ano':
                    chave = data.getFullYear().toString();
                    break;
            }
            
            if (!grupos[chave]) {
                grupos[chave] = { producao: [], paradas: [] };
            }
            grupos[chave].paradas.push(item);
        });

        const chavesOrdenadas = Object.keys(grupos).sort();
        const labels = [];
        const oee = [];
        const disponibilidade = [];
        const performance = [];
        const qualidade = [];

        chavesOrdenadas.forEach(chave => {
            const grupo = grupos[chave];
            const metrics = this.calcularMetricas(grupo.producao, grupo.paradas);
            oee.push(metrics.oee);
            disponibilidade.push(metrics.disponibilidade);
            performance.push(metrics.performance);
            qualidade.push(metrics.qualidade);
            
            // Converter label interna para formato amigável
            let labelFormatado = chave;
            if (agruparPor === 'dia') {
                const [year, month, day] = chave.split('-');
                const date = new Date(year, month - 1, day);
                labelFormatado = date.toLocaleDateString('pt-BR');
            } else if (agruparPor === 'mes') {
                const [year, month] = chave.split('-');
                const date = new Date(year, month - 1, 1);
                labelFormatado = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            } else if (agruparPor === 'semana') {
                const [year, week] = chave.split('-W');
                labelFormatado = `Sem ${week}/${year}`;
            }
            
            labels.push(labelFormatado);
        });

        return { labels, oee, disponibilidade, performance, qualidade };
    }

    agruparParadasPorMotivo(paradas) {
        const grupos = {};
        paradas.forEach(p => {
            const motivo = p.reason || 'Não especificado';
            if (!grupos[motivo]) {
                grupos[motivo] = { count: 0, tempo: 0 };
            }
            grupos[motivo].count++;
            grupos[motivo].tempo += p.duration_seconds || p.duration || 0;
        });
        return grupos;
    }

    agruparDescartesPorCategoria(descartes) {
        const grupos = {};
        descartes.forEach(d => {
            const categoria = d.categoria || 'Não especificado';
            if (!grupos[categoria]) {
                grupos[categoria] = { count: 0, quantidade: 0 };
            }
            grupos[categoria].count++;
            grupos[categoria].quantidade += d.quantidade || 0;
        });
        return grupos;
    }

    async fetchProducao(period, machineId = 'all') {
        try {
            // Não converter para uppercase aqui - vamos enviar exatamente como está
            // O backend vai fazer o case-insensitive
            const machineIdFilter = machineId;
            const url = `/api/producao?period=${period}${machineIdFilter !== 'all' ? `&machineId=${machineIdFilter}` : ''}`;
            console.log('🔍 Buscando produção - URL:', url);
            console.log('🔍 machineId enviado:', machineIdFilter);
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                console.log('✅ Dados de produção recebidos:', data.data ? data.data.length : 0, 'registros');
                return data.data || [];
            }
        } catch (error) {
            console.error('Erro ao buscar produção:', error);
        }
        return [];
    }

    async fetchParadas(period, machineId = 'all') {
        try {
            // Não converter para uppercase aqui - vamos enviar exatamente como está
            // O backend vai fazer o case-insensitive
            const machineIdFilter = machineId;
            const url = `/api/paradas-maquina?period=${period}${machineIdFilter !== 'all' ? `&machineId=${machineIdFilter}` : ''}`;
            console.log('🔍 Buscando paradas - URL:', url);
            console.log('🔍 machineId enviado:', machineIdFilter);
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                console.log('✅ Dados de paradas recebidos:', data.data ? data.data.length : 0, 'registros');
                return data.data || [];
            }
        } catch (error) {
            console.error('Erro ao buscar paradas:', error);
        }
        return [];
    }

    async fetchDescartes(period, maquina = 'all') {
        try {
            const now = new Date();
            let dataInicio = new Date();
            
            const periodMap = {
                'week': 7,
                'month': 30,
                'year': 365
            };
            const days = periodMap[period] || 30;
            dataInicio.setDate(now.getDate() - days);
            
            // Não converter para uppercase aqui - vamos enviar exatamente como está
            // O backend vai fazer o case-insensitive
            const machineFilter = maquina;
            const url = `/api/descartes?dataInicio=${dataInicio.toISOString()}&dataFim=${now.toISOString()}${machineFilter !== 'all' ? `&maquina=${machineFilter}` : ''}`;
            console.log('🔍 Buscando descartes - URL:', url);
            console.log('🔍 maquina enviada:', machineFilter);
            const response = await this.makeAuthenticatedRequest(url);
            if (response && response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            console.error('Erro ao buscar descartes:', error);
        }
        return [];
    }

    async loadMachinesData() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/producao/machines');
            if (response && response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            console.error('Erro ao carregar máquinas:', error);
        }
        return [];
    }

    renderRelatorio(titulo, dados) {
        const modalBody = document.getElementById('modalBody');
        const modalTitulo = document.getElementById('modalTitulo');
        
        modalTitulo.textContent = titulo;
        
        let html = '';

        if (titulo === 'Evolução do OEE') {
            html = this.renderOEEEvolucao(dados);
        } else if (titulo === 'Análise de Paradas') {
            html = this.renderAnaliseParadas(dados);
        } else if (titulo === 'Desempenho por Máquina') {
            html = this.renderDesempenhoMaquina(dados);
        } else if (titulo === 'Perdas de Produção') {
            html = this.renderPerdasProducao(dados);
        } else if (titulo === 'Gestão Logística') {
            html = '<p>Relatório de logística em desenvolvimento.</p>';
        } else if (titulo === 'Ordens de Produção') {
            html = this.renderOrdensProducao(dados);
        }

        modalBody.innerHTML = html;
    }

    renderOEEEvolucao(dados) {
        // Destruir gráfico anterior se existir
        this.destroyChart('chartOEE');

        const html = `
            <div class="chart-container-modal">
                <canvas id="chartOEE"></canvas>
            </div>
            <div class="table-container">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>Período</th>
                            <th>OEE</th>
                            <th>Disponibilidade</th>
                            <th>Performance</th>
                            <th>Qualidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.labels.map((label, i) => `
                            <tr>
                                <td>${label}</td>
                                <td>${(dados.oee[i] || 0).toFixed(1)}%</td>
                                <td>${(dados.disponibilidade[i] || 0).toFixed(1)}%</td>
                                <td>${(dados.performance[i] || 0).toFixed(1)}%</td>
                                <td>${(dados.qualidade[i] || 0).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Função para tentar criar o gráfico
        const tryCreateChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartOEE');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                
                try {
                    this.charts['chartOEE'] = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: dados.labels,
                            datasets: [
                                {
                                    label: 'OEE (%)',
                                    data: dados.oee,
                                    borderColor: '#2563eb',
                                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                    tension: 0.4,
                                    fill: true,
                                    pointRadius: 5,
                                    pointHoverRadius: 7
                                },
                                {
                                    label: 'Disponibilidade (%)',
                                    data: dados.disponibilidade,
                                    borderColor: '#16a34a',
                                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                                    tension: 0.4,
                                    fill: false,
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                },
                                {
                                    label: 'Performance (%)',
                                    data: dados.performance,
                                    borderColor: '#eab308',
                                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                    tension: 0.4,
                                    fill: false,
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                },
                                {
                                    label: 'Qualidade (%)',
                                    data: dados.qualidade,
                                    borderColor: '#db2777',
                                    backgroundColor: 'rgba(219, 39, 119, 0.1)',
                                    tension: 0.4,
                                    fill: false,
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                                intersect: false,
                                mode: 'index'
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
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
                                    }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 0
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateChart(attempt + 1), 200);
            }
        };
        
        setTimeout(() => tryCreateChart(), 100);

        return html;
    }

    renderAnaliseParadas(dados) {
        this.destroyChart('chartParadasBar');
        this.destroyChart('chartParadasPie');

        // Preparar dados para gráficos
        const motivos = Object.keys(dados.porMotivo);
        const quantidades = motivos.map(m => dados.porMotivo[m].count);
        const tempos = motivos.map(m => Math.round(dados.porMotivo[m].totalTempo / 60)); // Converter para minutos

        const html = `
            <div style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Resumo Geral</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Total de Paradas</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #1f2937;">${dados.total}</div>
                    </div>
                    <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Tempo Total</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #1f2937;">${this.formatTempo(dados.totalTempo)}</div>
                    </div>
                </div>
            </div>
            <div class="charts-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="chart-container-modal">
                    <h3>Paradas por Motivo - Quantidade</h3>
                    <canvas id="chartParadasBar"></canvas>
                </div>
                <div class="chart-container-modal">
                    <h3>Distribuição de Tempo por Motivo</h3>
                    <canvas id="chartParadasPie"></canvas>
                </div>
            </div>
            <div class="table-container">
                <h3 style="margin-bottom: 1rem;">Detalhes por Motivo</h3>
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>Motivo</th>
                            <th>Quantidade</th>
                            <th>Tempo Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(dados.porMotivo).map(([motivo, info]) => `
                            <tr>
                                <td>${motivo}</td>
                                <td>${info.count}</td>
                                <td>${this.formatTempo(info.totalTempo)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Criar gráfico de barras
        const tryCreateBarChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartParadasBar');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartParadasBar'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: motivos.length > 0 ? motivos : ['Sem dados'],
                            datasets: [{
                                label: 'Quantidade de Paradas',
                                data: quantidades.length > 0 ? quantidades : [0],
                                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                borderColor: '#ef4444',
                                borderWidth: 2
                            }]
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
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 30
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico de barras:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateBarChart(attempt + 1), 200);
            }
        };

        // Criar gráfico de pizza
        const tryCreatePieChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartParadasPie');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    const colors = [
                        '#ef4444', '#f97316', '#eab308', '#84cc16',
                        '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
                        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'
                    ];
                    
                    this.charts['chartParadasPie'] = new Chart(ctx, {
                        type: 'pie',
                        data: {
                            labels: motivos.length > 0 ? motivos : ['Sem dados'],
                            datasets: [{
                                data: tempos.length > 0 ? tempos : [0],
                                backgroundColor: colors.slice(0, motivos.length || 1),
                                borderWidth: 2,
                                borderColor: '#ffffff'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'right'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const minutos = context.parsed;
                                            const horas = Math.floor(minutos / 60);
                                            const mins = minutos % 60;
                                            return `${context.label}: ${horas}h ${mins}m`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico de pizza:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreatePieChart(attempt + 1), 200);
            }
        };

        setTimeout(() => {
            tryCreateBarChart();
            tryCreatePieChart();
        }, 100);

        return html;
    }

    renderDesempenhoMaquina(dados) {
        this.destroyChart('chartDesempenho');

        const maquinas = dados.maquinas.map(m => m.nome);
        const oeeValues = dados.maquinas.map(m => m.oee);
        const disponibilidadeValues = dados.maquinas.map(m => m.disponibilidade);
        const performanceValues = dados.maquinas.map(m => m.performance);
        const qualidadeValues = dados.maquinas.map(m => m.qualidade);

        const html = `
            <div class="chart-container-modal">
                <canvas id="chartDesempenho"></canvas>
            </div>
            <div class="table-container">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>Máquina</th>
                            <th>OEE</th>
                            <th>Disponibilidade</th>
                            <th>Performance</th>
                            <th>Qualidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.maquinas.map(m => `
                            <tr>
                                <td>${m.nome}</td>
                                <td>${m.oee.toFixed(1)}%</td>
                                <td>${m.disponibilidade.toFixed(1)}%</td>
                                <td>${m.performance.toFixed(1)}%</td>
                                <td>${m.qualidade.toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const tryCreateChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartDesempenho');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartDesempenho'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: maquinas.length > 0 ? maquinas : ['Sem dados'],
                            datasets: [
                                {
                                    label: 'OEE (%)',
                                    data: oeeValues.length > 0 ? oeeValues : [0],
                                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                                    borderColor: '#2563eb',
                                    borderWidth: 2
                                },
                                {
                                    label: 'Disponibilidade (%)',
                                    data: disponibilidadeValues.length > 0 ? disponibilidadeValues : [0],
                                    backgroundColor: 'rgba(22, 163, 74, 0.8)',
                                    borderColor: '#16a34a',
                                    borderWidth: 2
                                },
                                {
                                    label: 'Performance (%)',
                                    data: performanceValues.length > 0 ? performanceValues : [0],
                                    backgroundColor: 'rgba(234, 179, 8, 0.8)',
                                    borderColor: '#eab308',
                                    borderWidth: 2
                                },
                                {
                                    label: 'Qualidade (%)',
                                    data: qualidadeValues.length > 0 ? qualidadeValues : [0],
                                    backgroundColor: 'rgba(219, 39, 119, 0.8)',
                                    borderColor: '#db2777',
                                    borderWidth: 2
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
                                    beginAtZero: true,
                                    max: 100,
                                    ticks: {
                                        callback: function(value) {
                                            return value + '%';
                                        }
                                    }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 30
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateChart(attempt + 1), 200);
            }
        };

        setTimeout(() => tryCreateChart(), 100);

        return html;
    }

    renderPerdasProducao(dados) {
        this.destroyChart('chartPerdasPie');
        this.destroyChart('chartPerdasBar');

        const perdas = [
            dados.perdaDisponibilidade,
            dados.perdaPerformance,
            dados.perdaQualidade
        ];
        const labelsPerdas = ['Disponibilidade', 'Performance', 'Qualidade'];
        const coresPerdas = ['#dc2626', '#d97706', '#db2777'];

        const html = `
            <div style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Resumo de Perdas</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="padding: 1rem; background: #fee2e2; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #991b1b;">Perda de Disponibilidade</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${dados.perdaDisponibilidade.toFixed(1)}%</div>
                    </div>
                    <div style="padding: 1rem; background: #fef3c7; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #92400e;">Perda de Performance</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${dados.perdaPerformance.toFixed(1)}%</div>
                    </div>
                    <div style="padding: 1rem; background: #fce7f3; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #831843;">Perda de Qualidade</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #db2777;">${dados.perdaQualidade.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
            <div class="charts-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div class="chart-container-modal">
                    <h3>Distribuição de Perdas por Componente</h3>
                    <canvas id="chartPerdasPie"></canvas>
                </div>
                <div class="chart-container-modal">
                    <h3>Comparativo de Perdas</h3>
                    <canvas id="chartPerdasBar"></canvas>
                </div>
            </div>
            <div style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Detalhes</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Total de Paradas</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.totalParadas}</div>
                    </div>
                    <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Tempo de Paradas</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${this.formatTempo(dados.tempoParadas)}</div>
                    </div>
                    <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: #6b7280;">Produção Perdida</div>
                        <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.producaoPerdida}</div>
                    </div>
                </div>
            </div>
        `;

        // Criar gráfico de pizza
        const tryCreatePieChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartPerdasPie');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartPerdasPie'] = new Chart(ctx, {
                        type: 'pie',
                        data: {
                            labels: labelsPerdas,
                            datasets: [{
                                data: perdas,
                                backgroundColor: coresPerdas,
                                borderWidth: 2,
                                borderColor: '#ffffff'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'right'
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            return `${context.label}: ${context.parsed.toFixed(2)}%`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico de pizza:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreatePieChart(attempt + 1), 200);
            }
        };

        // Criar gráfico de barras
        const tryCreateBarChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartPerdasBar');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartPerdasBar'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labelsPerdas,
                            datasets: [{
                                label: 'Perda (%)',
                                data: perdas,
                                backgroundColor: coresPerdas.map(c => c + 'CC'),
                                borderColor: coresPerdas,
                                borderWidth: 2
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
                                        callback: function(value) {
                                            return value + '%';
                                        }
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico de barras:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateBarChart(attempt + 1), 200);
            }
        };

        setTimeout(() => {
            tryCreatePieChart();
            tryCreateBarChart();
        }, 100);

        return html;
    }

    renderOrdensProducao(dados) {
        this.destroyChart('chartOrdens');
        this.destroyChart('chartOrdensTaxa');

        const maquinas = Object.keys(dados.ordens);
        const totais = maquinas.map(m => dados.ordens[m].total);
        const conformes = maquinas.map(m => dados.ordens[m].conformes);
        const defeituosos = maquinas.map(m => dados.ordens[m].defeituosos);
        const taxas = maquinas.map(m => {
            const total = dados.ordens[m].total;
            return total > 0 ? ((dados.ordens[m].conformes / total) * 100) : 0;
        });

        const html = `
            <div style="margin-bottom: 2rem;">
                <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-size: 0.875rem; color: #6b7280;">Total de Ordens</div>
                    <div style="font-size: 2rem; font-weight: bold; color: #1f2937;">${dados.total}</div>
                </div>
            </div>
            <div class="charts-grid" style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
                <div class="chart-container-modal">
                    <h3>Ordens por Máquina</h3>
                    <canvas id="chartOrdens"></canvas>
                </div>
                <div class="chart-container-modal" style="height: 300px;">
                    <h3>Taxa de Conformidade por Máquina</h3>
                    <canvas id="chartOrdensTaxa"></canvas>
                </div>
            </div>
            <div class="table-container">
                <table class="modal-table">
                    <thead>
                        <tr>
                            <th>Máquina</th>
                            <th>Total</th>
                            <th>Conformes</th>
                            <th>Defeituosos</th>
                            <th>Taxa Conformidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(dados.ordens).map(([machineId, info]) => {
                            const taxa = info.total > 0 ? ((info.conformes / info.total) * 100).toFixed(1) : '0.0';
                            return `
                                <tr>
                                    <td>${machineId}</td>
                                    <td>${info.total}</td>
                                    <td>${info.conformes}</td>
                                    <td>${info.defeituosos}</td>
                                    <td>${taxa}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Gráfico de barras agrupadas
        const tryCreateChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartOrdens');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartOrdens'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: maquinas.length > 0 ? maquinas : ['Sem dados'],
                            datasets: [
                                {
                                    label: 'Conformes',
                                    data: conformes.length > 0 ? conformes : [0],
                                    backgroundColor: 'rgba(22, 163, 74, 0.8)',
                                    borderColor: '#16a34a',
                                    borderWidth: 2
                                },
                                {
                                    label: 'Defeituosos',
                                    data: defeituosos.length > 0 ? defeituosos : [0],
                                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                                    borderColor: '#ef4444',
                                    borderWidth: 2
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
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 30
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateChart(attempt + 1), 200);
            }
        };

        // Gráfico de taxa de conformidade
        const tryCreateTaxaChart = (attempt = 0) => {
            const maxAttempts = 5;
            const canvas = document.getElementById('chartOrdensTaxa');
            
            if (canvas && typeof Chart !== 'undefined') {
                const ctx = canvas.getContext('2d');
                try {
                    this.charts['chartOrdensTaxa'] = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: maquinas.length > 0 ? maquinas : ['Sem dados'],
                            datasets: [{
                                label: 'Taxa de Conformidade (%)',
                                data: taxas.length > 0 ? taxas : [0],
                                backgroundColor: maquinas.map(() => 'rgba(37, 99, 235, 0.8)'),
                                borderColor: '#2563eb',
                                borderWidth: 2
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
                                    max: 100,
                                    ticks: {
                                        callback: function(value) {
                                            return value + '%';
                                        }
                                    }
                                },
                                x: {
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 30
                                    }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Erro ao criar gráfico de taxa:', error);
                }
            } else if (attempt < maxAttempts) {
                setTimeout(() => tryCreateTaxaChart(attempt + 1), 200);
            }
        };

        setTimeout(() => {
            tryCreateChart();
            tryCreateTaxaChart();
        }, 100);

        return html;
    }

    renderRelatorioPersonalizado(titulo, dados, indicadores) {
        const modalBody = document.getElementById('modalBody');
        const modalTitulo = document.getElementById('modalTitulo');
        
        modalTitulo.textContent = titulo;
        
        let html = '<div class="relatorio-personalizado-content">';
        
        if (dados.metricas) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Métricas OEE</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; background: #eff6ff; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #1e40af;">OEE</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: #2563eb;">${dados.metricas.oee.toFixed(1)}%</div>
                        </div>
                        <div style="padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #166534;">Disponibilidade</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: #16a34a;">${dados.metricas.disponibilidade.toFixed(1)}%</div>
                        </div>
                        <div style="padding: 1rem; background: #fefce8; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #854d0e;">Performance</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: #eab308;">${dados.metricas.performance.toFixed(1)}%</div>
                        </div>
                        <div style="padding: 1rem; background: #fdf2f8; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #831843;">Qualidade</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: #db2777;">${dados.metricas.qualidade.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (dados.paradas) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Análise de Paradas</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #6b7280;">Total de Paradas</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.paradas.total}</div>
                        </div>
                        <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #6b7280;">Tempo Total</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${this.formatTempo(dados.paradas.tempoTotal)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (dados.producao) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Análise de Produção</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #6b7280;">Total</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.producao.total}</div>
                        </div>
                        <div style="padding: 1rem; background: #d1fae5; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #065f46;">Conformes</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${dados.producao.conformes}</div>
                        </div>
                        <div style="padding: 1rem; background: #fee2e2; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #991b1b;">Defeituosos</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${dados.producao.defeituosos}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (dados.rejeitos) {
            html += `
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Análise de Rejeitos</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #6b7280;">Total de Registros</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.rejeitos.total}</div>
                        </div>
                        <div style="padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                            <div style="font-size: 0.875rem; color: #6b7280;">Quantidade Total</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #1f2937;">${dados.rejeitos.quantidade}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        modalBody.innerHTML = html;
    }

    formatTempo(segundos) {
        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segs = segundos % 60;
        return `${horas}h ${minutos}m ${segs}s`;
    }

    showModal() {
        document.getElementById('modalRelatorio').style.display = 'block';
    }

    hideModal() {
        document.getElementById('modalRelatorio').style.display = 'none';
    }

    fecharModal() {
        // Destruir todos os gráficos ao fechar modal
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
        this.hideModal();
    }

    destroyChart(chartId) {
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }

    showLoadingModal() {
        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i></div>';
    }

    async exportarRelatorio(tipo) {
        try {
            // Primeiro, visualizar o relatório se ainda não estiver aberto
            if (document.getElementById('modalRelatorio').style.display !== 'block') {
                await this.visualizarRelatorio(tipo);
                // Aguardar um pouco para o conteúdo ser renderizado
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            this.showNotification('Gerando PDF...', 'info');

            let titulo = '';
            switch (tipo) {
                case 'oee-evolucao':
                    titulo = 'Evolução do OEE';
                    break;
                case 'paradas':
                    titulo = 'Análise de Paradas';
                    break;
                case 'desempenho-maquina':
                    titulo = 'Desempenho por Máquina';
                    break;
                case 'perdas-producao':
                    titulo = 'Perdas de Produção';
                    break;
                case 'logistica':
                    titulo = 'Gestão Logística';
                    break;
                case 'ordens-producao':
                    titulo = 'Ordens de Produção';
                    break;
                default:
                    titulo = 'Relatório';
            }

            // Buscar os dados novamente para exportação
            let dados = {};
            switch (tipo) {
                case 'oee-evolucao':
                    dados = await this.getOEEEvolucao();
                    break;
                case 'paradas':
                    dados = await this.getAnaliseParadas();
                    break;
                case 'desempenho-maquina':
                    dados = await this.getDesempenhoMaquina();
                    break;
                case 'perdas-producao':
                    dados = await this.getPerdasProducao();
                    break;
                case 'logistica':
                    dados = await this.getLogistica();
                    break;
                case 'ordens-producao':
                    dados = await this.getOrdensProducao();
                    break;
            }

            // Gerar PDF
            await this.gerarPDF(titulo, dados, tipo);
            
        } catch (error) {
            console.error('Erro ao exportar relatório:', error);
            this.showNotification('Erro ao exportar relatório', 'error');
        }
    }

    async gerarPDF(titulo, dados, tipo) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPosition = 20;
            
            // Título principal
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(titulo, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 15;
            
            // Data de geração
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const now = new Date();
            const dateString = now.toLocaleString('pt-BR');
            doc.text(`Gerado em: ${dateString}`, pageWidth / 2, yPosition, { align: 'center' });
            yPosition += 15;
            
            // Filtros aplicados
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Filtros Aplicados:', 20, yPosition);
            yPosition += 8;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const periodoText = this.getPeriodoTexto(this.filters.periodo);
            doc.text(`• Período: ${periodoText}`, 20, yPosition);
            yPosition += 6;
            
            const maquinaText = this.filters.maquina === 'all' ? 'Todas as máquinas' : this.filters.maquina;
            doc.text(`• Máquina: ${maquinaText}`, 20, yPosition);
            yPosition += 6;
            
            doc.text(`• Indicador: ${this.filters.indicador}`, 20, yPosition);
            yPosition += 6;
            
            const agruparText = {
                'dia': 'Dia',
                'semana': 'Semana',
                'mes': 'Mês',
                'ano': 'Ano'
            }[this.filters.agrupar] || this.filters.agrupar;
            doc.text(`• Agrupar por: ${agruparText}`, 20, yPosition);
            yPosition += 15;
            
            // Conteúdo específico por tipo de relatório
            switch (tipo) {
                case 'oee-evolucao':
                    yPosition = this.addOEEPDF(doc, dados, yPosition, pageWidth, pageHeight);
                    break;
                case 'paradas':
                    yPosition = this.addParadasPDF(doc, dados, yPosition, pageWidth, pageHeight);
                    break;
                case 'desempenho-maquina':
                    yPosition = this.addDesempenhoPDF(doc, dados, yPosition, pageWidth, pageHeight);
                    break;
                case 'perdas-producao':
                    yPosition = this.addPerdasPDF(doc, dados, yPosition, pageWidth, pageHeight);
                    break;
                case 'ordens-producao':
                    yPosition = this.addOrdensPDF(doc, dados, yPosition, pageWidth, pageHeight);
                    break;
                default:
                    doc.setFontSize(10);
                    doc.text('Relatório em desenvolvimento', 20, yPosition);
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
            
            // Salvar PDF
            const fileName = `relatorio_${tipo}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showNotification('PDF exportado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showNotification('Erro ao gerar PDF. Tente novamente.', 'error');
        }
    }

    getPeriodoTexto(periodo) {
        const map = {
            '7': 'Últimos 7 dias',
            '30': 'Últimos 30 dias',
            '90': 'Últimos 90 dias',
            'month': 'Este mês',
            'year': 'Este ano'
        };
        return map[periodo] || periodo;
    }

    addOEEPDF(doc, dados, yPosition, pageWidth, pageHeight) {
        if (dados.labels && dados.labels.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Evolução dos Indicadores:', 20, yPosition);
            yPosition += 10;
            
            // Tabela
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const headers = ['Período', 'OEE', 'Disponibilidade', 'Performance', 'Qualidade'];
            const colWidths = [50, 25, 30, 30, 25];
            let xPos = 20;
            
            headers.forEach((header, idx) => {
                doc.text(header, xPos, yPosition);
                xPos += colWidths[idx];
            });
            yPosition += 5;
            
            doc.line(20, yPosition, pageWidth - 20, yPosition);
            yPosition += 3;
            
            doc.setFont('helvetica', 'normal');
            dados.labels.forEach((label, i) => {
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                xPos = 20;
                doc.text(label.substring(0, 20), xPos, yPosition);
                xPos += colWidths[0];
                doc.text(`${(dados.oee[i] || 0).toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[1];
                doc.text(`${(dados.disponibilidade[i] || 0).toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[2];
                doc.text(`${(dados.performance[i] || 0).toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[3];
                doc.text(`${(dados.qualidade[i] || 0).toFixed(1)}%`, xPos, yPosition);
                
                yPosition += 6;
            });
        } else {
            doc.setFontSize(10);
            doc.text('Nenhum dado disponível para o período selecionado.', 20, yPosition);
            yPosition += 10;
        }
        
        return yPosition;
    }

    addParadasPDF(doc, dados, yPosition, pageWidth, pageHeight) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo Geral:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total de Paradas: ${dados.total}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Tempo Total: ${this.formatTempo(dados.totalTempo)}`, 20, yPosition);
        yPosition += 10;
        
        if (dados.porMotivo && Object.keys(dados.porMotivo).length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Paradas por Motivo:', 20, yPosition);
            yPosition += 10;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const headers = ['Motivo', 'Quantidade', 'Tempo Total'];
            const colWidths = [80, 40, 50];
            let xPos = 20;
            
            headers.forEach((header, idx) => {
                doc.text(header, xPos, yPosition);
                xPos += colWidths[idx];
            });
            yPosition += 5;
            
            doc.line(20, yPosition, pageWidth - 20, yPosition);
            yPosition += 3;
            
            doc.setFont('helvetica', 'normal');
            Object.entries(dados.porMotivo).forEach(([motivo, info]) => {
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                xPos = 20;
                doc.text(motivo.substring(0, 35), xPos, yPosition);
                xPos += colWidths[0];
                doc.text(info.count.toString(), xPos, yPosition);
                xPos += colWidths[1];
                doc.text(this.formatTempo(info.totalTempo), xPos, yPosition);
                
                yPosition += 6;
            });
        }
        
        return yPosition;
    }

    addDesempenhoPDF(doc, dados, yPosition, pageWidth, pageHeight) {
        if (dados.maquinas && dados.maquinas.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Desempenho por Máquina:', 20, yPosition);
            yPosition += 10;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const headers = ['Máquina', 'OEE', 'Disponibilidade', 'Performance', 'Qualidade'];
            const colWidths = [50, 25, 30, 30, 25];
            let xPos = 20;
            
            headers.forEach((header, idx) => {
                doc.text(header, xPos, yPosition);
                xPos += colWidths[idx];
            });
            yPosition += 5;
            
            doc.line(20, yPosition, pageWidth - 20, yPosition);
            yPosition += 3;
            
            doc.setFont('helvetica', 'normal');
            dados.maquinas.forEach(m => {
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                xPos = 20;
                doc.text(m.nome.substring(0, 20), xPos, yPosition);
                xPos += colWidths[0];
                doc.text(`${m.oee.toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[1];
                doc.text(`${m.disponibilidade.toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[2];
                doc.text(`${m.performance.toFixed(1)}%`, xPos, yPosition);
                xPos += colWidths[3];
                doc.text(`${m.qualidade.toFixed(1)}%`, xPos, yPosition);
                
                yPosition += 6;
            });
        }
        
        return yPosition;
    }

    addPerdasPDF(doc, dados, yPosition, pageWidth, pageHeight) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo de Perdas:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Perda de Disponibilidade: ${dados.perdaDisponibilidade.toFixed(1)}%`, 20, yPosition);
        yPosition += 6;
        doc.text(`Perda de Performance: ${dados.perdaPerformance.toFixed(1)}%`, 20, yPosition);
        yPosition += 6;
        doc.text(`Perda de Qualidade: ${dados.perdaQualidade.toFixed(1)}%`, 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total de Paradas: ${dados.totalParadas}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Tempo de Paradas: ${this.formatTempo(dados.tempoParadas)}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Produção Perdida: ${dados.producaoPerdida}`, 20, yPosition);
        
        return yPosition;
    }

    addOrdensPDF(doc, dados, yPosition, pageWidth, pageHeight) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total de Ordens: ${dados.total}`, 20, yPosition);
        yPosition += 10;
        
        if (dados.ordens && Object.keys(dados.ordens).length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Ordens por Máquina:', 20, yPosition);
            yPosition += 10;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const headers = ['Máquina', 'Total', 'Conformes', 'Defeituosos', 'Taxa'];
            const colWidths = [40, 25, 30, 30, 25];
            let xPos =         20;
            
            headers.forEach((header, idx) => {
                doc.text(header, xPos, yPosition);
                xPos += colWidths[idx];
            });
            yPosition += 5;
            
            doc.line(20, yPosition, pageWidth - 20, yPosition);
            yPosition += 3;
            
            doc.setFont('helvetica', 'normal');
            Object.entries(dados.ordens).forEach(([machineId, info]) => {
                if (yPosition > pageHeight - 20) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                const taxa = info.total > 0 ? ((info.conformes / info.total) * 100).toFixed(1) : '0.0';
                
                xPos = 20;
                doc.text(machineId.substring(0, 15), xPos, yPosition);
                xPos += colWidths[0];
                doc.text(info.total.toString(), xPos, yPosition);
                xPos += colWidths[1];
                doc.text(info.conformes.toString(), xPos, yPosition);
                xPos += colWidths[2];
                doc.text(info.defeituosos.toString(), xPos, yPosition);
                xPos += colWidths[3];
                doc.text(`${taxa}%`, xPos, yPosition);
                
                yPosition += 6;
            });
        }
        
        return yPosition;
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
            this.showNotification('Erro de conexão. Tente novamente.', 'error');
            return null;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `message message-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 4000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    handleLogout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
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
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.relatoriosPage = new RelatoriosPage();
});

