// ===== VÍNCULO PRODUTO-MÁQUINA - JAVASCRIPT =====

class VinculoProdutoMaquina {
    constructor() {
        this.produtosConfigurados = [];
        this.vinculos = [];
        this.produtoSelecionado = null;
        this.vinculoEditando = null;
        this.paginaAtual = 1;
        this.itensPorPagina = 10;
        this.filtros = {
            search: ''
        };
        
        this.init();
    }

    async init() {
        await this.carregarProdutosConfigurados();
        await this.carregarVinculos();
        this.configurarEventos();
        this.preencherSelectProdutos();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
    }

    // ===== CONFIGURAÇÃO DE EVENTOS =====
    configurarEventos() {
        // Formulário
        document.getElementById('vinculoForm').addEventListener('submit', (e) => this.salvarVinculo(e));
        document.getElementById('limparFormulario').addEventListener('click', () => this.limparFormulario());
        document.getElementById('produtoSelecionado').addEventListener('change', (e) => this.selecionarProduto(e.target.value));

        // Busca
        document.getElementById('searchVinculos').addEventListener('input', (e) => {
            this.filtros.search = e.target.value;
            this.paginaAtual = 1;
            this.carregarVinculos();
        });

        document.getElementById('buscarVinculos').addEventListener('click', () => {
            this.paginaAtual = 1;
            this.carregarVinculos();
        });

        document.getElementById('atualizarVinculos').addEventListener('click', () => {
            this.carregarVinculos();
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
                    this.editarVinculoPorId(id);
                } else if (action === 'delete') {
                    this.excluirVinculoPorId(id);
                }
            }
        });
    }

    // ===== CARREGAMENTO DE DADOS =====
    async carregarProdutosConfigurados() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/configuracoes-produtos', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.produtosConfigurados = data.data || [];
            } else {
                console.error('Erro ao carregar produtos configurados:', response.statusText);
                this.mostrarMensagem('Erro ao carregar produtos configurados', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar produtos configurados:', error);
            this.mostrarMensagem('Erro ao carregar produtos configurados', 'error');
        }
    }

    async carregarVinculos() {
        try {
            this.mostrarCarregamento();
            
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: this.paginaAtual,
                limit: this.itensPorPagina,
                search: this.filtros.search
            });

            const response = await fetch(`/api/vinculos-produto-maquina?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.vinculos = data.data || [];
                this.renderizarTabela();
                this.renderizarPaginacao(data.pagination);
            } else {
                console.error('Erro ao carregar vínculos:', response.statusText);
                this.mostrarMensagem('Erro ao carregar vínculos', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar vínculos:', error);
            this.mostrarMensagem('Erro ao carregar vínculos', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== PREENCHIMENTO DE SELECTS =====
    preencherSelectProdutos() {
        const selectProduto = document.getElementById('produtoSelecionado');
        selectProduto.innerHTML = '<option value="">Selecione um produto</option>';
        
        if (this.produtosConfigurados.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum produto configurado disponível';
            option.disabled = true;
            selectProduto.appendChild(option);
            return;
        }
        
        this.produtosConfigurados.forEach(config => {
            const option = document.createElement('option');
            option.value = config._id;
            option.textContent = `${config.produto.codigoProduto} - ${config.produto.nomeProduto}`;
            selectProduto.appendChild(option);
        });
    }

    // ===== SELEÇÃO DE PRODUTO =====
    selecionarProduto(configuracaoId) {
        if (!configuracaoId) {
            this.limparFormulario();
            return;
        }

        const configuracao = this.produtosConfigurados.find(c => c._id === configuracaoId);
        if (configuracao) {
            this.produtoSelecionado = configuracao;
            this.preencherDadosProduto(configuracao);
        }
    }

    preencherDadosProduto(configuracao) {
        // Preencher máquina (será definida automaticamente baseada no produto)
        const selectMaquina = document.getElementById('maquinaSelecionada');
        
        if (configuracao.produto.maquina && typeof configuracao.produto.maquina === 'object') {
            // Se a máquina está populada como objeto, mostrar o nome da máquina
            const nomeMaquina = configuracao.produto.maquina.nome || configuracao.produto.maquina.machineId;
            const idMaquina = configuracao.produto.maquina._id;
            selectMaquina.innerHTML = `<option value="${idMaquina}">${nomeMaquina}</option>`;
        } else if (configuracao.produto.maquina && typeof configuracao.produto.maquina === 'string') {
            // Se máquina é apenas um ID (string), usar esse ID
            selectMaquina.innerHTML = `<option value="${configuracao.produto.maquina}">Máquina ID: ${configuracao.produto.maquina}</option>`;
        } else {
            // Fallback caso a máquina não esteja populada
            selectMaquina.innerHTML = `<option value="">Máquina será definida automaticamente</option>`;
        }
        
        // Preencher especificações técnicas
        document.getElementById('tempoCiclo').value = Math.round(configuracao.tempoCiclo); // Manter em segundos, sem decimais
        document.getElementById('tempoSetup').value = Math.round(configuracao.tempoSetup); // Manter em segundos, sem decimais
        document.getElementById('producaoIdeal').value = configuracao.producaoIdeal || 0;
    }

    // ===== FORMULÁRIO =====
    async salvarVinculo(e) {
        e.preventDefault();
        
        if (!this.produtoSelecionado) {
            this.mostrarMensagem('Selecione um produto primeiro', 'error');
            return;
        }

        try {
            const formData = new FormData(e.target);
            const dados = Object.fromEntries(formData);
            
            // Adicionar dados da configuração
            dados.configuracaoProduto = this.produtoSelecionado._id;
            dados.produto = this.produtoSelecionado.produto._id;
            
            // Verificar se a máquina está populada corretamente
            if (this.produtoSelecionado.produto.maquina && this.produtoSelecionado.produto.maquina._id) {
                dados.maquina = this.produtoSelecionado.produto.maquina._id;
            } else if (this.produtoSelecionado.produto.maquina) {
                // Se máquina é apenas um ID (string)
                dados.maquina = this.produtoSelecionado.produto.maquina;
            } else {
                throw new Error('Máquina não encontrada para este produto');
            }

            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const url = this.vinculoEditando ? 
                `/api/vinculos-produto-maquina/${this.vinculoEditando._id}` : 
                '/api/vinculos-produto-maquina';
            const method = this.vinculoEditando ? 'PUT' : 'POST';

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
                await this.carregarVinculos();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao salvar vínculo', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar vínculo:', error);
            this.mostrarMensagem('Erro ao salvar vínculo', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    limparFormulario() {
        document.getElementById('vinculoForm').reset();
        this.produtoSelecionado = null;
        this.vinculoEditando = null;
        document.getElementById('produtoSelecionado').value = '';
        document.getElementById('maquinaSelecionada').innerHTML = '<option value="">Máquina será definida automaticamente</option>';
        document.getElementById('tempoCiclo').value = '0.00';
        document.getElementById('tempoSetup').value = '0.00';
        document.getElementById('producaoIdeal').value = '0';
    }

    // ===== EXCLUSÃO =====
    excluirVinculo(vinculo) {
        this.vinculoEditando = vinculo;
        this.mostrarModalConfirmacao(
            'Excluir Vínculo',
            `Tem certeza que deseja excluir o vínculo entre "${vinculo.produto.nomeProduto}" e a máquina?`,
            'excluir'
        );
    }

    async confirmarExclusao() {
        try {
            this.mostrarCarregamento();

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/vinculos-produto-maquina/${this.vinculoEditando._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.mostrarMensagem(data.message, 'success');
                await this.carregarVinculos();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao excluir vínculo', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir vínculo:', error);
            this.mostrarMensagem('Erro ao excluir vínculo', 'error');
        } finally {
            this.esconderCarregamento();
        }
    }

    // ===== RENDERIZAÇÃO =====
    renderizarTabela() {
        const tbody = document.getElementById('vinculosTableBody');
        
        if (this.vinculos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-link"></i>
                        <h3>Nenhum vínculo encontrado</h3>
                        <p>Crie seu primeiro vínculo produto-máquina usando o formulário acima</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.vinculos.map(vinculo => `
            <tr>
                <td><strong>${vinculo.produto.codigoProduto}</strong><br>${vinculo.produto.nomeProduto}</td>
                <td><strong>${vinculo.maquina.machineId}</strong><br>${vinculo.maquina.nome || ''}</td>
                <td>${Math.round(vinculo.tempoCiclo)}</td>
                <td>${Math.round(vinculo.tempoSetup)}</td>
                <td>${vinculo.producaoIdeal}</td>
                <td>${vinculo.observacoes || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-action="edit" data-id="${vinculo._id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" data-action="delete" data-id="${vinculo._id}" title="Excluir">
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
            <button class="pagination-btn" ${current === 1 ? 'disabled' : ''} onclick="vinculoProdutoMaquina.irParaPagina(${current - 1})">
                <i class="fas fa-chevron-left"></i>
                Anterior
            </button>
            
            <div class="pagination-info">
                Página ${current} de ${pages} (${total} vínculos)
            </div>
            
            <button class="pagination-btn" ${current === pages ? 'disabled' : ''} onclick="vinculoProdutoMaquina.irParaPagina(${current + 1})">
                Próxima
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    irParaPagina(pagina) {
        if (pagina >= 1) {
            this.paginaAtual = pagina;
            this.carregarVinculos();
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

    // Método para buscar vínculo por ID (usado pelos botões de ação)
    async buscarVinculoPorId(id) {
        const vinculo = this.vinculos.find(v => v._id === id);
        if (vinculo) {
            return vinculo;
        }

        // Se não encontrou na lista atual, buscar no servidor
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/vinculos-produto-maquina/${id}`, {
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
            console.error('Erro ao buscar vínculo:', error);
        }
        
        return null;
    }

    // Métodos para serem chamados pelos botões de ação
    async editarVinculoPorId(id) {
        const vinculo = await this.buscarVinculoPorId(id);
        if (vinculo) {
            this.editarVinculo(vinculo);
        }
    }

    async excluirVinculoPorId(id) {
        const vinculo = await this.buscarVinculoPorId(id);
        if (vinculo) {
            this.excluirVinculo(vinculo);
        }
    }

    editarVinculo(vinculo) {
        this.vinculoEditando = vinculo;
        
        // Encontrar a configuração correspondente
        const configuracao = this.produtosConfigurados.find(c => c.produto._id === vinculo.produto._id);
        if (configuracao) {
            this.produtoSelecionado = configuracao;
            document.getElementById('produtoSelecionado').value = configuracao._id;
            this.preencherDadosProduto(configuracao);
        }
        
        // Preencher observações
        document.getElementById('observacoes').value = vinculo.observacoes || '';
        
        // Scroll para o formulário
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
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
let vinculoProdutoMaquina;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Inicializar aplicação
    vinculoProdutoMaquina = new VinculoProdutoMaquina();
});

// ===== FUNÇÕES GLOBAIS PARA OS BOTÕES =====
window.vinculoProdutoMaquina = vinculoProdutoMaquina;
