// JavaScript para página de Motivos de Descarte
class MotivosDescarte {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.motivos = [];
        this.editingMotivo = null;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredMotivos = [];
        
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
        // Formulário principal
        const motivoForm = document.getElementById('motivoDescarteForm');
        if (motivoForm) {
            motivoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMotivo();
            });
        }

        // Botão limpar formulário
        const limparForm = document.getElementById('limparForm');
        if (limparForm) {
            limparForm.addEventListener('click', () => {
                this.clearForm();
            });
        }

        // Filtros
        const gravidadeFilter = document.getElementById('gravidadeFilter');
        if (gravidadeFilter) {
            gravidadeFilter.addEventListener('change', (e) => {
                this.applyFilters();
            });
        }

        // Busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.applyFilters();
            });
        }

        // Botão de limpar todos os filtros
        const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Botões da tabela
        const refreshTable = document.getElementById('refreshTable');
        if (refreshTable) {
            refreshTable.addEventListener('click', () => {
                this.loadMotivos();
            });
        }

        const exportExcel = document.getElementById('exportExcel');
        if (exportExcel) {
            exportExcel.addEventListener('click', () => {
                this.exportToExcel();
            });
        }

        // Paginação
        const prevPage = document.getElementById('prevPage');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                this.previousPage();
            });
        }

        const nextPage = document.getElementById('nextPage');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                this.nextPage();
            });
        }

        // Modal de edição
        const editModal = document.getElementById('editModal');
        const closeModal = document.getElementById('closeModal');
        const cancelEdit = document.getElementById('cancelEdit');
        const editForm = document.getElementById('editForm');

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        if (cancelEdit) {
            cancelEdit.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEdit();
            });
        }

        // Fechar modal ao clicar fora
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    this.closeEditModal();
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

    // Carregar motivos de descarte
    async loadMotivos() {
        try {
            console.log('🔍 Carregando motivos de descarte...');
            
            const response = await this.makeAuthenticatedRequest('/api/motivos-descarte');
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success && Array.isArray(data.data)) {
                    this.motivos = data.data;
                    this.filteredMotivos = [...this.motivos];
                    console.log('✅ Motivos carregados:', this.motivos.length);
                    this.applyFilters();
                } else {
                    console.error('❌ Formato de dados inesperado:', data);
                    this.motivos = [];
                    this.filteredMotivos = [];
                }
            } else {
                console.error('❌ Erro ao carregar motivos:', response?.status);
                this.motivos = [];
                this.filteredMotivos = [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar motivos:', error);
            this.motivos = [];
            this.filteredMotivos = [];
        }
    }

    // Aplicar filtros
    applyFilters() {
        // Adicionar efeito de loading
        this.showFilterLoading();
        
        // Usar setTimeout para dar feedback visual
        setTimeout(() => {
            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
            const gravidadeFilter = document.getElementById('gravidadeFilter')?.value || 'all';

            this.filteredMotivos = this.motivos.filter(motivo => {
                const matchesSearch = !searchTerm || 
                    motivo.codigo.toLowerCase().includes(searchTerm) ||
                    motivo.nome.toLowerCase().includes(searchTerm) ||
                    motivo.descricao.toLowerCase().includes(searchTerm) ||
                    motivo.classe.toLowerCase().includes(searchTerm);

                const matchesGravidade = gravidadeFilter === 'all' || motivo.gravidade === gravidadeFilter;

                return matchesSearch && matchesGravidade;
            });

            this.currentPage = 1;
            this.updateTable();
            this.updatePagination();
            this.hideFilterLoading();
            
            // Mostrar feedback do resultado
            this.showFilterFeedback();
        }, 300);
    }

    // Mostrar loading nos filtros
    showFilterLoading() {
        const filterGroups = document.querySelectorAll('.filter-group');
        filterGroups.forEach(group => {
            group.classList.add('loading');
        });
    }

    // Esconder loading dos filtros
    hideFilterLoading() {
        const filterGroups = document.querySelectorAll('.filter-group');
        filterGroups.forEach(group => {
            group.classList.remove('loading');
        });
    }

    // Mostrar feedback dos filtros
    showFilterFeedback() {
        const totalResults = this.filteredMotivos.length;
        const totalMotivos = this.motivos.length;
        
        if (totalResults === 0 && totalMotivos > 0) {
            this.showNotification('Nenhum resultado encontrado com os filtros aplicados', 'info');
        } else if (totalResults < totalMotivos) {
            this.showNotification(`${totalResults} de ${totalMotivos} motivos encontrados`, 'success');
        }
    }

    // Limpar todos os filtros
    clearAllFilters() {
        const searchInput = document.getElementById('searchInput');
        const gravidadeFilter = document.getElementById('gravidadeFilter');
        
        if (searchInput) searchInput.value = '';
        if (gravidadeFilter) gravidadeFilter.value = 'all';
        
        this.applyFilters();
        this.showNotification('Todos os filtros foram limpos', 'success');
    }

    // Atualizar tabela
    updateTable() {
        const tbody = document.getElementById('motivosTableBody');
        if (!tbody) return;

        // Limpar tabela
        tbody.innerHTML = '';

        if (this.filteredMotivos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Nenhum motivo encontrado</h3>
                        <p>Não há motivos de descarte que correspondam aos filtros aplicados.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Calcular itens para a página atual
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMotivos = this.filteredMotivos.slice(startIndex, endIndex);

        // Adicionar linhas da tabela
        pageMotivos.forEach(motivo => {
            const row = document.createElement('tr');
            
            const dataCriacao = new Date(motivo.createdAt).toLocaleDateString('pt-BR');
            const classeLabel = this.getClasseLabel(motivo.classe);
            const gravidadeLabel = this.getGravidadeLabel(motivo.gravidade);

            row.innerHTML = `
                <td>${motivo.codigo}</td>
                <td>${motivo.nome}</td>
                <td>
                    <span class="classe-badge">${classeLabel}</span>
                </td>
                <td>
                    <span class="gravidade-badge ${motivo.gravidade}">${gravidadeLabel}</span>
                </td>
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

    // Obter label da classe
    getClasseLabel(classe) {
        return classe || 'Não informado';
    }

    // Obter label da gravidade
    getGravidadeLabel(gravidade) {
        const labels = {
            baixa: 'Baixa',
            media: 'Média',
            alta: 'Alta',
            critica: 'Crítica'
        };
        return labels[gravidade] || gravidade;
    }

    // Limpar formulário
    clearForm() {
        const form = document.getElementById('motivoDescarteForm');
        if (form) {
            form.reset();
            // Limpar campo de código
            const codigoInput = document.getElementById('codigoMotivo');
            if (codigoInput) {
                codigoInput.value = '';
            }
            // Gerar código automático
            this.generateAutoCode();
        }
    }

    // Gerar código automático
    generateAutoCode() {
        const codigoInput = document.getElementById('codigoMotivo');
        const nomeInput = document.getElementById('nomeMotivo');
        
        if (codigoInput && nomeInput) {
            // Gerar código automaticamente quando o nome for digitado
            nomeInput.addEventListener('input', () => {
                this.generateCodeFromName(nomeInput.value);
            });
            
            // Gerar código inicial se já houver nome
            if (nomeInput.value) {
                this.generateCodeFromName(nomeInput.value);
            }
        }
    }

    // Gerar código baseado no nome
    generateCodeFromName(nome) {
        const codigoInput = document.getElementById('codigoMotivo');
        if (!codigoInput || !nome) return;

        // Limpar e normalizar o nome
        const nomeLimpo = nome.trim().toUpperCase();
        
        if (nomeLimpo.length >= 2) {
            // Pegar as primeiras 3 letras do nome
            let baseCode = nomeLimpo.substring(0, 3);
            
            // Remover caracteres especiais e manter apenas letras
            baseCode = baseCode.replace(/[^A-Z]/g, '');
            
            // Se não tiver letras suficientes, usar "DESC"
            if (baseCode.length < 2) {
                baseCode = 'DESC';
            }
            
            // Gerar número sequencial baseado nos motivos existentes
            const numeroSequencial = this.getNextSequentialNumber(baseCode);
            
            // Definir o código
            codigoInput.value = `${baseCode}${numeroSequencial.toString().padStart(2, '0')}`;
        }
    }

    // Obter próximo número sequencial para o código base
    getNextSequentialNumber(baseCode) {
        if (!this.motivos || this.motivos.length === 0) {
            return 1;
        }

        // Filtrar motivos que começam com o mesmo código base
        const motivosComMesmoBase = this.motivos.filter(motivo => 
            motivo.codigo && motivo.codigo.startsWith(baseCode)
        );

        if (motivosComMesmoBase.length === 0) {
            return 1;
        }

        // Extrair números dos códigos existentes
        const numerosExistentes = motivosComMesmoBase.map(motivo => {
            const match = motivo.codigo.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
        });

        // Encontrar o próximo número disponível
        const maxNumero = Math.max(...numerosExistentes);
        return maxNumero + 1;
    }

    // Salvar motivo
    async saveMotivo() {
        try {
            const formData = new FormData(document.getElementById('motivoDescarteForm'));
            
            // Validar dados antes de enviar
            const nome = formData.get('nome')?.trim();
            const classe = formData.get('classe')?.trim();
            const descricao = formData.get('descricao')?.trim();
            const gravidade = formData.get('gravidade')?.trim();
            
            // Validação client-side
            if (!nome) {
                this.showNotification('Nome é obrigatório', 'error');
                return;
            }
            
            if (!classe) {
                this.showNotification('Classe é obrigatória', 'error');
                return;
            }
            
            if (!gravidade) {
                this.showNotification('Gravidade é obrigatória', 'error');
                return;
            }
            
            const motivoData = {
                nome,
                classe,
                descricao: descricao || '',
                gravidade
            };

            // Só incluir código se foi preenchido manualmente
            const codigo = formData.get('codigo');
            if (codigo && codigo.trim()) {
                motivoData.codigo = codigo.trim();
            }

            console.log('💾 Salvando motivo:', motivoData);
            console.log('📋 Dados do formulário:', {
                nome,
                classe,
                descricao,
                gravidade,
                codigo: formData.get('codigo')
            });

            const response = await this.makeAuthenticatedRequest('/api/motivos-descarte', {
                method: 'POST',
                body: JSON.stringify(motivoData)
            });

            if (response && response.ok) {
                const data = await response.json();
                this.showNotification('Motivo de descarte criado com sucesso!', 'success');
                this.clearForm();
                this.loadMotivos();
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.showNotification(errorData.message || 'Erro ao salvar motivo', 'error');
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
            this.openEditModal(motivo);
        } else {
            console.error('❌ Motivo não encontrado:', motivoId);
            this.showNotification('Motivo não encontrado', 'error');
        }
    }

    // Abrir modal de edição
    openEditModal(motivo) {
        const modal = document.getElementById('editModal');
        if (!modal) return;

        // Preencher formulário
        document.getElementById('editId').value = motivo._id;
        document.getElementById('editCodigo').value = motivo.codigo;
        document.getElementById('editNome').value = motivo.nome;
        document.getElementById('editClasse').value = motivo.classe;
        document.getElementById('editGravidade').value = motivo.gravidade;
        document.getElementById('editDescricao').value = motivo.descricao;

        // Configurar geração automática de código para edição
        this.setupEditCodeGeneration();

        modal.style.display = 'flex';
    }

    // Configurar geração automática de código para edição
    setupEditCodeGeneration() {
        const editNomeInput = document.getElementById('editNome');
        const editCodigoInput = document.getElementById('editCodigo');
        
        if (editNomeInput && editCodigoInput) {
            // Remover listeners anteriores
            editNomeInput.removeEventListener('input', this.handleEditNameChange);
            
            // Adicionar novo listener
            this.handleEditNameChange = () => {
                // Só gerar código se o campo estiver vazio ou se o usuário não tiver modificado manualmente
                if (!editCodigoInput.dataset.manualEdit) {
                    this.generateCodeFromName(editNomeInput.value);
                }
            };
            
            editNomeInput.addEventListener('input', this.handleEditNameChange);
            
            // Marcar como edição manual quando o usuário digitar no código
            editCodigoInput.addEventListener('input', () => {
                editCodigoInput.dataset.manualEdit = 'true';
            });
        }
    }

    // Fechar modal de edição
    closeEditModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Salvar edição
    async saveEdit() {
        try {
            const formData = new FormData(document.getElementById('editForm'));
            const motivoId = formData.get('id');
            const motivoData = {
                nome: formData.get('nome'),
                classe: formData.get('classe'),
                descricao: formData.get('descricao'),
                gravidade: formData.get('gravidade')
            };

            // Só incluir código se foi preenchido
            const codigo = formData.get('codigo');
            if (codigo && codigo.trim()) {
                motivoData.codigo = codigo.trim();
            }

            console.log('💾 Salvando edição:', motivoId, motivoData);

            const response = await this.makeAuthenticatedRequest(`/api/motivos-descarte/${motivoId}`, {
                method: 'PUT',
                body: JSON.stringify(motivoData)
            });

            if (response && response.ok) {
                this.showNotification('Motivo de descarte atualizado com sucesso!', 'success');
                this.closeEditModal();
                this.loadMotivos();
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.showNotification(errorData.message || 'Erro ao atualizar motivo', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            this.showNotification('Erro ao atualizar motivo', 'error');
        }
    }

    // Excluir motivo
    async deleteMotivo(motivoId) {
        console.log('🗑️ Excluindo motivo:', motivoId);
        if (confirm('Tem certeza que deseja excluir este motivo de descarte?')) {
            try {
                console.log('🔄 Enviando requisição de exclusão...');
                const response = await this.makeAuthenticatedRequest(`/api/motivos-descarte/${motivoId}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    console.log('✅ Motivo excluído com sucesso');
                    this.showNotification('Motivo excluído com sucesso!', 'success');
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

    // Atualizar paginação
    updatePagination() {
        const totalItems = this.filteredMotivos.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        // Atualizar informações de paginação
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = `Mostrando ${startItem} até ${endItem} de ${totalItems} registros`;
        }

        // Atualizar botões
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }
    }

    // Página anterior
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateTable();
            this.updatePagination();
        }
    }

    // Próxima página
    nextPage() {
        const totalPages = Math.ceil(this.filteredMotivos.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateTable();
            this.updatePagination();
        }
    }

    // Exportar para Excel
    exportToExcel() {
        if (this.filteredMotivos.length === 0) {
            this.showNotification('Não há dados para exportar', 'warning');
            return;
        }

        // Criar dados CSV
        const headers = ['Código', 'Nome', 'Classe', 'Gravidade', 'Descrição', 'Data Criação'];
        const csvData = [
            headers.join(','),
            ...this.filteredMotivos.map(motivo => [
                motivo.codigo,
                `"${motivo.nome}"`,
                this.getClasseLabel(motivo.classe),
                this.getGravidadeLabel(motivo.gravidade),
                `"${motivo.descricao}"`,
                new Date(motivo.createdAt).toLocaleDateString('pt-BR')
            ].join(','))
        ].join('\n');

        // Criar e baixar arquivo
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `motivos_descarte_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Arquivo exportado com sucesso!', 'success');
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
    window.motivosDescarte = new MotivosDescarte();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.motivosDescarte) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});
