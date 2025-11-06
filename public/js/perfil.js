// perfil.js - Script para página de perfil do usuário

let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar permissões da página
    initializePagePermissions();
    
    // Carregar informações do perfil
    loadProfileInfo();
    
    // Configurar eventos dos cards
    setupProfileCards();
});

// Carregar informações do perfil do usuário
async function loadProfileInfo() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showStatusMessage('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const response = await fetch('/api/auth/usuario', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                showStatusMessage('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return;
            }
            throw new Error('Erro ao carregar dados do usuário');
        }

        const result = await response.json();
        currentUser = result.data;
        
        // Atualizar elementos da página com as informações
        updateProfileDisplay(currentUser);
        
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showStatusMessage('Erro ao carregar dados do perfil', 'error');
    }
}

// Atualizar exibição do perfil
function updateProfileDisplay(userInfo) {
    // Atualizar informações no header
    const usernameElement = document.querySelector('.username');
    if (usernameElement) {
        usernameElement.textContent = userInfo.nome.split(' ')[0];
    }
    
    // Atualizar informações do perfil
    const profileName = document.querySelector('.profile-info h2');
    const profileRole = document.querySelector('.profile-role');
    const profileEmail = document.querySelector('.profile-email');
    
    if (profileName) profileName.textContent = userInfo.nome;
    if (profileRole) {
        const roleText = userInfo.tipoUsuario === 'empresa' ? 'Supervisor' : 'Operador';
        profileRole.textContent = roleText;
    }
    if (profileEmail) profileEmail.textContent = userInfo.email;
    
    // Atualizar informações dinâmicas
    updateLastAccess(userInfo.ultimoLogin);
    updateMemberSince(userInfo.createdAt);
}

// Atualizar último acesso
function updateLastAccess(ultimoLogin) {
    const ultimoAcessoElement = document.getElementById('ultimoAcesso');
    if (ultimoAcessoElement) {
        if (ultimoLogin) {
            const data = new Date(ultimoLogin);
            const agora = new Date();
            const diffMs = agora - data;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            let textoAcesso;
            if (diffDays === 0) {
                textoAcesso = `Hoje às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            } else if (diffDays === 1) {
                textoAcesso = `Ontem às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            } else {
                textoAcesso = `${diffDays} dias atrás`;
            }
            
            ultimoAcessoElement.textContent = textoAcesso;
        } else {
            ultimoAcessoElement.textContent = 'Primeiro acesso';
        }
    }
}

// Atualizar membro desde
function updateMemberSince(createdAt) {
    const membroDesdeElement = document.getElementById('membroDesde');
    if (membroDesdeElement) {
        if (createdAt) {
            const data = new Date(createdAt);
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            
            const mes = meses[data.getMonth()];
            const ano = data.getFullYear();
            
            membroDesdeElement.textContent = `${mes} ${ano}`;
        } else {
            membroDesdeElement.textContent = 'Data não disponível';
        }
    }
}

// Configurar eventos dos cards de perfil
function setupProfileCards() {
    // Cards de configuração (clicáveis)
    const configCards = document.querySelectorAll('.profile-config-card');
    
    configCards.forEach(card => {
        card.addEventListener('click', function() {
            const cardTitle = this.querySelector('h3').textContent;
            
            switch(cardTitle) {
                case 'Alterar Senha':
                    openChangePasswordModal();
                    break;
                case 'Editar Perfil':
                    openEditProfileModal();
                    break;
                default:
                    // Para cards informativos, apenas mostrar feedback visual
                    showCardFeedback(this);
                    break;
            }
        });
        
        // Adicionar efeito hover
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
    });
    
    // Cards informativos (não clicáveis)
    const infoCards = document.querySelectorAll('.profile-info-card');
    
    infoCards.forEach(card => {
        // Adicionar efeito hover apenas
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
    });
}

