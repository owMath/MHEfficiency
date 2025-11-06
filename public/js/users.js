// Baseado no approval.js, com recursos extras para gestão de usuários
const API_BASE_URL = '/api/auth';

let allUsers = [];
let currentFilter = 'todos';
let selectedUserForPerms = null;
let selectedUserForEdit = null;
let allMachines = [];

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) { window.location.href = 'login.html'; return false; }
    const userData = JSON.parse(user);
    if (userData.tipoUsuario !== 'empresa' || userData.status !== 'ativo') { window.location.href = 'index.html'; return false; }
    return true;
}

function showMessage(title, text, type = 'success') {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('messageIcon');
    const titleEl = document.getElementById('messageTitle');
    const textEl = document.getElementById('messageText');
    if (!modal) return;
    icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
    titleEl.textContent = title;
    textEl.textContent = text;
    modal.style.display = 'flex';
    
    // Auto-close success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            modal.style.display = 'none';
        }, 3000);
    }
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) modal.style.display = 'none';
}

function logout() {
    console.log('Função logout chamada');
    
    // Mostrar confirmação antes de fazer logout
    const confirmLogout = confirm('Tem certeza que deseja sair do sistema?');
    
    if (!confirmLogout) {
        console.log('Logout cancelado pelo usuário');
        return;
    }
    
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        console.log('Dados removidos do localStorage');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro no logout:', error);
        // Fallback: redirecionar mesmo com erro
        window.location.href = 'login.html';
    }
}

function initials(name) {
    return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('');
}

function applyCounts() {
    const ativo = allUsers.filter(u => u.status === 'ativo').length;
    const inativo = allUsers.filter(u => u.status === 'inativo').length;
    const pend = allUsers.filter(u => u.status === 'pendente').length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('countAtivo', ativo); set('countInativo', inativo); set('countPendente', pend);
}

function filteredUsers() {
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    return allUsers.filter(u => {
        if (currentFilter !== 'todos' && u.status !== currentFilter) return false;
        const text = `${u.nome} ${u.email}`.toLowerCase();
        return text.includes(term);
    });
}

function renderUsers() {
    const container = document.getElementById('usersContainer');
    const empty = document.getElementById('emptyState');
    if (!container) return;
    container.innerHTML = '';
    const list = filteredUsers();
    if (list.length === 0) { empty.style.display = 'block'; return; } else { empty.style.display = 'none'; }

    const frag = document.createDocumentFragment();
    list.forEach(u => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.innerHTML = `
            <div class="user-avatar">${initials(u.nome)}</div>
            <div class="user-meta">
                <h3>${u.nome}</h3>
                <p>${u.email}</p>
                ${u.operador?.machineId ? `<p style="font-size: 0.8rem; color: #059669;"><i class="fas fa-cog"></i> ${u.operador.machineId.machineId}${u.operador.machineId.nome ? ' - ' + u.operador.machineId.nome : ''}</p>` : ''}
            </div>
            <div class="user-actions">
                <span class="pill ${u.status}">${u.status}</span>
                ${u.status === 'pendente' ? `<button class="btn-success" data-action="aprovar" data-id="${u._id}"><i class="fas fa-check"></i></button>` : ''}
                ${u.status !== 'inativo' ? `<button class="btn-danger" data-action="inativar" data-id="${u._id}"><i class="fas fa-user-slash"></i></button>` : `<button class="btn-success" data-action="ativar" data-id="${u._id}"><i class="fas fa-user-check"></i></button>`}
                <button class="btn-secondary" data-action="editar" data-id="${u._id}"><i class="fas fa-edit"></i></button>
                <button class="btn-primary" data-action="permissoes" data-id="${u._id}"><i class="fas fa-shield-halved"></i></button>
            </div>`;
        frag.appendChild(card);
    });
    container.appendChild(frag);
}

async function loadMachines() {
    try {
        const response = await fetch(`${API_BASE_URL}/maquinas-empresa`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            allMachines = data.data || [];
            console.log('Máquinas carregadas:', allMachines);
        } else {
            console.error('Erro ao buscar máquinas:', response.status);
            allMachines = [];
        }
    } catch (error) {
        console.error('Erro ao carregar máquinas:', error);
        allMachines = [];
    }
}

