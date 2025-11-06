// JavaScript para página de Configurações do Sistema
// Logger simples com níveis via localStorage.LOG_LEVEL (silent, error, warn, info, debug)
const Logger = (() => {
    const levelMap = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const getLevelName = () => (localStorage.getItem('LOG_LEVEL') || 'info').toLowerCase();
    const getLevel = () => levelMap[getLevelName()] ?? levelMap.info;
    const prefix = '[ConfigSistema]';
    const should = (min) => getLevel() >= min;
    return {
        setLevel: (name) => localStorage.setItem('LOG_LEVEL', name),
        debug: (...args) => { if (should(4)) console.debug(prefix, ...args); },
        info:  (...args) => { if (should(3)) console.info(prefix, ...args); },
        warn:  (...args) => { if (should(2)) console.warn(prefix, ...args); },
        error: (...args) => { if (should(1)) console.error(prefix, ...args); }
    };
})();
class ConfiguracoesSistema {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
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
        const user = JSON.parse(localStorage.getItem('user'));
        const userName = document.querySelector('.username');
        
        if (userName && user) {
            userName.textContent = user.nome;
        }
        
        // Adicionar indicador de tipo de usuário
        this.updateUserInfo();
    }

    // Função para atualizar informações do usuário no header
    updateUserInfo() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            const userInfo = document.querySelector('.user-info');
            // Removido a exibição do tipo de usuário (Empresa/Operador)
        }
    }

    // Função para adicionar link de aprovação se for empresa
    addApprovalLinkIfNeeded() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.tipoUsuario === 'empresa') {
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

    setupEventListeners() {
        // Navegação do sidebar
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                    // Permitir navegação normal para links válidos
                    return;
                }
                e.preventDefault();
                this.handleNavigation(link);
            });
        });

        // Cards de configurações
        document.querySelectorAll('.analysis-card:not(.info-card)').forEach(card => {
            card.addEventListener('click', () => {
                this.handleConfigCardClick(card);
            });
        });

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

    handleNavigation(link) {
        // Remove active de todos os itens
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Adiciona active ao item clicado
        link.closest('.nav-item').classList.add('active');

        // Navegação entre páginas
        const href = link.getAttribute('href');
        if (href && href !== '#') {
            window.location.href = href;
        }
    }

    handleConfigCardClick(card) {
        const cardTitle = card.querySelector('h3').textContent;
        Logger.info('Abrindo configuração', { cardTitle });
        
        // Adiciona efeito visual
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);

        // Navegação para páginas específicas baseada no card clicado
        switch(cardTitle) {
            case 'Informações da Empresa':
                window.location.href = 'informacoes-empresa.html';
                break;
            default:
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

    showNotification(message) {
        const statusMessage = document.querySelector('.status-message');
        if (!statusMessage) return;

        // Mostra a mensagem
        statusMessage.textContent = message;
        statusMessage.classList.add('show');

        // Remove após 3 segundos
        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
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
            Logger.error('Erro na requisição', error);
            this.showNotification('Erro de conexão. Tente novamente.');
            return null;
        }
    }

    // Função para verificar se o token está expirado
    isTokenExpired() {
        const token = localStorage.getItem('token');
        if (!token) return true;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp < currentTime;
        } catch (error) {
            return true;
        }
    }
}

// Inicializa a página de configurações quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.configuracoesSistema = new ConfiguracoesSistema();
    
    // Verificar expiração do token periodicamente
    setInterval(() => {
        if (window.configuracoesSistema && window.configuracoesSistema.isTokenExpired()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }, 60000); // Verificar a cada minuto
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.configuracoesSistema) {
        // Fechar sidebar em mobile quando redimensionar para desktop
        if (window.innerWidth > 767) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }
});

// Exporta para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfiguracoesSistema;
}
