// JavaScript para página de Motivos de Parada
class MotivosParada {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.motivos = [];
        this.editingMotivo = null;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadMotivos();
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
        // Filtro de classe
        const classeFilter = document.getElementById('classeFilter');
        if (classeFilter) {
            classeFilter.addEventListener('change', (e) => {
                this.filterByClasse(e.target.value);
            });
        }

        // Busca de motivo
        const searchMotivo = document.getElementById('searchMotivo');
        if (searchMotivo) {
            searchMotivo.addEventListener('input', (e) => {
                this.searchMotivos(e.target.value);
            });
        }

        // Botão novo motivo
        const novoMotivoBtn = document.getElementById('novoMotivoBtn');
        if (novoMotivoBtn) {
            novoMotivoBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        // Modal
        const modal = document.getElementById('motivoModal');
        const closeModal = document.getElementById('closeModal');
        const cancelMotivo = document.getElementById('cancelMotivo');
        const motivoForm = document.getElementById('motivoForm');

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (cancelMotivo) {
            cancelMotivo.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (motivoForm) {
            motivoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMotivo();
            });
        }

        // Fechar modal ao clicar fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
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

    // Carregar motivos de parada
    async loadMotivos() {
        try {
            console.log('🔍 Carregando motivos de parada...');
            
            const response = await this.makeAuthenticatedRequest('/api/motivos-parada');
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success && Array.isArray(data.data)) {
                    this.motivos = data.data;
                    console.log('✅ Motivos carregados:', this.motivos.length);
                    this.updateTable();
                    this.updateSummaryCards();
                } else {
                    console.error('❌ Formato de dados inesperado:', data);
                    this.motivos = [];
                }
            } else {
                console.error('❌ Erro ao carregar motivos:', response?.status);
                this.motivos = [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar motivos:', error);
            this.motivos = [];
        }
    }

