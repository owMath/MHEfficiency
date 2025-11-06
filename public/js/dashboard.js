// Dashboard JavaScript com Autenticação
class OEEDashboard {
    constructor() {
        // Verificar autenticação primeiro
        if (!this.checkAuth()) {
            return;
        }

        // Captura as máquinas declaradas no HTML; inicialmente sem dados
        this.machines = Array.from(document.querySelectorAll('.machine-card')).map(card => ({
            id: card.dataset.machine,
            name: card.dataset.machine,
            status: 'unknown'
        }));

        this.init();
    }

    init() {
        this.loadUserData();
        this.setupEventListeners();
        this.initializePlaceholders();
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
                console.log('Link clicado:', href);
                if (href && href !== '#') {
                    console.log('Navegando para:', href);
                    // Permitir navegação normal para links válidos
                    return;
                }
                e.preventDefault();
                this.handleNavigation(link);
            });
        });

        // Cards de análise (apenas para cards sem link)
        document.querySelectorAll('.analysis-card:not(.info-card):not(:has(.card-link))').forEach(card => {
            card.addEventListener('click', () => {
                this.handleAnalysisCardClick(card);
            });
        });

        // Cards de gestão
        document.querySelectorAll('.management-card').forEach(card => {
            card.addEventListener('click', () => {
                this.handleManagementCardClick(card);
            });
        });

        // Cards de máquinas
        document.querySelectorAll('.machine-card').forEach(card => {
            card.addEventListener('click', () => {
                this.handleMachineCardClick(card);
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

    handleAnalysisCardClick(card) {
        const cardTitle = card.querySelector('h3').textContent;
        console.log(`Abrindo análise: ${cardTitle}`);
        
        // Adiciona efeito visual
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);

        // Aqui você pode implementar a navegação para páginas específicas
    }

    handleManagementCardClick(card) {
        const cardTitle = card.querySelector('h3').textContent;
        const link = card.getAttribute('data-link');
        
        console.log(`Abrindo gestão: ${cardTitle}`);
        
        // Adiciona efeito visual
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = '';
            
            // Redireciona se houver link
            if (link) {
                window.location.href = link;
            }
        }, 150);
    }

    handleMachineCardClick(card) {
        const machineId = card.dataset.machine;
        console.log(`Abrindo detalhes da máquina: ${machineId}`);
        
        // Adiciona efeito visual
        card.style.transform = 'scale(0.98)';
        setTimeout(() => {
            card.style.transform = '';
        }, 150);

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

    initializePlaceholders() {
        this.machines.forEach(machine => {
            const card = document.querySelector(`[data-machine="${machine.id}"]`);
            if (!card) return;
            const indicator = card.querySelector('.status-indicator');
            if (indicator) {
                indicator.className = 'status-indicator unknown';
            }
            const metricElements = card.querySelectorAll('.metric-value');
            metricElements.forEach(el => el.textContent = '--%');
        });
    }

    // Atualiza métricas para uma máquina com dados reais
    updateMachineMetrics(machineId, metrics) {
        const card = document.querySelector(`[data-machine="${machineId}"]`);
        if (!card) return;
        // Atualiza os valores na interface
        const metricElements = card.querySelectorAll('.metric-value');
        metricElements[0].textContent = metrics?.oee != null ? `${Number(metrics.oee).toFixed(1)}%` : '--%';
        metricElements[1].textContent = metrics?.disponibilidade != null ? `${Number(metrics.disponibilidade).toFixed(1)}%` : '--%';
        metricElements[2].textContent = metrics?.performance != null ? `${Number(metrics.performance).toFixed(1)}%` : '--%';
        metricElements[3].textContent = metrics?.qualidade != null ? `${Number(metrics.qualidade).toFixed(1)}%` : '--%';
    }

    // Atualiza visualmente o status de uma máquina
    updateMachineStatus(machineId, status) {
        const allowed = ['online', 'warning', 'offline', 'unknown'];
        const safeStatus = allowed.includes(status) ? status : 'unknown';
        const card = document.querySelector(`[data-machine="${machineId}"]`);
        if (!card) return;
        const indicator = card.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = `status-indicator ${safeStatus}`;
        }
        const machine = this.machines.find(m => m.id === machineId);
        if (machine) machine.status = safeStatus;
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
            console.error('Erro na requisição:', error);
            this.showNotification('Erro de conexão. Tente novamente.');
            return null;
        }
    }

    // Método para conectar com WebSocket (futuro)
    connectWebSocket() {
        // Implementação futura para conexão com Raspberry Pi (sem simulação)
        console.log('Aguardando implementação de WebSocket para dados reais...');
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

// Inicializa a dashboard quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.oeeDashboard = new OEEDashboard();
    
    // Verificar expiração do token periodicamente
    setInterval(() => {
        if (window.oeeDashboard && window.oeeDashboard.isTokenExpired()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }, 60000); // Verificar a cada minuto
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.oeeDashboard) {
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
    module.exports = OEEDashboard;
}