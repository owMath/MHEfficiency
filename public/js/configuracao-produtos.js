// ===== CONFIGURAÇÃO DE PRODUTOS - JAVASCRIPT =====
// Logger simples com níveis via localStorage.LOG_LEVEL (silent, error, warn, info, debug)
const Logger = (() => {
    const levelMap = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const getLevelName = () => (localStorage.getItem('LOG_LEVEL') || 'info').toLowerCase();
    const getLevel = () => levelMap[getLevelName()] ?? levelMap.info;
    const prefix = '[ConfigProdutos]';
    const should = (min) => getLevel() >= min;
    return {
        setLevel: (name) => localStorage.setItem('LOG_LEVEL', name),
        debug: (...args) => { if (should(4)) console.debug(prefix, ...args); },
        info:  (...args) => { if (should(3)) console.info(prefix, ...args); },
        warn:  (...args) => { if (should(2)) console.warn(prefix, ...args); },
        error: (...args) => { if (should(1)) console.error(prefix, ...args); }
    };
})();

class ConfiguracaoProdutos {
    constructor() {
        this.produtos = [];
        this.configuracoes = [];
        this.produtoSelecionado = null;
        this.configuracaoEditando = null;
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.filtros = {
            search: ''
        };
        
        this.init();
    }

    async init() {
        await this.carregarProdutos();
        await this.carregarConfiguracoes();
        this.configurarEventos();
        this.preencherSelectProdutos();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
    }

