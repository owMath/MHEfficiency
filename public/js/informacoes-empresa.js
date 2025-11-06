// JavaScript para página de Informações da Empresa
class InformacoesEmpresa {
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
        this.loadEmpresaData();
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

    // Função para carregar dados da empresa
    async loadEmpresaData() {
        try {
            // Primeiro, tentar carregar dados do usuário logado
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (userData.tipoUsuario === 'empresa' && userData.empresa) {
                const empresaData = userData.empresa;
                
                // Preencher formulário com dados do usuário
                document.getElementById('empresa-nome').value = empresaData.nome || '';
                document.getElementById('empresa-cnpj').value = empresaData.cnpj || '';
                document.getElementById('empresa-razao-social').value = empresaData.nome || '';
                document.getElementById('moeda-padrao').value = 'BRL';
                document.getElementById('empresa-cep').value = empresaData.endereco?.cep || '';
                document.getElementById('empresa-endereco').value = empresaData.endereco?.rua || '';
                document.getElementById('empresa-numero').value = empresaData.endereco?.numero || '';
                document.getElementById('empresa-bairro').value = empresaData.endereco?.bairro || '';
                document.getElementById('empresa-cidade').value = empresaData.endereco?.cidade || '';
                document.getElementById('empresa-estado').value = empresaData.endereco?.estado || '';
                document.getElementById('empresa-telefone').value = empresaData.telefone || '';
                document.getElementById('empresa-celular').value = empresaData.telefone || '';
                document.getElementById('empresa-email').value = userData.email || '';
                document.getElementById('empresa-website').value = '';
                
                this.showNotification('Dados da empresa carregados com sucesso!');
                return;
            }
            
            // Se não encontrar dados no localStorage, tentar API
            const response = await this.makeAuthenticatedRequest('/api/configuracoes/empresa');
            
            if (response && response.ok) {
                const result = await response.json();
                const empresaData = result.data;
                
                // Preencher formulário com dados do banco
                document.getElementById('empresa-nome').value = empresaData.nome || '';
                document.getElementById('empresa-cnpj').value = empresaData.cnpj || '';
                document.getElementById('empresa-razao-social').value = empresaData.razaoSocial || '';
                document.getElementById('moeda-padrao').value = empresaData.moedaPadrao || 'BRL';
                document.getElementById('empresa-cep').value = empresaData.cep || '';
                document.getElementById('empresa-endereco').value = empresaData.endereco || '';
                document.getElementById('empresa-numero').value = empresaData.numero || '';
                document.getElementById('empresa-bairro').value = empresaData.bairro || '';
                document.getElementById('empresa-cidade').value = empresaData.cidade || '';
                document.getElementById('empresa-estado').value = empresaData.estado || '';
                document.getElementById('empresa-telefone').value = empresaData.telefone || '';
                document.getElementById('empresa-celular').value = empresaData.celular || '';
                document.getElementById('empresa-email').value = empresaData.email || '';
                document.getElementById('empresa-website').value = empresaData.website || '';
                
                this.showNotification('Dados da empresa carregados com sucesso!');
            } else {
                this.setDefaultValues();
            }
        } catch (error) {
            console.error('Erro ao carregar dados da empresa:', error);
            this.setDefaultValues();
            this.showNotification('Erro ao carregar dados. Usando valores padrão.');
        }
    }

    setDefaultValues() {
        document.getElementById('empresa-nome').value = '';
        document.getElementById('empresa-cnpj').value = '';
        document.getElementById('empresa-razao-social').value = '';
        document.getElementById('moeda-padrao').value = 'BRL';
        document.getElementById('empresa-cep').value = '';
        document.getElementById('empresa-endereco').value = '';
        document.getElementById('empresa-numero').value = '';
        document.getElementById('empresa-bairro').value = '';
        document.getElementById('empresa-cidade').value = '';
        document.getElementById('empresa-estado').value = '';
        document.getElementById('empresa-telefone').value = '';
        document.getElementById('empresa-celular').value = '';
        document.getElementById('empresa-email').value = '';
        document.getElementById('empresa-website').value = '';
    }

