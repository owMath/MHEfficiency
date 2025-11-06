// Configurações da API
const API_BASE_URL = '/api/auth';

// Variáveis globais
let operadoresPendentes = [];
let currentAction = null;
let currentOperatorId = null;

// Logger estruturado para organizar os logs no console
const Logger = {
    scope: '[Aprovação] ',
    info() { console.log(this.scope, ...arguments); },
    warn() { console.warn(this.scope, ...arguments); },
    error() { console.error(this.scope, ...arguments); },
    group(label, collapsed = true) {
        const title = `${this.scope}${label}`;
        if (collapsed && console.groupCollapsed) console.groupCollapsed(title);
        else if (console.group) console.group(title);
        else this.info(label);
    },
    groupEnd() { if (console.groupEnd) console.groupEnd(); },
    table(data) { if (console.table) console.table(data); else this.info(data); }
};

// Função para verificar autenticação
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }
    
    const userData = JSON.parse(user);
    if (userData.tipoUsuario !== 'empresa' || userData.status !== 'ativo') {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Função para obter token de autorização
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Função para mostrar loading
function showLoading() {
    const loadingState = document.querySelector('.loading-state');
    if (loadingState) {
        loadingState.style.display = 'flex';
    }
}

// Função para ocultar loading
function hideLoading() {
    const loadingState = document.querySelector('.loading-state');
    if (loadingState) {
        loadingState.style.display = 'none';
    }
}

// Função para mostrar mensagem
function showMessage(title, text, type = 'success') {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('messageIcon');
    const titleEl = document.getElementById('messageTitle');
    const textEl = document.getElementById('messageText');
    
    if (modal) {
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        titleEl.textContent = title;
        textEl.textContent = text;
        modal.style.display = 'flex';
        
        if (type === 'success') {
            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);
        }
    }
}

// Função para fechar modal de mensagem
function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para mostrar modal de confirmação
function showConfirmationModal(title, message, action, operatorId) {
    Logger.group('Modal de confirmação', true);
    Logger.info('Abrindo modal', { title, message, action, operatorId });
    
    const modal = document.getElementById('confirmationModal');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmButton');
    
    if (!modal || !titleEl || !messageEl || !confirmBtn) {
        Logger.error('Elementos do modal não encontrados');
        Logger.groupEnd();
        return;
    }
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = action === 'aprovar' ? 'Aprovar' : 'Rejeitar';
    confirmBtn.className = action === 'aprovar' ? 'btn-success' : 'btn-danger';
    
    // Definir variáveis globais
    currentAction = action;
    currentOperatorId = operatorId;
    
    Logger.info('Variáveis definidas', { currentAction, currentOperatorId });
    
    modal.style.display = 'flex';
    Logger.groupEnd();
}

// Função para fechar modal de confirmação
function closeModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentAction = null;
    currentOperatorId = null;
}

