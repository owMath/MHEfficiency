// ===== CADASTRO DE PRODUTOS - JAVASCRIPT =====

class CadastroProdutos {
    constructor() {
        this.produtos = [];
        this.maquinas = [];
        this.produtoEditando = null;
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.filtros = {
            search: '',
            categoria: '',
            maquina: ''
        };
        
        this.init();
    }

    async init() {
        await this.carregarMaquinas();
        await this.carregarProdutos();
        this.configurarEventos();
        this.gerarCodigoProduto();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
    }

    // ===== CONFIGURAÇÃO DE EVENTOS =====
    configurarEventos() {
        // Formulário
        document.getElementById('produtoForm').addEventListener('submit', (e) => this.salvarProduto(e));
        document.getElementById('limparFormulario').addEventListener('click', () => this.limparFormulario());
        document.getElementById('editarProduto').addEventListener('click', () => this.cancelarEdicao());

        // Busca
        document.getElementById('searchProdutos').addEventListener('input', (e) => {
            this.filtros.search = e.target.value;
            this.paginaAtual = 1;
            this.carregarProdutos();
        });

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
                    this.editarProdutoPorId(id);
                } else if (action === 'delete') {
                    this.excluirProdutoPorId(id);
                }
            }
        });
    }

    // ===== CARREGAMENTO DE DADOS =====
    async carregarMaquinas() {
        try {
            const token = localStorage.getItem('token');
            
            // Usar a rota específica de produtos que filtra máquinas ativas
            const response = await fetch('/api/produtos/machines', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.maquinas = data.data || [];
                this.preencherSelectMaquinas();
            } else {
                const errorData = await response.json().catch(() => ({}));
                this.mostrarMensagem('Erro ao carregar máquinas: ' + (errorData.message || response.statusText), 'error');
            }
        } catch (error) {
            this.mostrarMensagem('Erro ao carregar máquinas: ' + error.message, 'error');
        }
    }

    async carregarProdutos() {
        try {
            this.mostrarCarregamento();
            
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: this.paginaAtual,
                limit: this.itensPorPagina,
                search: this.filtros.search,
                categoria: this.filtros.categoria,
                maquina: this.filtros.maquina
            });

            const response = await fetch(`/api/produtos?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.produtos = data.data || [];
                this.renderizarTabela();
                this.renderizarPaginacao(data.pagination);
            } else {
                console.error('Erro ao carregar produtos:', response.statusText);
                this.mostrarMensagem('Erro ao carregar produtos', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            this.mostrarMensagem('Erro ao carregar produtos', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== PREENCHIMENTO DE SELECTS =====
    preencherSelectMaquinas() {
        const selectMaquina = document.getElementById('maquina');
        selectMaquina.innerHTML = '<option value="">Selecione uma máquina</option>';
        
        if (this.maquinas.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhuma máquina disponível';
            option.disabled = true;
            selectMaquina.appendChild(option);
            return;
        }
        
        this.maquinas.forEach(maquina => {
            const option = document.createElement('option');
            option.value = maquina.machineId;
            // Usar nome se existir, senão usar machineId como nome
            const nomeMaquina = maquina.nome || maquina.machineId;
            // Se nome e machineId são diferentes, mostrar ambos, senão mostrar só um
            const displayText = (maquina.nome && maquina.nome !== maquina.machineId) 
                ? `${maquina.machineId} - ${nomeMaquina}`
                : nomeMaquina;
            option.textContent = displayText;
            selectMaquina.appendChild(option);
        });
    }

    // ===== GERAÇÃO DE CÓDIGO =====
    gerarCodigoProduto() {
        const codigoInput = document.getElementById('codigoProduto');
        const proximoCodigo = `PROD${String(this.produtos.length + 1).padStart(3, '0')}`;
        codigoInput.value = proximoCodigo;
    }

    // ===== FORMULÁRIO =====
    async salvarProduto(e) {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.target);
            const dados = Object.fromEntries(formData);
            
            // Validar campos obrigatórios
            if (!dados.nomeProduto || !dados.maquina) {
                this.mostrarMensagem('Preencha todos os campos obrigatórios', 'error');
                return;
            }

            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const url = this.produtoEditando ? `/api/produtos/${this.produtoEditando._id}` : '/api/produtos';
            const method = this.produtoEditando ? 'PUT' : 'POST';

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
                await this.carregarProdutos();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao salvar produto', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            this.mostrarMensagem('Erro ao salvar produto', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    limparFormulario() {
        document.getElementById('produtoForm').reset();
        this.produtoEditando = null;
        this.gerarCodigoProduto();
        
        // Esconder botão de edição
        document.getElementById('editarProduto').style.display = 'none';
        
        // Mostrar botão de salvar
        document.querySelector('.btn-success').style.display = 'flex';
    }

    editarProduto(produto) {
        this.produtoEditando = produto;
        
        // Preencher formulário
        document.getElementById('codigoProduto').value = produto.codigoProduto;
        document.getElementById('nomeProduto').value = produto.nomeProduto;
        document.getElementById('categoria').value = produto.categoria;
        document.getElementById('maquina').value = produto.maquina.machineId;
        document.getElementById('unidadeMedida').value = produto.unidadeMedida || '';
        document.getElementById('peso').value = produto.peso || 0;
        document.getElementById('dimensoes').value = produto.dimensoes || '';
        document.getElementById('cor').value = produto.cor || '';
        document.getElementById('materialPrincipal').value = produto.materialPrincipal || '';
        document.getElementById('fornecedor').value = produto.fornecedor || '';
        document.getElementById('precoUnitario').value = produto.precoUnitario || 0;
        document.getElementById('estoqueMinimo').value = produto.estoqueMinimo || 0;
        document.getElementById('descricao').value = produto.descricao || '';
        document.getElementById('observacoes').value = produto.observacoes || '';
        
        // Mostrar botão de edição e esconder salvar
        document.getElementById('editarProduto').style.display = 'flex';
        document.querySelector('.btn-success').style.display = 'none';
        
        // Scroll para o formulário
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    }

    cancelarEdicao() {
        this.limparFormulario();
    }

    // ===== EXCLUSÃO =====
    excluirProduto(produto) {
        this.produtoEditando = produto;
        this.mostrarModalConfirmacao(
            'Excluir Produto',
            `Tem certeza que deseja excluir o produto "${produto.nomeProduto}"?`,
            'excluir'
        );
    }

    async confirmarExclusao() {
        try {
            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/produtos/${this.produtoEditando._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.mostrarMensagem(data.message, 'success');
                await this.carregarProdutos();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao excluir produto', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            this.mostrarMensagem('Erro ao excluir produto', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== RENDERIZAÇÃO =====
    renderizarTabela() {
        const tbody = document.getElementById('produtosTableBody');
        
        if (this.produtos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>Nenhum produto encontrado</h3>
                        <p>Cadastre seu primeiro produto usando o formulário acima</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.produtos.map(produto => `
            <tr>
                <td><strong>${produto.codigoProduto}</strong></td>
                <td>${produto.nomeProduto}</td>
                <td><span class="categoria-badge ${produto.categoria}">${produto.categoria}</span></td>
                <td>${produto.maquina ? `${produto.maquina.nome || produto.maquina.machineId}` : '-'}</td>
                <td>${produto.unidadeMedida || '-'}</td>
                <td>R$ ${(produto.precoUnitario || 0).toFixed(2).replace('.', ',')}</td>
                <td>${produto.estoqueMinimo || 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-action="edit" data-id="${produto._id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-action="delete" data-id="${produto._id}" title="Excluir">
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
            <button class="pagination-btn" ${current === 1 ? 'disabled' : ''} onclick="cadastroProdutos.irParaPagina(${current - 1})">
                <i class="fas fa-chevron-left"></i>
                Anterior
            </button>
            
            <div class="pagination-info">
                Página ${current} de ${pages} (${total} produtos)
            </div>
            
            <button class="pagination-btn" ${current === pages ? 'disabled' : ''} onclick="cadastroProdutos.irParaPagina(${current + 1})">
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    irParaPagina(pagina) {
        if (pagina >= 1) {
            this.paginaAtual = pagina;
            this.carregarProdutos();
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
            console.error('Erro ao fazer logout:', error);
            window.location.href = 'login.html';
        }
    }

    // Método para buscar produto por ID (usado pelos botões de ação)
    async buscarProdutoPorId(id) {
        const produto = this.produtos.find(p => p._id === id);
        if (produto) {
            return produto;
        }

        // Se não encontrou na lista atual, buscar no servidor
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/produtos/${id}`, {
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
            console.error('Erro ao buscar produto:', error);
        }
        
        return null;
    }

    // Métodos para serem chamados pelos botões de ação
    async editarProdutoPorId(id) {
        const produto = await this.buscarProdutoPorId(id);
        if (produto) {
            this.editarProduto(produto);
        }
    }

    async excluirProdutoPorId(id) {
        const produto = await this.buscarProdutoPorId(id);
        if (produto) {
            this.excluirProduto(produto);
        }
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
let cadastroProdutos;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Inicializar aplicação
    cadastroProdutos = new CadastroProdutos();
});

// ===== FUNÇÕES GLOBAIS PARA OS BOTÕES =====
window.cadastroProdutos = cadastroProdutos;