async function loadUsers() {
    const loading = document.getElementById('loadingState');
    if (loading) loading.style.display = 'flex';
    
    try {
        // Buscar todos os usuários da empresa (operadores + empresa)
        const response = await fetch(`${API_BASE_URL}/usuarios-empresa`, { 
            headers: getAuthHeaders() 
        });
        
        if (response.ok) {
            const data = await response.json();
            allUsers = data.data || [];
            console.log('Usuários carregados:', allUsers);
        } else {
            console.error('Erro ao buscar usuários:', response.status);
            allUsers = [];
        }
        
        applyCounts();
        renderUsers();
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showMessage('Erro', 'Falha ao carregar usuários. Tente novamente.', 'error');
        allUsers = [];
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function openEditUserModal(userId) {
    selectedUserForEdit = userId;
    const modal = document.getElementById('editUserModal');
    const user = allUsers.find(u => u._id === userId);
    
    if (!modal || !user) return;
    
    // Preencher formulário com dados do usuário
    document.getElementById('editUserName').value = user.nome || '';
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserCargo').value = user.operador?.cargo || '';
    document.getElementById('editUserTelefone').value = user.operador?.telefone || '';
    
    // Carregar máquinas no select
    const machineSelect = document.getElementById('editUserMachine');
    machineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
    
    allMachines.forEach(machine => {
        const option = document.createElement('option');
        option.value = machine._id;
        option.textContent = machine.nome ? `${machine.machineId} - ${machine.nome}` : machine.machineId;
        if (user.operador?.machineId && user.operador.machineId.toString() === machine._id.toString()) {
            option.selected = true;
        }
        machineSelect.appendChild(option);
    });
    
    // Adicionar event listener para mostrar informações da máquina
    machineSelect.addEventListener('change', function() {
        const selectedMachineId = this.value;
        const machineInfo = document.getElementById('machineInfo');
        const machineInfoText = document.getElementById('machineInfoText');
        
        if (selectedMachineId) {
            const selectedMachine = allMachines.find(m => m._id === selectedMachineId);
            if (selectedMachine) {
                const machineType = selectedMachine.tipo || 'simulador';
                const machineStatus = selectedMachine.status || 'ativo';
                const machineDisplay = selectedMachine.nome ? `${selectedMachine.machineId} - ${selectedMachine.nome}` : selectedMachine.machineId;
                
                machineInfoText.innerHTML = `
                    <strong>${machineDisplay}</strong><br>
                    <small>Tipo: ${machineType} | Status: ${machineStatus}</small>
                `;
                machineInfo.style.display = 'block';
            }
        } else {
            machineInfo.style.display = 'none';
        }
    });
    
    // Disparar o evento se já houver uma máquina selecionada
    if (machineSelect.value) {
        machineSelect.dispatchEvent(new Event('change'));
    }
    
    modal.style.display = 'flex';
}

function closeEditUserModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) modal.style.display = 'none';
    selectedUserForEdit = null;
}