// Função para confirmar ação
async function confirmAction() {
    if (!currentAction || !currentOperatorId) {
        Logger.error('Ação ou ID do operador não definidos', { currentAction, currentOperatorId });
        return;
    }
    
    try {
        Logger.group('Confirmação de ação', true);
        Logger.info('Processando', { acao: currentAction, operadorId: currentOperatorId });
        
        const response = await fetch(`${API_BASE_URL}/operador/${currentOperatorId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                status: currentAction === 'aprovar' ? 'ativo' : 'inativo' 
            })
        });
        
        Logger.info('Resposta da API', { status: response.status, statusText: response.statusText });
        
        const data = await response.json();
        Logger.info('Dados da resposta', data);
        
        if (response.ok) {
            showMessage(
                'Sucesso', 
                `Operador ${currentAction === 'aprovar' ? 'aprovado' : 'rejeitado'} com sucesso!`
            );
            
            // Recarregar lista de operadores
            await loadOperadoresPendentes();
            
            closeModal();
        } else {
            Logger.error('Erro na API', data);
            showMessage('Erro', data.message || 'Erro ao processar solicitação', 'error');
        }
    } catch (error) {
        Logger.error('Erro ao processar ação', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
    }
    Logger.groupEnd();
}

// Função para carregar operadores pendentes
async function loadOperadoresPendentes() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/operadores-pendentes`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            operadoresPendentes = data.data;
            Logger.group('Carregamento de operadores', true);
            Logger.info('Total pendentes', operadoresPendentes.length);
            if (Array.isArray(operadoresPendentes) && operadoresPendentes.length) {
                Logger.table(operadoresPendentes.map(o => ({ id: o._id, nome: o.nome, email: o.email, status: o.status })));
            }
            Logger.groupEnd();
            renderOperadoresList();
            updateStats();
        } else {
            showMessage('Erro', data.message || 'Erro ao carregar operadores', 'error');
        }
    } catch (error) {
        Logger.error('Erro ao carregar operadores', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
    } finally {
        hideLoading();
    }
}

// Função para renderizar lista de operadores
function renderOperadoresList() {
    const container = document.getElementById('operatorsList');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    if (operadoresPendentes.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    container.innerHTML = operadoresPendentes.map(operador => `
        <div class="operator-card" data-id="${operador._id}">
            <div class="operator-info">
                <div class="operator-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="operator-details">
                    <h3>${operador.nome}</h3>
                    <p class="operator-email">${operador.email}</p>
                    <p class="operator-cargo">${operador.operador.cargo}</p>
                    <p class="operator-phone">${operador.operador.telefone}</p>
                    <p class="operator-date">Cadastrado em: ${new Date(operador.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
            </div>
            <div class="operator-actions">
                <button class="btn-success" data-action="aprovar" data-id="${operador._id}">
                    <i class="fas fa-check"></i>
                    Aprovar
                </button>
                <button class="btn-danger" data-action="rejeitar" data-id="${operador._id}">
                    <i class="fas fa-times"></i>
                    Rejeitar
                </button>
            </div>
        </div>
    `).join('');
    
    // Adicionar event listeners após renderizar
    attachOperatorButtonEvents();
}

// Função para anexar event listeners aos botões dos operadores
function attachOperatorButtonEvents() {
    const container = document.getElementById('operatorsList');
    if (!container) return;
    
    container.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        const operatorId = button.getAttribute('data-id');
        
        if (!action || !operatorId) return;
        Logger.info('Ação solicitada', { action, operatorId });
        
        if (action === 'aprovar') {
            showConfirmationModal(
                'Aprovar Operador', 
                'Tem certeza que deseja aprovar este operador?', 
                'aprovar', 
                operatorId
            );
        } else if (action === 'rejeitar') {
            showConfirmationModal(
                'Rejeitar Operador', 
                'Tem certeza que deseja rejeitar este operador?', 
                'rejeitar', 
                operatorId
            );
        }
    });
}

// Função para atualizar estatísticas
function updateStats() {
    const pendingCount = document.getElementById('pendingCount');
    if (pendingCount) {
        pendingCount.textContent = operadoresPendentes.length;
    }
}

// Função para carregar dados do usuário
function loadUserData() {
    const user = JSON.parse(localStorage.getItem('user'));
    const userName = document.getElementById('userName');
    
    if (userName && user) {
        userName.textContent = user.nome;
    }
    
    // Inicializar timestamp
    updateTimestamp();
    setInterval(updateTimestamp, 1000);
}

// Função para atualizar o timestamp
function updateTimestamp() {
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

// Função para logout
function logout() {
    Logger.group('Logout', true);
    Logger.info('Solicitando confirmação de logout');
    // Mostrar confirmação antes de fazer logout
    const confirmLogout = confirm('Tem certeza que deseja sair do sistema?');
    
    if (!confirmLogout) {
        Logger.info('Logout cancelado pelo usuário');
        Logger.groupEnd();
        return;
    }
    
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (error) {
        Logger.error('Erro no logout', error);
        // Fallback: redirecionar mesmo com erro
        window.location.href = 'login.html';
    }
    Logger.groupEnd();
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    if (!checkAuth()) return;
    
    // Verificar permissão para acessar esta página
    setTimeout(async () => {
        if (window.requirePermission && !window.requirePermission('aprovacao-operadores')) {
            return; // Redirecionamento já feito pela função requirePermission
        }
        
        // Carregar dados do usuário
        loadUserData();
        
        // Carregar operadores pendentes
        loadOperadoresPendentes();
    }, 200);
    
    // Event listeners para modais
    const messageClose = document.getElementById('messageClose');
    if (messageClose) {
        messageClose.addEventListener('click', closeMessageModal);
    }
    
    const modalClose = document.getElementById('modalCloseButton');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    const cancelButton = document.getElementById('cancelButton');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeModal);
    }
    
    const confirmButton = document.getElementById('confirmButton');
    if (confirmButton) {
        confirmButton.addEventListener('click', confirmAction);
    }
    
    // Fechar modal ao clicar fora
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                if (modal.id === 'confirmationModal') {
                    closeModal();
                } else if (modal.id === 'messageModal') {
                    closeMessageModal();
                }
            }
        });
    });
    
    // Event listener específico para o botão de logout
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            logout();
        });
    } else {
        // Elemento não encontrado pode ocorrer em páginas sem o botão
        Logger.info('Botão de logout não encontrado (página sem esse elemento)');
    }
});
