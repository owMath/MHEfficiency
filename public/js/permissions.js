// Sistema de permissões para o Sistema OEE
const PERMISSIONS_API = '/api/auth';

// Mapeamento de elementos da interface para permissões
const PERMISSION_MAP = {
    'dashboard': {
        sidebar: ['nav-link[href="index.html"]', 'nav-link[href="#"]'],
        cards: ['.analysis-card', '.management-card']
    },
    'paradas': {
        sidebar: ['nav-link:contains("Paradas de Máquina")'],
        cards: ['.analysis-card:contains("Paradas de Máquina")']
    },
    'motivos-parada': {
        sidebar: ['nav-link:contains("Motivos de Parada")'],
        cards: ['.analysis-card:contains("Motivos de Parada")']
    },
    'producao': {
        sidebar: [],
        cards: ['.analysis-card:contains("Produção")']
    },
    'descartes': {
        sidebar: ['nav-link:contains("Motivos de Descarte")'],
        cards: ['.analysis-card:contains("Lista de Descartes")']
    },
    'tempo-real': {
        sidebar: [],
        cards: ['.analysis-card:contains("Visão em Tempo Real")']
    },
    'relatorios': {
        sidebar: [],
        cards: ['.management-card:contains("Relatórios")']
    },
    'logistica': {
        sidebar: [],
        cards: ['.management-card:contains("Logística")']
    },
    'maquinas': {
        sidebar: [],
        cards: ['.management-card:contains("Máquinas")']
    },
    'mtbf': {
        sidebar: [],
        cards: ['.analysis-card:contains("MTBF")']
    },
    'mttr': {
        sidebar: [],
        cards: ['.analysis-card:contains("MTTR")']
    }
};

let userPermissions = [];

// Função para obter permissões do usuário atual
async function getUserPermissions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return [];

        const response = await fetch(`${PERMISSIONS_API}/usuario`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            userPermissions = data.data.permissoes || [];
            console.log('Permissões do usuário carregadas:', userPermissions);
            return userPermissions;
        } else {
            console.error('Erro ao carregar permissões:', response.status);
        }
    } catch (error) {
        console.error('Erro ao carregar permissões:', error);
    }
    
    return [];
}

// Função para verificar se usuário tem permissão
function hasPermission(permission) {
    // Empresas têm acesso total
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.tipoUsuario === 'empresa') {
        return true;
    }
    
    return userPermissions.includes(permission);
}

// Função para aplicar permissões na interface
function applyPermissions() {
    // Ocultar elementos da sidebar
    Object.keys(PERMISSION_MAP).forEach(permission => {
        if (!hasPermission(permission)) {
            const elements = PERMISSION_MAP[permission];
            
            // Ocultar links da sidebar
            elements.sidebar.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.style.display = 'none';
                }
            });
            
            // Ocultar cards do dashboard
            elements.cards.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.style.display = 'none';
                }
            });
        }
    });
}