    // ===== CONFIGURAÇÃO DE EVENTOS =====
    configurarEventos() {
        // Formulário
        document.getElementById('configProdutoForm').addEventListener('submit', (e) => this.salvarConfiguracao(e));
        document.getElementById('cancelarConfig').addEventListener('click', () => this.cancelarConfiguracao());
        document.getElementById('produtoSelecionado').addEventListener('change', (e) => this.selecionarProduto(e.target.value));

        // Busca
        document.getElementById('searchProdutos').addEventListener('input', (e) => {
            this.filtros.search = e.target.value;
            this.paginaAtual = 1;
            this.carregarConfiguracoes();
        });

        // Botão novo produto
        document.getElementById('novoProduto').addEventListener('click', () => this.novoProduto());

        // Modais
        document.getElementById('closeModal').addEventListener('click', () => this.fecharModal());
        document.getElementById('cancelAction').addEventListener('click', () => this.fecharModal());
        document.getElementById('confirmAction').addEventListener('click', () => this.confirmarAcao());
        document.getElementById('messageClose').addEventListener('click', () => this.fecharModalMensagem());

        // Fechar modal clicando fora
        document.getElementById('confirmModal').addEventListener('click', (e) => {
            if (e.target.id === 'confirmModal') {
                this.fecharModal();
            }
        });

        document.getElementById('messageModal').addEventListener('click', (e) => {
            if (e.target.id === 'messageModal') {
                this.fecharModalMensagem();
            }
        });

        // Logout
        document.querySelector('.logout-btn').addEventListener('click', () => this.logout());

        // Event delegation para botões de ação da tabela
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-action')) {
                const button = e.target.closest('.btn-action');
                const action = button.dataset.action;
                const id = button.dataset.id;
                
                if (action === 'edit') {
                    this.editarConfiguracaoPorId(id);
                } else if (action === 'delete') {
                    this.excluirConfiguracaoPorId(id);
                } else if (action === 'view') {
                    this.visualizarConfiguracaoPorId(id);
                }
            }
        });
    }

    // ===== CARREGAMENTO DE DADOS =====
    async carregarProdutos() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/produtos', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.produtos = data.data || [];
            } else {
                Logger.error('Erro ao carregar produtos', { statusText: response.statusText });
                this.mostrarMensagem('Erro ao carregar produtos', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao carregar produtos', error);
            this.mostrarMensagem('Erro ao carregar produtos', 'error');
        }
    }

    async carregarConfiguracoes() {
        try {
            this.mostrarCarregamento();
            
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: this.paginaAtual,
                limit: this.itensPorPagina,
                search: this.filtros.search
            });

            const response = await fetch(`/api/configuracoes-produtos?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.configuracoes = data.data || [];
                this.renderizarTabela();
                this.renderizarPaginacao(data.pagination);
            } else {
                Logger.error('Erro ao carregar configurações', { statusText: response.statusText });
                this.mostrarMensagem('Erro ao carregar configurações', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao carregar configurações', error);
            this.mostrarMensagem('Erro ao carregar configurações', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== PREENCHIMENTO DE SELECTS =====
    preencherSelectProdutos() {
        const selectProduto = document.getElementById('produtoSelecionado');
        selectProduto.innerHTML = '<option value="">Selecione um produto</option>';
        
        if (this.produtos.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum produto disponível';
            option.disabled = true;
            selectProduto.appendChild(option);
            return;
        }
        
        this.produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto._id;
            option.textContent = `${produto.codigoProduto} - ${produto.nomeProduto}`;
            selectProduto.appendChild(option);
        });
    }

    // ===== SELEÇÃO DE PRODUTO =====
    selecionarProduto(produtoId) {
        if (!produtoId) {
            this.limparFormulario();
            return;
        }

        const produto = this.produtos.find(p => p._id === produtoId);
        if (produto) {
            this.produtoSelecionado = produto;
            this.preencherDadosProduto(produto);
            
            // Verificar se já existe configuração para este produto
            this.verificarConfiguracaoExistente(produtoId);
        }
    }

    preencherDadosProduto(produto) {
        document.getElementById('codigoProduto').value = produto.codigoProduto;
        document.getElementById('categoria').value = produto.categoria || '';
        document.getElementById('descricao').value = produto.descricao || '';
    }

    async verificarConfiguracaoExistente(produtoId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/configuracoes-produtos/produto/${produtoId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data) {
                    this.configuracaoEditando = data.data;
                    this.preencherFormularioConfiguracao(data.data);
                } else {
                    this.limparFormularioConfiguracao();
                }
            }
        } catch (error) {
            Logger.error('Erro ao verificar configuração existente', error);
        }
    }

    preencherFormularioConfiguracao(configuracao) {
        document.getElementById('tempoCiclo').value = configuracao.tempoCiclo || 0;
        document.getElementById('tempoSetup').value = configuracao.tempoSetup || 0;
        document.getElementById('producaoIdeal').value = configuracao.producaoIdeal || 0;
        document.getElementById('temperatura').value = configuracao.temperatura || 0;
        document.getElementById('pressao').value = configuracao.pressao || 0;
        document.getElementById('velocidade').value = configuracao.velocidade || 0;
        document.getElementById('materiaisNecessarios').value = configuracao.materiaisNecessarios || '';
        document.getElementById('instrucoesFabricacao').value = configuracao.instrucoesFabricacao || '';
    }

    limparFormularioConfiguracao() {
        document.getElementById('tempoCiclo').value = 0;
        document.getElementById('tempoSetup').value = 0;
        document.getElementById('producaoIdeal').value = 0;
        document.getElementById('temperatura').value = 0;
        document.getElementById('pressao').value = 0;
        document.getElementById('velocidade').value = 0;
        document.getElementById('materiaisNecessarios').value = '';
        document.getElementById('instrucoesFabricacao').value = '';
    }

    // ===== FORMULÁRIO =====
    async salvarConfiguracao(e) {
        e.preventDefault();
        
        if (!this.produtoSelecionado) {
            this.mostrarMensagem('Selecione um produto primeiro', 'error');
            return;
        }

        try {
            const formData = new FormData(e.target);
            const dados = Object.fromEntries(formData);
            
            // Adicionar ID do produto
            dados.produto = this.produtoSelecionado._id;

            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const url = this.configuracaoEditando ? 
                `/api/configuracoes-produtos/${this.configuracaoEditando._id}` : 
                '/api/configuracoes-produtos';
            const method = this.configuracaoEditando ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                const data = await response.json();
                this.mostrarMensagem(data.message, 'success');
                this.limparFormulario();
                await this.carregarConfiguracoes();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao salvar configuração', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao salvar configuração', error);
            this.mostrarMensagem('Erro ao salvar configuração', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    limparFormulario() {
        document.getElementById('configProdutoForm').reset();
        this.produtoSelecionado = null;
        this.configuracaoEditando = null;
        document.getElementById('produtoSelecionado').value = '';
        this.limparFormularioConfiguracao();
    }

    cancelarConfiguracao() {
        this.limparFormulario();
    }

    novoProduto() {
        this.limparFormulario();
        document.querySelector('.config-section').scrollIntoView({ behavior: 'smooth' });
    }

    // ===== EXCLUSÃO =====
    excluirConfiguracao(configuracao) {
        this.configuracaoEditando = configuracao;
        this.mostrarModalConfirmacao(
            'Excluir Configuração',
            `Tem certeza que deseja excluir a configuração do produto "${configuracao.produto.nomeProduto}"?`,
            'excluir'
        );
    }

    async confirmarExclusao() {
        try {
            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/configuracoes-produtos/${this.configuracaoEditando._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.mostrarMensagem(data.message, 'success');
                await this.carregarConfiguracoes();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao excluir configuração', 'error');
            }
        } catch (error) {
            Logger.error('Erro ao excluir configuração', error);
            this.mostrarMensagem('Erro ao excluir configuração', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== RENDERIZAÇÃO =====
    renderizarTabela() {
        const tbody = document.getElementById('produtosTableBody');
        
        if (this.configuracoes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-wrench"></i>
                        <h3>Nenhuma configuração encontrada</h3>
                        <p>Configure seus produtos usando o formulário acima</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.configuracoes.map(config => `
            <tr>
                <td><strong>${config.produto.codigoProduto}</strong></td>
                <td>${config.produto.nomeProduto}</td>
                <td><span class="categoria-badge ${config.produto.categoria}">${config.produto.categoria}</span></td>
                <td><span class="status-badge configurado">Configurado</span></td>
                <td>${new Date(config.updatedAt).toLocaleDateString('pt-BR')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view" data-action="view" data-id="${config._id}" title="Visualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-edit" data-action="edit" data-id="${config._id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-action="delete" data-id="${config._id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderizarPaginacao(pagination) {
        const paginationDiv = document.getElementById('pagination');
        
        if (!pagination || pagination.pages <= 1) {
            paginationDiv.style.display = 'none';
            return;
        }

        paginationDiv.style.display = 'flex';
        
        const { current, pages, total } = pagination;
        
        paginationDiv.innerHTML = `
            <button class="pagination-btn" ${current === 1 ? 'disabled' : ''} onclick="configuracaoProdutos.irParaPagina(${current - 1})">
                <i class="fas fa-chevron-left"></i>
                Anterior
            </button>
            
            <div class="pagination-info">
                Página ${current} de ${pages} (${total} configurações)
            </div>
            
            <button class="pagination-btn" ${current === pages ? 'disabled' : ''} onclick="configuracaoProdutos.irParaPagina(${current + 1})">
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    irParaPagina(pagina) {
        if (pagina >= 1) {
            this.paginaAtual = pagina;
            this.carregarConfiguracoes();
        }
    }

    // ===== MODAIS =====
    mostrarModalConfirmacao(titulo, mensagem, acao) {
        document.getElementById('modalTitle').textContent = titulo;
        document.getElementById('modalMessage').textContent = mensagem;
        document.getElementById('confirmModal').style.display = 'flex';
        
        // Armazenar ação para confirmação
        this.acaoConfirmacao = acao;
    }

    fecharModal() {
        document.getElementById('confirmModal').style.display = 'none';
        this.acaoConfirmacao = null;
    }

    async confirmarAcao() {
        if (this.acaoConfirmacao === 'excluir') {
            await this.confirmarExclusao();
        }
        this.fecharModal();
    }

    mostrarMensagem(mensagem, tipo = 'success') {
        const icon = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        const title = tipo === 'success' ? 'Sucesso' : 'Erro';
        
        document.getElementById('messageIcon').className = `fas ${icon}`;
        document.getElementById('messageTitle').textContent = title;
        document.getElementById('messageText').textContent = mensagem;
        document.getElementById('messageModal').style.display = 'flex';
    }

    fecharModalMensagem() {
        document.getElementById('messageModal').style.display = 'none';
    }

    mostrarCarregamento() {
        document.getElementById('loadingModal').style.display = 'flex';
    }

    esconderCarregamento() {
        document.getElementById('loadingModal').style.display = 'none';
    }

    // ===== UTILITÁRIOS =====
    async logout() {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        } catch (error) {
            Logger.error('Erro ao fazer logout', error);
            window.location.href = 'login.html';
        }
    }

    // Método para buscar configuração por ID (usado pelos botões de ação)
    async buscarConfiguracaoPorId(id) {
        const configuracao = this.configuracoes.find(c => c._id === id);
        if (configuracao) {
            return configuracao;
        }

        // Se não encontrou na lista atual, buscar no servidor
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/configuracoes-produtos/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data;
            }
        } catch (error) {
            Logger.error('Erro ao buscar configuração', error);
        }
        
        return null;
    }

    // Métodos para serem chamados pelos botões de ação
    async editarConfiguracaoPorId(id) {
        const configuracao = await this.buscarConfiguracaoPorId(id);
        if (configuracao) {
            this.editarConfiguracao(configuracao);
        }
    }

    async excluirConfiguracaoPorId(id) {
        const configuracao = await this.buscarConfiguracaoPorId(id);
        if (configuracao) {
            this.excluirConfiguracao(configuracao);
        }
    }

    async visualizarConfiguracaoPorId(id) {
        const configuracao = await this.buscarConfiguracaoPorId(id);
        if (configuracao) {
            this.visualizarConfiguracao(configuracao);
        }
    }

    editarConfiguracao(configuracao) {
        this.configuracaoEditando = configuracao;
        this.produtoSelecionado = configuracao.produto;
        
        // Preencher formulário
        document.getElementById('produtoSelecionado').value = configuracao.produto._id;
        this.preencherDadosProduto(configuracao.produto);
        this.preencherFormularioConfiguracao(configuracao);
        
        // Scroll para o formulário
        document.querySelector('.config-section').scrollIntoView({ behavior: 'smooth' });
    }

    visualizarConfiguracao(configuracao) {
        // Aqui você pode implementar um modal de visualização
        // Por enquanto, vamos apenas mostrar os dados em um alert
        const dados = `
Produto: ${configuracao.produto.nomeProduto}
Código: ${configuracao.produto.codigoProduto}
Tempo de Ciclo: ${configuracao.tempoCiclo}s
Tempo de Setup: ${configuracao.tempoSetup}s
Produção Ideal: ${configuracao.producaoIdeal} unidades/hora
Temperatura: ${configuracao.temperatura}°C
Pressão: ${configuracao.pressao} bar
Velocidade: ${configuracao.velocidade} rpm
        `;
        
        alert(dados);
    }

    // ===== TIMESTAMP =====
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
}

// ===== INICIALIZAÇÃO =====
let configuracaoProdutos;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Inicializar aplicação
    configuracaoProdutos = new ConfiguracaoProdutos();
});

// ===== FUNÇÕES GLOBAIS PARA OS BOTÕES =====
window.configuracaoProdutos = configuracaoProdutos;
