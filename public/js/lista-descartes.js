// Lista de Descartes JavaScript
class ListaDescartes {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.descartes = [];
        this.motivosDescarte = [];
        this.maquinas = [];
        this.chart = null;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadInitialData();
        this.initializeChart();
        this.updateTimestamp();
        this.startTimestampTimer();
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

    setupEventListeners() {
        // Filtros
        document.getElementById('machineFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('severityFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('periodFilter').addEventListener('change', () => this.applyFilters());
        
        // Busca
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        
        // Botões
        document.getElementById('addDescarteBtn').addEventListener('click', () => this.openModal());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        
        // Modal
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelModal').addEventListener('click', () => this.closeModal());
        document.getElementById('descarteForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Fechar modal ao clicar fora
        document.getElementById('descarteModal').addEventListener('click', (e) => {
            if (e.target.id === 'descarteModal') {
                this.closeModal();
            }
        });
        
        // Botão de logout
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Botão de menu mobile
        const menuToggle = document.querySelector('.menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => this.toggleSidebar());
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

        // Event delegation para botões de ação da tabela
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit')) {
                const button = e.target.closest('.btn-edit');
                const descarteId = button.dataset.descarteId;
                if (descarteId) {
                    this.editDescarte(descarteId);
                }
            } else if (e.target.closest('.btn-delete')) {
                const button = e.target.closest('.btn-delete');
                const descarteId = button.dataset.descarteId;
                if (descarteId) {
                    this.deleteDescarte(descarteId);
                }
            }
        });
    }

    async loadInitialData() {
        try {
            // Inicializar com arrays vazios
            this.descartes = [];
            this.motivosDescarte = [];
            this.maquinas = [];

            // Carregar dados reais da API
            await this.loadDescartesFromAPI();
            await this.loadMotivosFromAPI();
            await this.loadMaquinasFromAPI();

            this.updateTable();
            this.updateSummaryCards();
            this.updateChart();
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showNotification('Erro ao carregar dados', 'error');
        }
    }