    // Atualizar tabela
    updateTable() {
        const tbody = document.getElementById('motivosTableBody');
        if (!tbody) return;

        // Limpar tabela
        tbody.innerHTML = '';

        if (this.motivos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhum motivo cadastrado</h3>
                        <p>Clique em "Novo Motivo" para adicionar o primeiro motivo de parada.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Adicionar linhas da tabela
        this.motivos.forEach(motivo => {
            const row = document.createElement('tr');
            
            const dataCriacao = new Date(motivo.createdAt).toLocaleDateString('pt-BR');
            const classeLabel = this.getClasseLabel(motivo.classe);

            row.innerHTML = `
                <td>${motivo._id.slice(-6)}</td>
                <td>
                    <div class="motivo-info">
                        <span class="motivo-nome">${motivo.nome}</span>
                        <span class="motivo-cor" style="background-color: ${motivo.cor}"></span>
                    </div>
                </td>
                <td>
                    <span class="classe-badge ${motivo.classe}">${classeLabel}</span>
                </td>
                <td class="descricao-cell">${motivo.descricao}</td>
                <td>${dataCriacao}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-motivo-id="${motivo._id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-motivo-id="${motivo._id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Adicionar event listeners para os botões de ação
        this.addActionButtonListeners();
    }

    // Adicionar event listeners para os botões de ação
    addActionButtonListeners() {
        // Botões de editar
        const editButtons = document.querySelectorAll('.btn-edit');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const motivoId = button.getAttribute('data-motivo-id');
                console.log('🔧 Botão editar clicado:', motivoId);
                this.editMotivo(motivoId);
            });
        });

        // Botões de excluir
        const deleteButtons = document.querySelectorAll('.btn-delete');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const motivoId = button.getAttribute('data-motivo-id');
                console.log('🗑️ Botão excluir clicado:', motivoId);
                this.deleteMotivo(motivoId);
            });
        });

        console.log(`✅ Event listeners adicionados: ${editButtons.length} editar, ${deleteButtons.length} excluir`);
    }

    // Atualizar cards de resumo
    updateSummaryCards() {
        const counts = {
            equipamento: 0,
            processo: 0,
            operacional: 0,
            organizacional: 0
        };

        this.motivos.forEach(motivo => {
            if (motivo.ativo && counts.hasOwnProperty(motivo.classe)) {
                counts[motivo.classe]++;
            }
        });

        // Atualizar contadores
        document.getElementById('countEquipamento').textContent = counts.equipamento;
        document.getElementById('countProcesso').textContent = counts.processo;
        document.getElementById('countOperacional').textContent = counts.operacional;
        document.getElementById('countOrganizacional').textContent = counts.organizacional;
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

    // Filtrar por classe
    filterByClasse(classe) {
        const rows = document.querySelectorAll('#motivosTableBody tr');
        
        rows.forEach(row => {
            if (classe === 'all') {
                row.style.display = '';
            } else {
                const classeCell = row.querySelector('.classe-badge');
                if (classeCell && classeCell.classList.contains(classe)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    // Buscar motivos
    searchMotivos(searchTerm) {
        const rows = document.querySelectorAll('#motivosTableBody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const nomeCell = row.querySelector('.motivo-nome');
            const descricaoCell = row.querySelector('.descricao-cell');
            
            if (nomeCell && descricaoCell) {
                const nome = nomeCell.textContent.toLowerCase();
                const descricao = descricaoCell.textContent.toLowerCase();
                
                if (nome.includes(term) || descricao.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    // Abrir modal
    openModal(motivo = null) {
        console.log('📝 Abrindo modal:', motivo ? 'Edição' : 'Novo');
        const modal = document.getElementById('motivoModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('motivoForm');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            this.showNotification('Erro: Modal não encontrado', 'error');
            return;
        }
        
        if (motivo) {
            // Editar motivo existente
            console.log('✏️ Editando motivo:', motivo);
            modalTitle.textContent = 'Editar Motivo de Parada';
            this.editingMotivo = motivo;
            
            document.getElementById('motivoNome').value = motivo.nome;
            document.getElementById('motivoClasse').value = motivo.classe;
            document.getElementById('motivoDescricao').value = motivo.descricao;
            document.getElementById('motivoCor').value = motivo.cor;
        } else {
            // Novo motivo
            console.log('➕ Criando novo motivo');
            modalTitle.textContent = 'Novo Motivo de Parada';
            this.editingMotivo = null;
            form.reset();
            document.getElementById('motivoCor').value = '#3b82f6';
        }
        
        modal.style.display = 'flex';
        console.log('✅ Modal aberto');
    }

    // Fechar modal
    closeModal() {
        const modal = document.getElementById('motivoModal');
        modal.style.display = 'none';
        this.editingMotivo = null;
    }

    // Salvar motivo
    async saveMotivo() {
        try {
            const formData = new FormData(document.getElementById('motivoForm'));
            const motivoData = {
                nome: formData.get('nome'),
                classe: formData.get('classe'),
                descricao: formData.get('descricao'),
                cor: formData.get('cor')
            };

            let response;
            if (this.editingMotivo) {
                // Editar motivo existente
                response = await this.makeAuthenticatedRequest(`/api/motivos-parada/${this.editingMotivo._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(motivoData)
                });
            } else {
                // Criar novo motivo
                response = await this.makeAuthenticatedRequest('/api/motivos-parada', {
                    method: 'POST',
                    body: JSON.stringify(motivoData)
                });
            }

            if (response && response.ok) {
                const data = await response.json();
                this.showNotification(
                    this.editingMotivo ? 'Motivo atualizado com sucesso!' : 'Motivo criado com sucesso!',
                    'success'
                );
                this.closeModal();
                this.loadMotivos();
            } else {
                this.showNotification('Erro ao salvar motivo', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar motivo:', error);
            this.showNotification('Erro ao salvar motivo', 'error');
        }
    }

    // Editar motivo
    editMotivo(motivoId) {
        console.log('🔧 Editando motivo:', motivoId);
        const motivo = this.motivos.find(m => m._id === motivoId);
        if (motivo) {
            console.log('✅ Motivo encontrado:', motivo);
            this.openModal(motivo);
        } else {
            console.error('❌ Motivo não encontrado:', motivoId);
            this.showNotification('Motivo não encontrado', 'error');
        }
    }

    // Excluir motivo
    async deleteMotivo(motivoId) {
        console.log('🗑️ Excluindo motivo:', motivoId);
        if (confirm('Tem certeza que deseja excluir este motivo de parada?')) {
            try {
                console.log('🔄 Enviando requisição de exclusão...');
                const response = await this.makeAuthenticatedRequest(`/api/motivos-parada/${motivoId}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    console.log('✅ Motivo excluído com sucesso');
                    this.showNotification('Motivo excluído com sucesso!', 'success');
                    // Recarregar a lista para atualizar os dados
                    await this.loadMotivos();
                } else {
                    console.error('❌ Erro ao excluir motivo:', response?.status);
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Detalhes do erro:', errorData);
                    this.showNotification('Erro ao excluir motivo', 'error');
                }
            } catch (error) {
                console.error('❌ Erro ao excluir motivo:', error);
                this.showNotification('Erro ao excluir motivo', 'error');
            }
        }
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
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.motivosParada = new MotivosParada();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.motivosParada) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});
