// ===== GESTÃO DE LOGÍSTICA - JAVASCRIPT =====

class GestaoLogistica {
    constructor() {
        this.itens = [];
        this.itensAtencao = [];
        this.solicitacoes = [];
        this.itemEditando = null;
        this.acaoConfirmar = null;
        this.itemSolicitandoCompra = null;
        
        this.init();
    }

    async init() {
        await this.carregarDados();
        this.configurarEventos();
        this.updateTimestamp();
        setInterval(() => this.updateTimestamp(), 1000);
    }

    // ===== CONFIGURAÇÃO DE EVENTOS =====
    configurarEventos() {
        // Botões do header
        document.querySelector('.logout-btn').addEventListener('click', () => this.logout());

        // Botões de estado vazio
        const btnPrimeiroItem = document.getElementById('btnPrimeiroItem');
        if (btnPrimeiroItem) {
            btnPrimeiroItem.addEventListener('click', () => this.abrirModalAdicionar());
        }

        // Modal de item
        document.getElementById('formItemLogistica').addEventListener('submit', (e) => this.salvarItem(e));
        document.getElementById('closeItemModal').addEventListener('click', () => this.fecharModalItem());
        document.getElementById('cancelarItem').addEventListener('click', () => this.fecharModalItem());

        // Fechar modal clicando fora
        document.getElementById('modalItem').addEventListener('click', (e) => {
            if (e.target.id === 'modalItem') {
                this.fecharModalItem();
            }
        });

        // Modal de confirmação
        document.getElementById('closeConfirmModal').addEventListener('click', () => this.fecharModalConfirm());
        document.getElementById('cancelConfirm').addEventListener('click', () => this.fecharModalConfirm());
        document.getElementById('confirmAction').addEventListener('click', () => this.executarAcaoConfirmada());

        document.getElementById('confirmModal').addEventListener('click', (e) => {
            if (e.target.id === 'confirmModal') {
                this.fecharModalConfirm();
            }
        });

        // Modal de solicitação de compra
        document.getElementById('closeSolicitarCompraModal').addEventListener('click', () => this.fecharModalSolicitarCompra());
        document.getElementById('cancelarSolicitarCompra').addEventListener('click', () => this.fecharModalSolicitarCompra());
        document.getElementById('formSolicitarCompra').addEventListener('submit', (e) => this.enviarSolicitacaoCompra(e));

        document.getElementById('modalSolicitarCompra').addEventListener('click', (e) => {
            if (e.target.id === 'modalSolicitarCompra') {
                this.fecharModalSolicitarCompra();
            }
        });

        // Botões de solicitações
        document.getElementById('btnLimparAntigas').addEventListener('click', () => this.limparSolicitacoesAntigas());
        document.getElementById('btnLimparTodas').addEventListener('click', () => this.limparTodasSolicitacoes());

        // Event delegation para ações nos cards
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-item')) {
                const card = e.target.closest('.item-estoque-card');
                const itemId = card?.dataset.itemId;
                if (itemId) this.editarItem(itemId);
            } else if (e.target.closest('.btn-delete-item')) {
                const card = e.target.closest('.item-estoque-card');
                const itemId = card?.dataset.itemId;
                if (itemId) this.excluirItem(itemId);
            } else if (e.target.closest('.btn-solicitar-compra')) {
                const card = e.target.closest('.item-atencao-card');
                const itemId = card?.dataset.itemId;
                if (itemId) {
                    const item = this.itensAtencao.find(i => i._id === itemId);
                    if (item) this.abrirModalSolicitarCompra(item);
                }
            }
        });
    }

    // ===== CARREGAMENTO DE DADOS =====
    async carregarDados() {
        await Promise.all([
            this.carregarItens(),
            this.carregarItensAtencao(),
            this.carregarSolicitacoes(),
            this.carregarUsuario()
        ]);
    }

    async carregarUsuario() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user) {
                const usernameEl = document.querySelector('.username');
                if (usernameEl) {
                    usernameEl.textContent = user.nome;
                }
            }
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
        }
    }

    async carregarItens() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/logistica/itens', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.itens = data.data || [];
                this.renderizarStatusEstoque();
            } else {
                console.error('Erro ao carregar itens');
                this.renderizarStatusEstoque();
            }
        } catch (error) {
            console.error('Erro ao carregar itens:', error);
            this.renderizarStatusEstoque();
        }
    }

    async carregarItensAtencao() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/logistica/itens/atencao', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.itensAtencao = data.data || [];
                this.renderizarItensAtencao();
            } else {
                console.error('Erro ao carregar itens que precisam de atenção');
                this.renderizarItensAtencao();
            }
        } catch (error) {
            console.error('Erro ao carregar itens de atenção:', error);
            this.renderizarItensAtencao();
        }
    }

    async carregarSolicitacoes() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/logistica/solicitacoes', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.solicitacoes = data.data || [];
                this.renderizarSolicitacoes();
            } else {
                console.error('Erro ao carregar solicitações');
                this.renderizarSolicitacoes();
            }
        } catch (error) {
            console.error('Erro ao carregar solicitações:', error);
            this.renderizarSolicitacoes();
        }
    }

    // ===== RENDERIZAÇÃO =====
    renderizarStatusEstoque() {
        const container = document.getElementById('statusEstoqueContainer');
        
        if (!this.itens || this.itens.length === 0) {
            container.innerHTML = `
                <div class="empty-state-logistica">
                    <i class="fas fa-box-open"></i>
                    <h3>Nenhum item cadastrado</h3>
                    <p>Adicione seu primeiro item de logística para começar.</p>
                    <button class="btn-primary-logistica" id="btnPrimeiroItem">
                        <i class="fas fa-plus"></i>
                        Adicionar Primeiro Item
                    </button>
                </div>
            `;
            
            // Reatachar evento
            const btn = document.getElementById('btnPrimeiroItem');
            if (btn) {
                btn.addEventListener('click', () => this.abrirModalAdicionar());
            }
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'itens-estoque-grid';
        
        this.itens.forEach(item => {
            const card = this.criarCardItem(item);
            grid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(grid);
    }

    criarCardItem(item) {
        const card = document.createElement('div');
        card.className = 'item-estoque-card';
        card.dataset.itemId = item._id;

        const quantidade = item.quantidadeAtual || 0;
        const quantidadeMinima = item.quantidadeMinima || 0;
        const quantidadeMaxima = item.quantidadeMaxima;
        
        let quantidadeClass = 'normal';
        if (quantidade <= quantidadeMinima) {
            quantidadeClass = 'baixo';
        } else if (quantidadeMaxima && quantidade >= quantidadeMaxima) {
            quantidadeClass = 'alto';
        }

        card.innerHTML = `
            <div class="item-estoque-header">
                <span class="item-estoque-codigo">${item.codigo || 'N/A'}</span>
                <div class="item-estoque-acoes">
                    <button class="btn-edit-item" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-item" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="item-estoque-nome">${item.nome || 'Sem nome'}</div>
            <div class="item-estoque-info">
                <div class="item-estoque-quantidade">
                    <span class="quantidade-badge ${quantidadeClass}">
                        ${quantidade} ${item.unidadeMedida || 'un'}
                    </span>
                    <span style="color: #6b7280; font-size: 0.875rem;">
                        Mín: ${quantidadeMinima}
                    </span>
                </div>
                ${item.localizacao ? `<div style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem;">
                    <i class="fas fa-map-marker-alt"></i> ${item.localizacao}
                </div>` : ''}
            </div>
        `;

        return card;
    }

    renderizarItensAtencao() {
        const container = document.getElementById('itensAtencaoContainer');
        
        if (!this.itensAtencao || this.itensAtencao.length === 0) {
            container.innerHTML = `
                <div class="ok-state-logistica">
                    <i class="fas fa-check-circle"></i>
                    <h3>Todos os itens estão OK</h3>
                    <p>Nenhum item precisa de atenção no momento.</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'itens-atencao-list';

        this.itensAtencao.forEach(item => {
            const card = this.criarCardAtencao(item);
            list.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(list);
    }

    criarCardAtencao(item) {
        const card = document.createElement('div');
        card.className = 'item-atencao-card';
        card.dataset.itemId = item._id;

        const motivos = {
            'estoque_baixo': 'Estoque Baixo',
            'estoque_alto': 'Estoque Alto',
            'vencimento_proximo': 'Vencimento Próximo',
            'sem_movimentacao': 'Sem Movimentação'
        };

        const motivo = motivos[item.motivoAtencao] || 'Necessita Atenção';
        const isEstoqueBaixo = item.motivoAtencao === 'estoque_baixo';

        card.innerHTML = `
            <div class="item-atencao-info">
                <div class="item-atencao-nome">${item.nome}</div>
                <div class="item-atencao-motivo">
                    ${motivo}
                    <span class="motivo-badge">${item.codigo || 'N/A'}</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 1.25rem; font-weight: 600; color: #ef4444;">
                    ${item.quantidadeAtual || 0} ${item.unidadeMedida || 'un'}
                </div>
                ${isEstoqueBaixo ? `
                    <button class="btn-solicitar-compra" title="Solicitar Compra">
                        <i class="fas fa-shopping-cart"></i>
                        Solicitar Compra
                    </button>
                ` : ''}
            </div>
        `;

        return card;
    }

    renderizarSolicitacoes() {
        const container = document.getElementById('solicitacoesContainer');
        
        if (!this.solicitacoes || this.solicitacoes.length === 0) {
            container.innerHTML = `
                <div class="empty-state-logistica">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Nenhuma solicitação de compra</h3>
                    <p>Não há solicitações de compra pendentes no momento.</p>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'solicitacoes-list';

        this.solicitacoes.forEach(solicitacao => {
            const card = this.criarCardSolicitacao(solicitacao);
            list.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(list);
    }

    criarCardSolicitacao(solicitacao) {
        const card = document.createElement('div');
        card.className = 'solicitacao-card';

        const item = solicitacao.itemLogistica || {};
        const status = solicitacao.status || 'pendente';
        const dataSolicitacao = new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR');

        card.innerHTML = `
            <div class="solicitacao-info">
                <div class="solicitacao-item-nome">${item.nome || 'Item não encontrado'}</div>
                <div class="solicitacao-detalhes">
                    <span><strong>Quantidade:</strong> ${solicitacao.quantidade || 0} ${item.unidadeMedida || 'un'}</span>
                    <span><strong>Data:</strong> ${dataSolicitacao}</span>
                    ${solicitacao.prioridade ? `<span><strong>Prioridade:</strong> ${solicitacao.prioridade}</span>` : ''}
                </div>
            </div>
            <span class="solicitacao-status ${status}">${this.formatarStatus(status)}</span>
        `;

        return card;
    }

    formatarStatus(status) {
        const statusMap = {
            'pendente': 'Pendente',
            'aprovada': 'Aprovada',
            'em_compra': 'Em Compra',
            'recebida': 'Recebida',
            'cancelada': 'Cancelada'
        };
        return statusMap[status] || status;
    }

    // ===== MODAL DE ITEM =====
    abrirModalAdicionar() {
        this.itemEditando = null;
        document.getElementById('modalItemTitle').textContent = 'Adicionar Item de Logística';
        document.getElementById('formItemLogistica').reset();
        document.getElementById('itemId').value = '';
        this.gerarCodigoItem();
        document.getElementById('modalItem').classList.add('show');
    }

    gerarCodigoItem() {
        const codigoInput = document.getElementById('codigoItem');
        // Gerar código baseado no número de itens existentes
        const proximoCodigo = `LOG${String((this.itens.length || 0) + 1).padStart(4, '0')}`;
        codigoInput.value = proximoCodigo;
    }

    fecharModalItem() {
        const estavaEditando = !!this.itemEditando;
        document.getElementById('modalItem').classList.remove('show');
        this.itemEditando = null;
        document.getElementById('formItemLogistica').reset();
        // Gerar novo código apenas se não estava editando
        if (!estavaEditando) {
            this.gerarCodigoItem();
        }
    }

    async editarItem(itemId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/logistica/itens/${itemId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const item = data.data;
                this.itemEditando = item;

                // Preencher formulário
                document.getElementById('itemId').value = item._id;
                document.getElementById('codigoItem').value = item.codigo || '';
                document.getElementById('nomeItem').value = item.nome || '';
                document.getElementById('categoriaItem').value = item.categoria || '';
                document.getElementById('unidadeMedidaItem').value = item.unidadeMedida || 'unidade';
                document.getElementById('quantidadeAtualItem').value = item.quantidadeAtual || 0;
                document.getElementById('quantidadeMinimaItem').value = item.quantidadeMinima || 0;
                document.getElementById('quantidadeMaximaItem').value = item.quantidadeMaxima || '';
                document.getElementById('localizacaoItem').value = item.localizacao || '';
                document.getElementById('fornecedorItem').value = item.fornecedor || '';
                document.getElementById('custoUnitarioItem').value = item.custoUnitario || '';
                document.getElementById('dataValidadeItem').value = item.dataValidade ? new Date(item.dataValidade).toISOString().split('T')[0] : '';
                document.getElementById('descricaoItem').value = item.descricao || '';

                document.getElementById('modalItemTitle').textContent = 'Editar Item de Logística';
                document.getElementById('modalItem').classList.add('show');
            } else {
                this.mostrarMensagem('Erro ao carregar item para edição', 'error');
            }
        } catch (error) {
            console.error('Erro ao editar item:', error);
            this.mostrarMensagem('Erro ao carregar item', 'error');
        }
    }

    async salvarItem(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const dados = {};
        formData.forEach((value, key) => {
            if (value) {
                if (key === 'quantidadeAtual' || key === 'quantidadeMinima' || key === 'quantidadeMaxima' || key === 'custoUnitario') {
                    dados[key] = parseFloat(value);
                } else {
                    dados[key] = value;
                }
            }
        });

        try {
            const token = localStorage.getItem('token');
            const itemId = document.getElementById('itemId').value;
            const url = itemId ? `/api/logistica/itens/${itemId}` : '/api/logistica/itens';
            const method = itemId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                this.mostrarMensagem(itemId ? 'Item atualizado com sucesso!' : 'Item criado com sucesso!', 'success');
                this.fecharModalItem();
                await this.carregarDados();
            } else {
                const error = await response.json();
                this.mostrarMensagem(error.message || 'Erro ao salvar item', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar item:', error);
            this.mostrarMensagem('Erro ao salvar item', 'error');
        }
    }

    async excluirItem(itemId) {
        this.mostrarModalConfirm(
            'Excluir Item',
            'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/logistica/itens/${itemId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        this.mostrarMensagem('Item excluído com sucesso!', 'success');
                        await this.carregarDados();
                    } else {
                        this.mostrarMensagem('Erro ao excluir item', 'error');
                    }
                } catch (error) {
                    console.error('Erro ao excluir item:', error);
                    this.mostrarMensagem('Erro ao excluir item', 'error');
                }
            }
        );
    }

    // ===== SOLICITAÇÕES DE COMPRA =====
    async limparSolicitacoesAntigas() {
        this.mostrarModalConfirm(
            'Limpar Solicitações Antigas',
            'Tem certeza que deseja remover todas as solicitações antigas (recebidas ou canceladas)?',
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/logistica/solicitacoes/limpar-antigas', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.mostrarMensagem(data.message || 'Solicitações antigas removidas!', 'success');
                        await this.carregarSolicitacoes();
                    } else {
                        this.mostrarMensagem('Erro ao limpar solicitações antigas', 'error');
                    }
                } catch (error) {
                    console.error('Erro ao limpar solicitações:', error);
                    this.mostrarMensagem('Erro ao limpar solicitações', 'error');
                }
            }
        );
    }

    async limparTodasSolicitacoes() {
        this.mostrarModalConfirm(
            'Limpar Todas as Solicitações',
            'Tem certeza que deseja remover TODAS as solicitações de compra? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/logistica/solicitacoes/limpar-todas', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.mostrarMensagem(data.message || 'Todas as solicitações foram removidas!', 'success');
                        await this.carregarSolicitacoes();
                    } else {
                        this.mostrarMensagem('Erro ao limpar todas as solicitações', 'error');
                    }
                } catch (error) {
                    console.error('Erro ao limpar solicitações:', error);
                    this.mostrarMensagem('Erro ao limpar solicitações', 'error');
                }
            }
        );
    }

    // ===== MODAL DE CONFIRMAÇÃO =====
    mostrarModalConfirm(titulo, mensagem, callback) {
        document.getElementById('modalConfirmTitle').textContent = titulo;
        document.getElementById('modalConfirmMessage').textContent = mensagem;
        this.acaoConfirmar = callback;
        document.getElementById('confirmModal').classList.add('show');
    }

    fecharModalConfirm() {
        document.getElementById('confirmModal').classList.remove('show');
        this.acaoConfirmar = null;
    }

    executarAcaoConfirmada() {
        if (this.acaoConfirmar) {
            this.acaoConfirmar();
        }
        this.fecharModalConfirm();
    }

    // ===== UTILITÁRIOS =====
    mostrarMensagem(mensagem, tipo = 'success') {
        const statusMessage = document.querySelector('.status-message');
        if (!statusMessage) return;

        const cores = {
            success: { bg: '#d1fae5', text: '#065f46', icon: 'fa-check-circle' },
            error: { bg: '#fee2e2', text: '#991b1b', icon: 'fa-exclamation-circle' },
            info: { bg: '#dbeafe', text: '#1e40af', icon: 'fa-info-circle' }
        };

        const cor = cores[tipo] || cores.success;

        statusMessage.innerHTML = `
            <div style="background: ${cor.bg}; color: ${cor.text}; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas ${cor.icon}"></i>
                ${mensagem}
            </div>
        `;

        setTimeout(() => {
            statusMessage.innerHTML = '';
        }, 5000);
    }

    logout() {
        if (confirm('Tem certeza que deseja sair do sistema?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }

    // ===== MODAL DE SOLICITAÇÃO DE COMPRA =====
    abrirModalSolicitarCompra(item) {
        this.itemSolicitandoCompra = item;
        document.getElementById('modalSolicitarCompraTitle').textContent = `Solicitar Compra - ${item.nome}`;
        document.getElementById('itemSolicitacaoNome').textContent = item.nome;
        document.getElementById('itemSolicitacaoCodigo').textContent = item.codigo || 'N/A';
        document.getElementById('itemSolicitacaoEstoqueAtual').textContent = `${item.quantidadeAtual || 0} ${item.unidadeMedida || 'un'}`;
        document.getElementById('itemSolicitacaoEstoqueMinimo').textContent = `${item.quantidadeMinima || 0} ${item.unidadeMedida || 'un'}`;
        
        // Calcular quantidade sugerida (diferença para o mínimo + 50%)
        const quantidadeMinima = item.quantidadeMinima || 0;
        const quantidadeAtual = item.quantidadeAtual || 0;
        const quantidadeSugerida = Math.max(quantidadeMinima - quantidadeAtual, quantidadeMinima * 0.5);
        
        document.getElementById('quantidadeSolicitacao').value = Math.ceil(quantidadeSugerida);
        document.getElementById('emailDestinatario').value = '';
        document.getElementById('mensagemSolicitacao').value = '';
        
        document.getElementById('modalSolicitarCompra').classList.add('show');
    }

    fecharModalSolicitarCompra() {
        document.getElementById('modalSolicitarCompra').classList.remove('show');
        this.itemSolicitandoCompra = null;
        document.getElementById('formSolicitarCompra').reset();
    }

    async enviarSolicitacaoCompra(e) {
        e.preventDefault();

        if (!this.itemSolicitandoCompra) {
            this.mostrarMensagem('Item não encontrado', 'error');
            return;
        }

        const emailDestinatario = document.getElementById('emailDestinatario').value.trim();
        const quantidade = document.getElementById('quantidadeSolicitacao').value;
        const mensagem = document.getElementById('mensagemSolicitacao').value.trim();

        if (!emailDestinatario) {
            this.mostrarMensagem('Por favor, informe o e-mail do destinatário', 'error');
            return;
        }

        if (!quantidade || parseFloat(quantidade) <= 0) {
            this.mostrarMensagem('Por favor, informe uma quantidade válida', 'error');
            return;
        }

        // Validar e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailDestinatario)) {
            this.mostrarMensagem('Por favor, informe um e-mail válido', 'error');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/logistica/solicitar-compra-email', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    itemId: this.itemSolicitandoCompra._id,
                    emailDestinatario,
                    quantidade: parseFloat(quantidade),
                    mensagem
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.mostrarMensagem(data.message || 'E-mail de solicitação de compra enviado com sucesso!', 'success');
                this.fecharModalSolicitarCompra();
                await this.carregarDados(); // Recarregar dados para atualizar solicitações
            } else {
                this.mostrarMensagem(data.message || 'Erro ao enviar e-mail de solicitação de compra', 'error');
            }
        } catch (error) {
            console.error('Erro ao enviar solicitação de compra:', error);
            this.mostrarMensagem('Erro ao enviar solicitação de compra', 'error');
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
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    window.gestaoLogistica = new GestaoLogistica();
});