    async loadDescartesFromAPI() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/descartes');
            if (response && response.ok) {
                const data = await response.json();
                this.descartes = data.data || [];
            }
        } catch (error) {
            console.error('Erro ao carregar descartes da API:', error);
            this.descartes = [];
        }
    }

    async loadMotivosFromAPI() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/motivos-descarte');
            if (response && response.ok) {
                const data = await response.json();
                this.motivosDescarte = data.data || [];
                console.log('Motivos de descarte carregados:', this.motivosDescarte);
                
                // Atualizar o select de motivos no modal
                this.populateMotivosSelect();
            }
        } catch (error) {
            console.error('Erro ao carregar motivos da API:', error);
            this.motivosDescarte = [];
        }
    }

    populateMotivosSelect() {
        const motivoSelect = document.getElementById('modalMotivo');
        
        if (motivoSelect) {
            // Limpar opções existentes (exceto a primeira)
            motivoSelect.innerHTML = '<option value="">Selecione um motivo</option>';
            
            this.motivosDescarte.forEach(motivo => {
                const option = document.createElement('option');
                option.value = motivo._id; // Usar o ID do motivo
                const codigo = motivo && motivo.codigo ? `${motivo.codigo}` : '';
                const nome = motivo && motivo.nome ? `${motivo.nome}` : '';
                const partes = [codigo, nome].filter(Boolean);
                option.textContent = partes.length > 0 ? partes.join(' - ') : 'Motivo';
                motivoSelect.appendChild(option);
            });
        }
    }

    async loadMaquinasFromAPI() {
        try {
            console.log('Tentando carregar máquinas...');
            const response = await this.makeAuthenticatedRequest('/api/auth/maquinas-operador');
            console.log('Resposta da API de máquinas:', response);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Dados recebidos da API:', data);
                this.maquinas = data.data || [];
                console.log('Máquinas carregadas:', this.maquinas);
                
                // Atualizar o select de máquinas no modal
                this.populateMachineSelect();
            } else {
                console.error('Erro na resposta da API:', response);
                if (response) {
                    const errorData = await response.json();
                    console.error('Detalhes do erro:', errorData);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar máquinas da API:', error);
            this.maquinas = [];
        }
    }

    populateMachineSelect() {
        console.log('Populando selects de máquinas...');
        const machineSelect = document.getElementById('modalMachine');
        const machineFilter = document.getElementById('machineFilter');
        
        console.log('Elementos encontrados:', { machineSelect, machineFilter });
        console.log('Máquinas disponíveis:', this.maquinas);
        
        if (machineSelect) {
            // Limpar opções existentes (exceto a primeira)
            machineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
            
            this.maquinas.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine && machine.machineId ? machine.machineId : '';
                const id = machine && machine.machineId ? `${machine.machineId}` : '';
                const nome = machine && machine.nome ? `${machine.nome}` : '';
                const partes = [id, nome].filter(Boolean);
                option.textContent = partes.length > 0 ? partes.join(' - ') : 'Máquina';
                machineSelect.appendChild(option);
                console.log('Adicionada opção:', option.textContent);
            });
        }
        
        if (machineFilter) {
            // Limpar opções existentes (exceto a primeira)
            machineFilter.innerHTML = '<option value="">Todas as Máquinas</option>';
            
            this.maquinas.forEach(machine => {
                const option = document.createElement('option');
                option.value = machine && machine.machineId ? machine.machineId : '';
                const id = machine && machine.machineId ? `${machine.machineId}` : '';
                const nome = machine && machine.nome ? `${machine.nome}` : '';
                const partes = [id, nome].filter(Boolean);
                option.textContent = partes.length > 0 ? partes.join(' - ') : 'Máquina';
                machineFilter.appendChild(option);
                console.log('Adicionada opção no filtro:', option.textContent);
            });
        }
        
        console.log('Selects de máquinas populados com sucesso');
    }

    initializeChart() {
        const ctx = document.getElementById('descarteChart');
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;

        // Agrupar descartes por motivo
        const motivoCounts = {};
        this.descartes.forEach(descarte => {
            const motivo = descarte.motivo;
            motivoCounts[motivo] = (motivoCounts[motivo] || 0) + descarte.quantidade;
        });

        const labels = Object.keys(motivoCounts);
        const data = Object.values(motivoCounts);
        const colors = labels.map(motivo => {
            const motivoObj = this.motivosDescarte.find(m => m.nome === motivo);
            return motivoObj ? motivoObj.cor : '#6b7280';
        });

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.data.datasets[0].backgroundColor = colors;
        this.chart.update();
    }

    updateTable() {
        const tbody = document.getElementById('descarteTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.descartes.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="9" class="empty-state">
                    <div style="text-align: center; padding: 2rem; color: #6b7280;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Nenhum descarte registrado ainda</p>
                        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Clique em "Registrar Descarte" para adicionar o primeiro</p>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            return;
        }

        this.descartes.forEach(descarte => {
            // Buscar o motivo pelo nome (não pelo ID, pois o motivo é salvo como string)
            const motivo = this.motivosDescarte.find(m => m.nome === descarte.motivo);
            const motivoNome = motivo ? `${motivo.codigo} - ${motivo.nome}` : 'Motivo não encontrado';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(descarte.dataHora).toLocaleString('pt-BR')}</td>
                <td>${descarte.maquina}</td>
                <td>${descarte.categoria || '-'}</td>
                <td>${motivoNome}</td>
                <td>${descarte.quantidade}</td>
                <td><span class="severity-badge ${descarte.severidade}">${this.capitalizeFirst(descarte.severidade)}</span></td>
                <td>${descarte.registradoPor?.nome || 'N/A'}</td>
                <td>${descarte.descricao || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" title="Editar" data-descarte-id="${descarte._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" title="Excluir" data-descarte-id="${descarte._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateSummaryCards() {
        const totalDescartes = this.descartes.reduce((sum, descarte) => sum + descarte.quantidade, 0);
        document.getElementById('totalDescartes').textContent = totalDescartes;
    }

    applyFilters() {
        // Verificar se os dados foram carregados
        if (!this.descartes || this.descartes.length === 0) {
            console.log('Dados ainda não carregados, ignorando filtros');
            return;
        }

        const machineFilter = document.getElementById('machineFilter').value;
        const severityFilter = document.getElementById('severityFilter').value;
        const periodFilter = document.getElementById('periodFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        let filteredDescartes = [...this.descartes];

        // Filtrar por máquina
        if (machineFilter) {
            filteredDescartes = filteredDescartes.filter(descarte => 
                descarte.maquina === machineFilter
            );
        }

        // Filtrar por severidade
        if (severityFilter) {
            filteredDescartes = filteredDescartes.filter(descarte => 
                descarte.severidade === severityFilter
            );
        }

        // Filtrar por período (implementação básica)
        if (periodFilter) {
            // Aqui você implementaria a lógica de filtro por período
            // Por enquanto, mantém todos os dados
        }

        // Filtrar por busca
        if (searchTerm) {
            filteredDescartes = filteredDescartes.filter(descarte => 
                descarte.maquina.toLowerCase().includes(searchTerm) ||
                descarte.motivo.toLowerCase().includes(searchTerm) ||
                descarte.categoria.toLowerCase().includes(searchTerm)
            );
        }

        // Atualizar tabela com dados filtrados
        this.updateTableWithData(filteredDescartes);
    }

    updateTableWithData(data) {
        const tbody = document.getElementById('descarteTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="9" class="empty-state">
                    <div style="text-align: center; padding: 2rem; color: #6b7280;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Nenhum descarte encontrado com os filtros aplicados</p>
                        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Tente ajustar os filtros ou limpar a busca</p>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            return;
        }

        data.forEach(descarte => {
            // Buscar o motivo pelo nome (não pelo ID, pois o motivo é salvo como string)
            const motivo = this.motivosDescarte.find(m => m.nome === descarte.motivo);
            const motivoNome = motivo ? `${motivo.codigo} - ${motivo.nome}` : 'Motivo não encontrado';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(descarte.dataHora).toLocaleString('pt-BR')}</td>
                <td>${descarte.maquina}</td>
                <td>${descarte.categoria || '-'}</td>
                <td>${motivoNome}</td>
                <td>${descarte.quantidade}</td>
                <td><span class="severity-badge ${descarte.severidade}">${this.capitalizeFirst(descarte.severidade)}</span></td>
                <td>${descarte.registradoPor?.nome || 'N/A'}</td>
                <td>${descarte.descricao || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" title="Editar" data-descarte-id="${descarte._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" title="Excluir" data-descarte-id="${descarte._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    openModal(descarteId = null) {
        const modal = document.getElementById('descarteModal');
        const form = document.getElementById('descarteForm');
        const modalTitle = modal.querySelector('h3');
        
        // Limpar formulário
        form.reset();
        
        // Se for edição, preencher dados
        if (descarteId) {
            const descarte = this.descartes.find(d => d._id === descarteId);
            if (descarte) {
                // Buscar o motivo pelo nome para encontrar o ID
                const motivo = this.motivosDescarte.find(m => m.nome === descarte.motivo);
                
                document.getElementById('modalMachine').value = descarte.maquina;
                document.getElementById('modalMotivo').value = motivo ? motivo._id : '';
                document.getElementById('modalQuantidade').value = descarte.quantidade;
                document.getElementById('modalSeveridade').value = descarte.severidade;
                document.getElementById('modalDescricao').value = descarte.descricao || '';
                
                // Alterar título do modal
                modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Descarte';
                
                // Armazenar ID do descarte para edição
                form.dataset.descarteId = descarteId;
            }
        } else {
            // Alterar título do modal para criação
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Registrar Descarte';
            
            // Remover ID do descarte
            delete form.dataset.descarteId;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('descarteModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const descarteId = form.dataset.descarteId;
        const isEditing = !!descarteId;
        
        // Obter valores dos campos
        const maquinaId = document.getElementById('modalMachine').value;
        const motivoId = document.getElementById('modalMotivo').value;
        const quantidade = parseInt(document.getElementById('modalQuantidade').value);
        const severidade = document.getElementById('modalSeveridade').value;
        const descricao = document.getElementById('modalDescricao').value;
        
        // Validações básicas
        if (!maquinaId || !motivoId || !quantidade || !severidade) {
            this.showNotification('Todos os campos obrigatórios devem ser preenchidos', 'error');
            return;
        }
        
        // Buscar dados da máquina e motivo selecionados
        const maquinaSelecionada = this.maquinas.find(m => m.machineId === maquinaId);
        const motivoSelecionado = this.motivosDescarte.find(m => m._id === motivoId);
        
        if (!maquinaSelecionada) {
            this.showNotification('Máquina selecionada não encontrada', 'error');
            return;
        }
        
        if (!motivoSelecionado) {
            this.showNotification('Motivo selecionado não encontrado', 'error');
            return;
        }
        
        // Preparar dados para envio
        const formData = {
            maquina: maquinaSelecionada.machineId, // Enviar o machineId como string
            categoria: motivoSelecionado.classe, // Usar a classe do motivo como categoria
            motivo: motivoSelecionado.nome, // Enviar o nome do motivo como string
            quantidade: quantidade,
            severidade: severidade.toLowerCase(), // Converter para lowercase
            descricao: descricao.trim()
        };

        console.log('Dados a serem enviados:', formData);

        try {
            let response;
            let url = '/api/descartes';
            let method = 'POST';
            
            if (isEditing) {
                url = `/api/descartes/${descarteId}`;
                method = 'PUT';
            }
            
            response = await this.makeAuthenticatedRequest(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response && response.ok) {
                const data = await response.json();
                console.log('Descarte salvo com sucesso:', data);
                
                // Recarregar dados da API
                await this.loadDescartesFromAPI();
                this.updateTable();
                this.updateSummaryCards();
                this.updateChart();
                this.closeModal();
                
                const message = isEditing ? 'Descarte atualizado com sucesso!' : 'Descarte registrado com sucesso!';
                this.showNotification(message, 'success');
            } else {
                const errorData = await response.json();
                console.error('Erro ao salvar descarte:', errorData);
                this.showNotification(errorData.message || 'Erro ao registrar descarte', 'error');
            }
            
        } catch (error) {
            console.error('Erro ao salvar descarte:', error);
            this.showNotification('Erro ao registrar descarte', 'error');
        }
    }

    editDescarte(id) {
        this.openModal(id);
    }

    async deleteDescarte(id) {
        if (confirm('Tem certeza que deseja excluir este descarte?')) {
            try {
                const response = await this.makeAuthenticatedRequest(`/api/descartes/${id}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    // Recarregar dados da API
                    await this.loadDescartesFromAPI();
                    this.updateTable();
                    this.updateSummaryCards();
                    this.updateChart();
                    this.showNotification('Descarte excluído com sucesso!', 'success');
                } else {
                    const errorData = await response.json();
                    this.showNotification(errorData.message || 'Erro ao excluir descarte', 'error');
                }
            } catch (error) {
                console.error('Erro ao excluir descarte:', error);
                this.showNotification('Erro ao excluir descarte', 'error');
            }
        }
    }

    async exportData() {
        try {
            // Obter filtros atuais
            const machineFilter = document.getElementById('machineFilter').value;
            const severityFilter = document.getElementById('severityFilter').value;
            const periodFilter = document.getElementById('periodFilter').value;
            
            // Construir query string para filtros
            const params = new URLSearchParams();
            if (machineFilter) params.append('maquina', machineFilter);
            if (severityFilter) params.append('severidade', severityFilter);
            if (periodFilter) params.append('periodo', periodFilter);
            
            const queryString = params.toString();
            const url = `/api/descartes/export/csv${queryString ? '?' + queryString : ''}`;
            
            // Fazer download direto do arquivo CSV
            const link = document.createElement('a');
            link.href = url;
            link.download = `descartes_${new Date().toISOString().split('T')[0]}.csv`;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Dados exportados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            this.showNotification('Erro ao exportar dados', 'error');
        }
    }


    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }

    handleLogout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            this.showNotification('Saindo do sistema...');
            // Limpar dados de autenticação
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    }

    showNotification(message, type = 'info') {
        const statusMessage = document.querySelector('.status-message');
        if (!statusMessage) return;

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        statusMessage.innerHTML = `
            <div style="background: ${colors[type]}; color: white; padding: 1rem; border-radius: 8px; text-align: center;">
                ${message}
            </div>
        `;
        statusMessage.classList.add('show');

        // Remove após 3 segundos
        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
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
            timestampElement.style.cssText = 'font-size: 0.8rem; color: white; margin-left: 1rem;';
            headerRight.appendChild(timestampElement);
        }

        timestampElement.textContent = `Última atualização: ${timeString}`;
    }

    startTimestampTimer() {
        // Atualiza o timestamp a cada segundo (1000ms)
        setInterval(() => {
            this.updateTimestamp();
        }, 1000);
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
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.listaDescartes = new ListaDescartes();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.listaDescartes) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});