    setupEventListeners() {
        // Navegação do sidebar
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href !== '#') {
                    return;
                }
                e.preventDefault();
                this.handleNavigation(link);
            });
        });

        // Botões de ação - usando IDs para evitar conflitos
        const btnSave = document.getElementById('btn-save');
        const btnCancel = document.getElementById('btn-cancel');
        const btnReset = document.getElementById('btn-reset');

        if (btnSave) {
            btnSave.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSave();
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleCancel();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleReset();
            });
        }

        // Máscaras para campos
        this.setupMasks();

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

    setupMasks() {
        // Máscara para CNPJ
        const cnpjInput = document.getElementById('empresa-cnpj');
        if (cnpjInput) {
            cnpjInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '$1.$2');
                value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                e.target.value = value;
            });
        }

        // Máscara para CEP
        const cepInput = document.getElementById('empresa-cep');
        if (cepInput) {
            cepInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{5})(\d)/, '$1-$2');
                e.target.value = value;
            });
        }

        // Máscara para telefone
        const telefoneInput = document.getElementById('empresa-telefone');
        if (telefoneInput) {
            telefoneInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '($1) $2');
                value = value.replace(/(\d{4})(\d)/, '$1-$2');
                e.target.value = value;
            });
        }

        // Máscara para celular
        const celularInput = document.getElementById('empresa-celular');
        if (celularInput) {
            celularInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/, '($1) $2');
                value = value.replace(/(\d{5})(\d)/, '$1-$2');
                e.target.value = value;
            });
        }
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

    // Métodos para lidar com os botões de ação
    async handleSave() {
        const formData = this.collectFormData();
        
        // Validar dados obrigatórios
        if (!this.validateForm(formData)) {
            return;
        }
        
        // Verificar se o token ainda é válido
        if (this.isTokenExpired()) {
            this.showNotification('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        try {
            this.showNotification('Salvando informações...');
            
            console.log('💾 Dados a serem salvos:', formData);
            
            const response = await this.makeAuthenticatedRequest('/api/configuracoes/empresa', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            console.log('📊 Status da resposta:', response.status);
            
            if (response && response.ok) {
                const result = await response.json();
                this.showNotification('Informações da empresa salvas com sucesso!');
                console.log('✅ Dados salvos:', result.data);
            } else {
                let errorMessage = 'Erro desconhecido';
                try {
                    const error = await response.json();
                    errorMessage = error.error || error.message || 'Erro ao salvar';
                } catch (e) {
                    errorMessage = `Erro ${response.status}: ${response.statusText}`;
                }
                this.showNotification(`Erro ao salvar: ${errorMessage}`);
                console.error('❌ Erro detalhado:', errorMessage);
            }
        } catch (error) {
            console.error('❌ Erro ao salvar dados da empresa:', error);
            this.showNotification('Erro ao salvar informações. Tente novamente.');
        }
    }

    async handleCancel() {
        if (confirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.')) {
            await this.loadEmpresaData();
            this.showNotification('Alterações canceladas.');
        }
    }

    handleReset() {
        if (confirm('Tem certeza que deseja resetar todas as informações para os valores padrão?')) {
            this.resetFormToDefaults();
            this.showNotification('Informações resetadas para os valores padrão.');
        }
    }

    resetFormToDefaults() {
        // Resetar para valores padrão
        document.getElementById('empresa-nome').value = '';
        document.getElementById('empresa-cnpj').value = '';
        document.getElementById('empresa-razao-social').value = '';
        document.getElementById('moeda-padrao').value = 'BRL';
        document.getElementById('empresa-cep').value = '';
        document.getElementById('empresa-endereco').value = '';
        document.getElementById('empresa-numero').value = '';
        document.getElementById('empresa-bairro').value = '';
        document.getElementById('empresa-cidade').value = '';
        document.getElementById('empresa-estado').value = '';
        document.getElementById('empresa-telefone').value = '';
        document.getElementById('empresa-celular').value = '';
        document.getElementById('empresa-email').value = '';
        document.getElementById('empresa-website').value = '';
    }

    collectFormData() {
        return {
            nome: document.getElementById('empresa-nome').value,
            cnpj: document.getElementById('empresa-cnpj').value,
            razaoSocial: document.getElementById('empresa-razao-social').value,
            moedaPadrao: document.getElementById('moeda-padrao').value,
            cep: document.getElementById('empresa-cep').value,
            endereco: document.getElementById('empresa-endereco').value,
            numero: document.getElementById('empresa-numero').value,
            bairro: document.getElementById('empresa-bairro').value,
            cidade: document.getElementById('empresa-cidade').value,
            estado: document.getElementById('empresa-estado').value,
            telefone: document.getElementById('empresa-telefone').value,
            celular: document.getElementById('empresa-celular').value,
            email: document.getElementById('empresa-email').value,
            website: document.getElementById('empresa-website').value
        };
    }

    validateForm(data) {
        if (!data.nome.trim()) {
            this.showNotification('Nome da empresa é obrigatório.');
            document.getElementById('empresa-nome').focus();
            return false;
        }

        if (!data.email.trim()) {
            this.showNotification('E-mail é obrigatório.');
            document.getElementById('empresa-email').focus();
            return false;
        }

        // Validar formato do e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            this.showNotification('E-mail inválido.');
            document.getElementById('empresa-email').focus();
            return false;
        }

        return true;
    }

    // Método para fazer requisições autenticadas
    async makeAuthenticatedRequest(url, options = {}) {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('Token não encontrado');
        }

        // Verificar se o token está expirado
        if (this.isTokenExpired()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            throw new Error('Token expirado');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        // Debug: Log da URL e opções
        console.log('🔍 Fazendo requisição para:', url);
        console.log('🔍 Opções:', finalOptions);
        
        try {
            // Usar URL absoluta se necessário
            const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
            console.log('🌐 URL completa:', fullUrl);
            
            const response = await fetch(fullUrl, finalOptions);
            
            // Debug: Log da resposta
            console.log('📡 Resposta recebida:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            return response;
        } catch (error) {
            console.error('❌ Erro na requisição:', error);
            throw error;
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

    showNotification(message) {
        const statusMessage = document.querySelector('.status-message');
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.classList.add('show');

        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
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

// Inicializa a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.informacoesEmpresa = new InformacoesEmpresa();
    
    // Verificar expiração do token periodicamente
    setInterval(() => {
        if (window.informacoesEmpresa && window.informacoesEmpresa.isTokenExpired()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }, 60000);
});

// Adiciona listener para redimensionamento da janela
window.addEventListener('resize', () => {
    if (window.informacoesEmpresa) {
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
    module.exports = InformacoesEmpresa;
}
