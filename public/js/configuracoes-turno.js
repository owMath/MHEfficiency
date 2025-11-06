// JavaScript para página de Configurações de Turno
class ConfiguracoesTurno {
    constructor() {
        if (!this.checkAuth()) {
            return;
        }

        this.user = JSON.parse(localStorage.getItem('user'));
        this.turnos = [];
        this.editingTurno = null;
        
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.loadTurnos();
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
            userName.textContent = this.user.nome;
        }
    }

    setupEventListeners() {
        // Filtro de status
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterByStatus(e.target.value);
            });
        }

        // Busca de turno
        const searchTurno = document.getElementById('searchTurno');
        if (searchTurno) {
            searchTurno.addEventListener('input', (e) => {
                this.searchTurnos(e.target.value);
            });
        }

        // Botão novo turno
        const novoTurnoBtn = document.getElementById('novoTurnoBtn');
        if (novoTurnoBtn) {
            novoTurnoBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        // Modal
        const modal = document.getElementById('turnoModal');
        const closeModal = document.getElementById('closeModal');
        const cancelTurno = document.getElementById('cancelTurno');
        const turnoForm = document.getElementById('turnoForm');

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (cancelTurno) {
            cancelTurno.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (turnoForm) {
            turnoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTurno();
            });
        }

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

        // Fechar sidebar ao clicar fora
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

    async loadTurnos() {
        try {
            console.log('🔍 Carregando turnos...');
            
            const response = await this.makeAuthenticatedRequest('/api/turnos');
            if (response && response.ok) {
                const data = await response.json();
                
                if (data.success && Array.isArray(data.data)) {
                    this.turnos = data.data;
                    console.log('✅ Turnos carregados:', this.turnos.length);
                    this.updateTable();
                } else {
                    console.error('❌ Formato de dados inesperado:', data);
                    this.turnos = [];
                }
            } else {
                console.error('❌ Erro ao carregar turnos:', response?.status);
                this.turnos = [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar turnos:', error);
            this.turnos = [];
            this.updateTable();
        }
    }

    updateTable() {
        const tbody = document.getElementById('turnosTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.turnos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-clock"></i>
                        <h3>Nenhum turno encontrado</h3>
                    </td>
                </tr>
            `;
            return;
        }

        this.turnos.forEach(turno => {
            const row = document.createElement('tr');
            const diasSemanaTexto = this.formatDiasSemana(turno.diasSemana);

            row.innerHTML = `
                <td>${turno.nome}</td>
                <td>${turno.horarioInicio}</td>
                <td>${turno.horarioFim}</td>
                <td>${parseFloat(turno.duracaoHoras).toFixed(2)}</td>
                <td>
                    <div class="dias-semana-cell">
                        ${this.renderDiasSemana(turno.diasSemana)}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${turno.status}">${turno.status}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-turno-id="${turno._id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-turno-id="${turno._id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        this.addActionButtonListeners();
    }

    renderDiasSemana(diasSemana) {
        const diasLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return diasSemana.map(dia => {
            return `<span class="dia-badge">${diasLabels[dia]}</span>`;
        }).join('');
    }

    formatDiasSemana(diasSemana) {
        const diasLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return diasSemana.map(dia => diasLabels[dia]).join(', ');
    }

    addActionButtonListeners() {
        const editButtons = document.querySelectorAll('.btn-edit');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const turnoId = button.getAttribute('data-turno-id');
                this.editTurno(turnoId);
            });
        });

        const deleteButtons = document.querySelectorAll('.btn-delete');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const turnoId = button.getAttribute('data-turno-id');
                this.deleteTurno(turnoId);
            });
        });
    }

    filterByStatus(status) {
        const rows = document.querySelectorAll('#turnosTableBody tr');
        
        rows.forEach(row => {
            if (status === 'Todos') {
                row.style.display = '';
            } else {
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge && statusBadge.classList.contains(status)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    searchTurnos(searchTerm) {
        const rows = document.querySelectorAll('#turnosTableBody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const nomeCell = row.querySelector('td:first-child');
            
            if (nomeCell) {
                const nome = nomeCell.textContent.toLowerCase();
                
                if (nome.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    openModal(turno = null) {
        console.log('📝 Abrindo modal:', turno ? 'Edição' : 'Novo');
        const modal = document.getElementById('turnoModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('turnoForm');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            return;
        }
        
        if (turno) {
            modalTitle.textContent = 'Editar Turno';
            this.editingTurno = turno;
            
            document.getElementById('turnoNome').value = turno.nome;
            document.getElementById('turnoHorarioInicio').value = turno.horarioInicio;
            document.getElementById('turnoHorarioFim').value = turno.horarioFim;
            document.getElementById('turnoStatus').value = turno.status;
            
            // Limpar checkboxes
            document.querySelectorAll('input[name="diasSemana"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Marcar dias selecionados
            turno.diasSemana.forEach(dia => {
                const checkbox = document.querySelector(`input[name="diasSemana"][value="${dia}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        } else {
            modalTitle.textContent = 'Novo Turno';
            this.editingTurno = null;
            form.reset();
            document.querySelectorAll('input[name="diasSemana"]').forEach(cb => {
                cb.checked = false;
            });
        }
        
        modal.style.display = 'flex';
    }

    closeModal() {
        const modal = document.getElementById('turnoModal');
        modal.style.display = 'none';
        this.editingTurno = null;
        document.getElementById('turnoForm').reset();
    }

    async saveTurno() {
        try {
            const nome = document.getElementById('turnoNome').value;
            const horarioInicio = document.getElementById('turnoHorarioInicio').value;
            const horarioFim = document.getElementById('turnoHorarioFim').value;
            const status = document.getElementById('turnoStatus').value;
            
            // Coletar dias selecionados
            const diasSemana = Array.from(document.querySelectorAll('input[name="diasSemana"]:checked'))
                .map(cb => parseInt(cb.value))
                .sort();
            
            if (diasSemana.length === 0) {
                this.showNotification('Selecione pelo menos um dia da semana', 'error');
                return;
            }
            
            const turnoData = {
                nome,
                horarioInicio,
                horarioFim,
                diasSemana,
                status
            };

            let response;
            if (this.editingTurno) {
                response = await this.makeAuthenticatedRequest(`/api/turnos/${this.editingTurno._id}`, {
                    method: 'PUT',
                    body: JSON.stringify(turnoData)
                });
            } else {
                response = await this.makeAuthenticatedRequest('/api/turnos', {
                    method: 'POST',
                    body: JSON.stringify(turnoData)
                });
            }

            if (response && response.ok) {
                const data = await response.json();
                this.showNotification(
                    this.editingTurno ? 'Turno atualizado com sucesso!' : 'Turno criado com sucesso!',
                    'success'
                );
                this.closeModal();
                this.loadTurnos();
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.showNotification(errorData.message || 'Erro ao salvar turno', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar turno:', error);
            this.showNotification('Erro ao salvar turno', 'error');
        }
    }

    editTurno(turnoId) {
        console.log('🔧 Editando turno:', turnoId);
        const turno = this.turnos.find(t => t._id === turnoId);
        if (turno) {
            console.log('✅ Turno encontrado:', turno);
            this.openModal(turno);
        } else {
            console.error('❌ Turno não encontrado:', turnoId);
            this.showNotification('Turno não encontrado', 'error');
        }
    }

    async deleteTurno(turnoId) {
        console.log('🗑️ Excluindo turno:', turnoId);
        if (confirm('Tem certeza que deseja excluir este turno?')) {
            try {
                const response = await this.makeAuthenticatedRequest(`/api/turnos/${turnoId}`, {
                    method: 'DELETE'
                });

                if (response && response.ok) {
                    console.log('✅ Turno excluído com sucesso');
                    this.showNotification('Turno excluído com sucesso!', 'success');
                    await this.loadTurnos();
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    this.showNotification(errorData.message || 'Erro ao excluir turno', 'error');
                }
            } catch (error) {
                console.error('❌ Erro ao excluir turno:', error);
                this.showNotification('Erro ao excluir turno', 'error');
            }
        }
    }

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

    showNotification(message, type = 'success') {
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

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#6366f1'
        };
        
        notification.style.background = colors[type] || colors.success;
        notification.textContent = message;
        notification.style.transform = 'translateX(0)';

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
        }, type === 'error' ? 5000 : 3000);
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

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    }
}

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.configuracoesTurno = new ConfiguracoesTurno();
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.configuracoesTurno) {
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});