// Função para aplicar permissões específicas na sidebar
function applySidebarPermissions() {
    console.log('Aplicando permissões da sidebar...');
    
    // Verificar se é operador para aplicar restrições adicionais
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isOperador = user.tipoUsuario === 'operador';
    
    // Itens sempre ocultos para operadores (independente de permissões)
    const itemsOcultosParaOperadores = ['Paradas de Máquina', 'Análise de Produção'];
    
    // Ocultar itens específicos para operadores
    if (isOperador) {
        itemsOcultosParaOperadores.forEach(text => {
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                if (link.textContent.includes(text)) {
                    const parentItem = link.closest('.nav-item');
                    if (parentItem) {
                        parentItem.style.display = 'none';
                        parentItem.style.visibility = 'hidden';
                        parentItem.style.height = '0';
                        parentItem.style.overflow = 'hidden';
                        parentItem.style.margin = '0';
                        parentItem.style.padding = '0';
                        console.log(`Ocultando item do menu para operador: ${text}`);
                    }
                }
            });
        });
    }
    
    // Mapear itens da sidebar por texto
    const sidebarMappings = [
        { permission: 'dashboard', text: 'Dashboard' },
        { permission: 'config-sistema', text: 'Configurações do Sistema' },
        { permission: 'perfil', text: 'Perfil' },
        { permission: 'usuarios', text: 'Usuários' },
        { permission: 'aprovacao-operadores', text: 'Aprovação de Operadores' },
        { permission: 'paradas', text: 'Paradas de Máquina' },
        { permission: 'producao', text: 'Análise de Produção' },
        { permission: 'motivos-parada', text: 'Motivos de Parada' },
        { permission: 'motivos-descarte', text: 'Motivos de Descarte' },
        { permission: 'cadastro-produtos', text: 'Cadastro de Produtos' },
        { permission: 'produto-maquina', text: 'Produto x Máquina' },
        { permission: 'config-produtos', text: 'Configurações de Produtos' },
        { permission: 'config-turno', text: 'Configurações de Turno' }
    ];

    sidebarMappings.forEach(({ permission, text }) => {
        const hasAccess = hasPermission(permission);
        console.log(`Permissão '${permission}' para '${text}': ${hasAccess ? 'PERMITIDO' : 'NEGADO'}`);
        
        if (!hasAccess) {
            // Encontrar links da sidebar que contêm o texto específico
            const navLinks = document.querySelectorAll('.nav-link');
            let found = false;
            
            navLinks.forEach(link => {
                if (link.textContent.includes(text)) {
                    // Ocultar o link e também o item pai (li.nav-item)
                    link.style.display = 'none';
                    link.style.visibility = 'hidden';
                    
                    // Ocultar o item pai completo
                    const parentItem = link.closest('.nav-item');
                    if (parentItem) {
                        parentItem.style.display = 'none';
                        parentItem.style.visibility = 'hidden';
                        parentItem.style.height = '0';
                        parentItem.style.overflow = 'hidden';
                        parentItem.style.margin = '0';
                        parentItem.style.padding = '0';
                    }
                    
                    console.log(`Ocultando link da sidebar: ${text}`);
                    found = true;
                }
            });
            
            if (!found) {
                console.log(`Link não encontrado para: ${text}`);
            }
        }
    });
}

// Função para aplicar permissões específicas nos cards do dashboard
function applyDashboardPermissions() {
    console.log('Aplicando permissões do dashboard...');
    
    // Mapear cards por texto para ocultar baseado nas permissões
    const cardMappings = [
        { permission: 'paradas', text: 'Paradas de Máquina' },
        { permission: 'motivos-parada', text: 'Motivos de Parada' },
        { permission: 'producao', text: 'Produção' },
        { permission: 'descartes', text: 'Lista de Descartes' },
        { permission: 'sinal-maquina', text: 'Sinal da Máquina' },
        { permission: 'tempo-real', text: 'Visão em Tempo Real' },
        { permission: 'mtbf', text: 'MTBF' },
        { permission: 'mttr', text: 'MTTR' },
        { permission: 'relatorios', text: 'Relatórios' },
        { permission: 'logistica', text: 'Logística' },
        { permission: 'maquinas', text: 'Máquinas' }
    ];

    cardMappings.forEach(({ permission, text }) => {
        const hasAccess = hasPermission(permission);
        console.log(`Permissão '${permission}' para '${text}': ${hasAccess ? 'PERMITIDO' : 'NEGADO'}`);
        
        if (!hasAccess) {
            // Encontrar cards que contêm o texto específico
            const cards = document.querySelectorAll('.analysis-card, .management-card');
            let found = false;
            
            cards.forEach(card => {
                if (card.textContent.includes(text)) {
                    card.style.display = 'none';
                    card.style.visibility = 'hidden';
                    card.style.height = '0';
                    card.style.overflow = 'hidden';
                    console.log(`Ocultando card do dashboard: ${text}`);
                    found = true;
                }
            });
            
            if (!found) {
                console.log(`Card não encontrado para: ${text}`);
            }
        }
    });
}

// Função para inicializar sistema de permissões
async function initPermissions() {
    console.log('Inicializando sistema de permissões...');
    
    // Aguardar um pouco para garantir que o DOM esteja carregado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await getUserPermissions();
    
    console.log('Aplicando permissões na sidebar...');
    applySidebarPermissions();
    
    console.log('Aplicando permissões no dashboard...');
    applyDashboardPermissions();
    
    console.log('Sistema de permissões inicializado!');
}

// Função para verificar se usuário pode acessar página
function canAccessPage(pagePermission) {
    return hasPermission(pagePermission);
}

// Função para redirecionar se não tiver permissão
function requirePermission(permission, redirectTo = 'index.html') {
    if (!canAccessPage(permission)) {
        alert('Você não tem permissão para acessar esta página.');
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// Exportar funções para uso global
window.hasPermission = hasPermission;
window.canAccessPage = canAccessPage;
window.requirePermission = requirePermission;
window.initPermissions = initPermissions;
window.userPermissions = userPermissions;