// Abrir modal para alterar senha
function openChangePasswordModal() {
    // Criar modal para alteração de senha
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Alterar Senha</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label for="currentPassword">Senha Atual:</label>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">Nova Senha:</label>
                        <input type="password" id="newPassword" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Confirmar Nova Senha:</label>
                        <input type="password" id="confirmPassword" required minlength="6">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary modal-close">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Alterar Senha</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar eventos do modal
    setupPasswordModalEvents(modal);
}

// Abrir modal para editar perfil
function openEditProfileModal() {
    if (!currentUser) {
        showStatusMessage('Erro ao carregar dados do usuário', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Editar Perfil</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="editProfileForm">
                    <div class="form-group">
                        <label for="editNome">Nome:</label>
                        <input type="text" id="editNome" value="${currentUser.nome}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmail">Email:</label>
                        <input type="email" id="editEmail" value="${currentUser.email}" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary modal-close">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar eventos do modal
    setupEditProfileModalEvents(modal);
}

// Configurar eventos do modal de senha
function setupPasswordModalEvents(modal) {
    const closeButtons = modal.querySelectorAll('.modal-close');
    const form = modal.querySelector('#changePasswordForm');
    
    // Fechar modal
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });
    
    // Fechar ao clicar no overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Submeter formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordChange(form);
    });
}

// Configurar eventos do modal de edição de perfil
function setupEditProfileModalEvents(modal) {
    const closeButtons = modal.querySelectorAll('.modal-close');
    const form = modal.querySelector('#editProfileForm');
    
    // Fechar modal
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    });
    
    // Fechar ao clicar no overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Submeter formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleProfileEdit(form);
    });
}

// Processar alteração de senha
async function handlePasswordChange(form) {
    const currentPassword = form.querySelector('#currentPassword').value;
    const newPassword = form.querySelector('#newPassword').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;
    
    // Validações básicas
    if (newPassword !== confirmPassword) {
        showStatusMessage('As senhas não coincidem!', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showStatusMessage('A nova senha deve ter pelo menos 6 caracteres!', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/alterar-senha', {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                senhaAtual: currentPassword,
                novaSenha: newPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Erro ao alterar senha');
        }

        showStatusMessage('Senha alterada com sucesso!', 'success');
        
        // Fechar modal
        const modal = form.closest('.modal-overlay');
        document.body.removeChild(modal);
        
        // Limpar formulário
        form.reset();
        
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showStatusMessage(error.message || 'Erro ao alterar senha', 'error');
    }
}

// Processar edição de perfil
async function handleProfileEdit(form) {
    const nome = form.querySelector('#editNome').value.trim();
    const email = form.querySelector('#editEmail').value.trim();
    
    // Validações básicas
    if (!nome || !email) {
        showStatusMessage('Nome e email são obrigatórios!', 'error');
        return;
    }
    
    if (nome.length < 2) {
        showStatusMessage('Nome deve ter pelo menos 2 caracteres!', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/perfil', {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: nome,
                email: email
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Erro ao atualizar perfil');
        }

        // Atualizar dados locais
        currentUser.nome = result.data.nome;
        currentUser.email = result.data.email;
        
        // Atualizar exibição
        updateProfileDisplay(currentUser);
        
        showStatusMessage('Perfil atualizado com sucesso!', 'success');
        
        // Fechar modal
        const modal = form.closest('.modal-overlay');
        document.body.removeChild(modal);
        
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showStatusMessage(error.message || 'Erro ao atualizar perfil', 'error');
    }
}

// Mostrar feedback visual no card
function showCardFeedback(card) {
    card.style.backgroundColor = '#f8f9fa';
    card.style.borderColor = '#007bff';
    
    setTimeout(() => {
        card.style.backgroundColor = '';
        card.style.borderColor = '';
    }, 200);
}

// Mostrar mensagem de status
function showStatusMessage(message, type = 'info') {
    const statusElement = document.querySelector('.status-message');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        // Limpar mensagem após 3 segundos
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, 3000);
    }
}

// Inicializar permissões da página
function initializePagePermissions() {
    // Verificar se o usuário tem permissão para acessar esta página
    const token = localStorage.getItem('token');
    if (!token) {
        showStatusMessage('Faça login para acessar esta página!', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
}