async function saveEditUser() {
    if (!selectedUserForEdit) return;
    
    try {
        const machineIdValue = document.getElementById('editUserMachine').value;
        
        const formData = {
            nome: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            cargo: document.getElementById('editUserCargo').value,
            telefone: document.getElementById('editUserTelefone').value,
            machineId: machineIdValue && machineIdValue.trim() !== '' ? machineIdValue : null
        };
        
        console.log('Salvando usuário:', formData);
        
        const response = await fetch(`${API_BASE_URL}/operador/${selectedUserForEdit}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeEditUserModal();
            showMessage('Usuário atualizado', 'Os dados do usuário foram atualizados com sucesso!');
            await loadUsers(); // Recarregar lista
        } else {
            showMessage('Erro', data.message || 'Erro ao atualizar usuário', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        showMessage('Erro', 'Falha ao atualizar usuário. Tente novamente.', 'error');
    }
}

function openPermissionsModal(userId) {
    selectedUserForPerms = userId;
    const modal = document.getElementById('permissionsModal');
    const list = document.getElementById('permissionsList');
    if (!modal || !list) return;
    
    // Organizar páginas por categorias
    const pagesByCategory = {
        'Dashboard': [
            { id: 'dashboard', label: 'Dashboard Principal' }
        ],
        'Análises Detalhadas': [
            { id: 'paradas', label: 'Paradas de Máquina' },
            { id: 'producao', label: 'Produção' },
            { id: 'descartes', label: 'Lista de Descartes' },
            { id: 'sinal-maquina', label: 'Sinal da Máquina' },
            { id: 'tempo-real', label: 'Visão em Tempo Real' },
            { id: 'mtbf', label: 'MTBF' },
            { id: 'mttr', label: 'MTTR' }
        ],
        'Gestão Operacional': [
            { id: 'relatorios', label: 'Relatórios' },
            { id: 'logistica', label: 'Logística' },
            { id: 'maquinas', label: 'Máquinas' },
            { id: 'previsao-oee', label: 'Previsão OEE' }
        ],
        'Configurações do Sistema': [
            { id: 'config-sistema', label: 'Configurações do Sistema' },
            { id: 'perfil', label: 'Perfil do Usuário' }
        ],
        'Gestão de Paradas': [
            { id: 'motivos-parada', label: 'Motivos de Parada' },
            { id: 'motivos-descarte', label: 'Motivos de Descarte' }
        ],
        'Gestão de Produtos': [
            { id: 'cadastro-produtos', label: 'Cadastro de Produtos' },
            { id: 'produto-maquina', label: 'Produto x Máquina' },
            { id: 'config-produtos', label: 'Configurações de Produtos' }
        ],
        'Gestão de Turnos': [
            { id: 'config-turno', label: 'Configurações de Turno' }
        ],
        'Gestão de Usuários': [
            { id: 'usuarios', label: 'Gestão de Usuários' },
            { id: 'aprovacao-operadores', label: 'Aprovação de Operadores' }
        ]
    };
    
    // Gerar HTML organizado por categorias
    let html = '';
    Object.keys(pagesByCategory).forEach(category => {
        html += `<div class="permission-category">
            <h4 class="category-title">${category}</h4>
            <div class="category-items">`;
        
        pagesByCategory[category].forEach(page => {
            html += `<label class="permission-item">
                <input type="checkbox" data-perm="${page.id}">
                <span>${page.label}</span>
            </label>`;
        });
        
        html += `</div></div>`;
    });
    
    list.innerHTML = html;
    
    // Carregar permissões atuais do usuário
    loadUserPermissions(userId);
    
    modal.style.display = 'flex';
}

async function loadUserPermissions(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/usuario/${userId}/permissoes`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const permissoes = data.data.permissoes || [];
            
            // Marcar checkboxes baseado nas permissões
            permissoes.forEach(permissao => {
                const checkbox = document.querySelector(`input[data-perm="${permissao}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
            
            console.log('Permissões carregadas:', permissoes);
        }
    } catch (error) {
        console.error('Erro ao carregar permissões:', error);
    }
}

function closePermissionsModal() {
    const modal = document.getElementById('permissionsModal');
    if (modal) modal.style.display = 'none';
    selectedUserForPerms = null;
}

function openConfirm(action, userId) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmTitle');
    const msg = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');
    if (!modal) return;
    title.textContent = action === 'aprovar' ? 'Aprovar usuário' : (action === 'ativar' ? 'Ativar usuário' : 'Inativar usuário');
    msg.textContent = 'Tem certeza que deseja realizar esta ação?';
    btn.onclick = () => changeStatus(userId, action);
    modal.style.display = 'flex';
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = 'none';
}

async function changeStatus(userId, action) {
    try {
        const status = action === 'inativar' ? 'inativo' : 'ativo';
        const res = await fetch(`${API_BASE_URL}/operador/${userId}/status`, {
            method: 'PATCH', 
            headers: getAuthHeaders(), 
            body: JSON.stringify({ status })
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Erro ao atualizar status');
        }
        
        showMessage('Sucesso', data.message || 'Status atualizado com sucesso!');
        await loadUsers(); // Recarregar lista
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showMessage('Erro', error.message || 'Falha ao atualizar status. Tente novamente.', 'error');
    } finally {
        closeConfirmModal();
    }
}

function attachEvents() {
    // Event listeners para modais
    document.getElementById('messageClose')?.addEventListener('click', closeMessageModal);
    
    // Botão X do modal de permissões
    document.getElementById('permissionsModalClose')?.addEventListener('click', closePermissionsModal);
    
    // Botão Cancelar do modal de permissões
    document.getElementById('cancelPermissionsBtn')?.addEventListener('click', closePermissionsModal);
    
    // Botão X do modal de edição
    document.getElementById('editUserModalClose')?.addEventListener('click', closeEditUserModal);
    
    // Botão Cancelar do modal de edição
    document.getElementById('cancelEditUserBtn')?.addEventListener('click', closeEditUserModal);
    
    // Botão Salvar do modal de edição
    document.getElementById('saveEditUserBtn')?.addEventListener('click', saveEditUser);
    
    // Botão atualizar
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadUsers();
        showMessage('Atualizado', 'Lista de usuários atualizada!');
    });
    
    // Campo de busca
    document.getElementById('searchInput')?.addEventListener('input', () => {
        renderUsers();
    });
    
    // Abas de filtro
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover active de todas as abas
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            // Adicionar active na aba clicada
            btn.classList.add('active');
            // Atualizar filtro
            currentFilter = btn.getAttribute('data-tab');
            renderUsers();
        });
    });
    
    // Event delegation para botões dos cards de usuário
    document.getElementById('usersContainer')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        
        const userId = button.getAttribute('data-id');
        const action = button.getAttribute('data-action');
        
        if (!userId || !action) return;
        
        if (action === 'permissoes') {
            openPermissionsModal(userId);
            return;
        }
        
        if (action === 'editar') {
            openEditUserModal(userId);
            return;
        }
        
        // Para ações de status (aprovar, ativar, inativar)
        openConfirm(action, userId);
    });
    
    // Botão salvar permissões
    document.getElementById('savePermissionsBtn')?.addEventListener('click', async () => {
        if (!selectedUserForPerms) return;
        
        try {
            // Coletar permissões selecionadas
            const checkboxes = document.querySelectorAll('#permissionsList input[type="checkbox"]:checked');
            const permissoes = Array.from(checkboxes).map(cb => cb.getAttribute('data-perm'));
            
            console.log('Salvando permissões:', permissoes, 'para usuário:', selectedUserForPerms);
            
            const response = await fetch(`${API_BASE_URL}/usuario/${selectedUserForPerms}/permissoes`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ permissoes })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                closePermissionsModal();
                showMessage('Permissões salvas', 'As permissões foram atualizadas com sucesso!');
            } else {
                showMessage('Erro', data.message || 'Erro ao salvar permissões', 'error');
            }
            
        } catch (error) {
            console.error('Erro ao salvar permissões:', error);
            showMessage('Erro', 'Falha ao salvar permissões. Tente novamente.', 'error');
        }
    });
    
    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'confirmModal') {
                    closeConfirmModal();
                } else if (modal.id === 'permissionsModal') {
                    closePermissionsModal();
                } else if (modal.id === 'editUserModal') {
                    closeEditUserModal();
                } else if (modal.id === 'messageModal') {
                    closeMessageModal();
                }
            }
        });
    });
    
    // Event listener específico para o botão de logout
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        console.log('Botão de logout encontrado, adicionando event listener');
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Botão de logout clicado');
            logout();
        });
    } else {
        console.error('Botão de logout não encontrado!');
    }
}

function loadUserData() {
    const user = JSON.parse(localStorage.getItem('user'));
    const userName = document.getElementById('userName');
    if (user && userName) userName.textContent = user.nome;
    
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

// Função para toggle do menu mobile
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadUserData();
    attachEvents();
    loadMachines();
    loadUsers();
    
    // Event listener para menu mobile
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
});


