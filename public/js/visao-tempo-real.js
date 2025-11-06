// JavaScript para página de Visão em Tempo Real
let motivosDescarte = [];
let maquinas = [];

// Helper: detecta se a página é uma visão fixa de máquina (ex.: maquina-1.html)
function getFixedMachineIdFromPage() {
    try {
        const path = window.location.pathname || '';
        const match = path.match(/maquina-(\d+)\.html$/i);
        if (match && match[1]) {
            const numero = match[1];
            // Mapear número da página para o machineId correto
            const machineIdMap = {
                '1': 'Torno',          // Máquina 1
                '2': 'Torno-CNC',      // Máquina 2
                '3': 'Fresa',          // Máquina 3
                '4': 'Injetora',       // Máquina 4
                '5': 'Usinox'          // Máquina 5
            };
            return machineIdMap[numero] || null;
        }
    } catch (_) {
        // Ignorar quaisquer erros de parsing do path
    }
    return null;
}

// Variáveis para armazenar valores dos indicadores OEE
let valoresOEE = {
    disponibilidade: 0,
    performance: 0,
    qualidade: 0
};

// Variável para armazenar produção real (para uso na Qualidade)
let producaoRealGlobal = 0;

// Função helper para obter machineId da ordem (com tratamento robusto)
async function getMachineIdFromOrdem(ordem) {
    if (!ordem || !ordem.maquina) {
        console.warn('getMachineIdFromOrdem: ordem ou ordem.maquina não existe');
        return null;
    }

    // Se ordem.maquina já é um objeto populado com machineId (caso mais comum)
    if (typeof ordem.maquina === 'object') {
        if (ordem.maquina.machineId) {
            return ordem.maquina.machineId.toString();
        }
        // Se for objeto mas não tem machineId, pode ser apenas ObjectId populado sem campos
        if (ordem.maquina._id) {
            // Tentar buscar machineId via API
            console.warn('getMachineIdFromOrdem: máquina populada mas sem machineId, tentando buscar...');
        } else {
            return null;
        }
    }
    
    // Se ordem.maquina é uma string (pode ser machineId ou ObjectId)
    if (typeof ordem.maquina === 'string') {
        // Verificar se parece ser um ObjectId (24 caracteres hexadecimais)
        if (ordem.maquina.length === 24 && /^[0-9a-fA-F]{24}$/.test(ordem.maquina)) {
            // É provavelmente um ObjectId, precisamos buscar a máquina
            try {
                // Buscar máquinas do usuário (já em cache se possível)
                const maquinasUsuario = await getUserMachineFromAPI();
                
                // Tentar encontrar a máquina que corresponde ao ObjectId
                const maquina = maquinasUsuario.find(m => {
                    const maquinaIdObj = m._id?.toString() || m.machineId?.toString();
                    return maquinaIdObj === ordem.maquina;
                });
                
                if (maquina && maquina.machineId) {
                    return maquina.machineId.toString();
                }
            } catch (error) {
                console.warn('Erro ao buscar machineId via API:', error);
            }
        } else {
            // Não parece ObjectId, assumir que é o machineId diretamente
            return ordem.maquina;
        }
    }
    
    console.warn('getMachineIdFromOrdem: não foi possível determinar machineId', ordem.maquina);
    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Carregar dados do usuário
    loadUserData();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Carregar dados iniciais (máquinas e motivos)
    loadInitialData();
    
    // Inicializar dashboard (por enquanto apenas estrutura)
    initializeDashboard();
    
    // Configurar event delegation para tabela de ordens
    setupOrdensTableDelegation();
    
    // Criar indicador de atualização
    createUpdateIndicator();
    
    // Carregar informações do produto ativo
    loadProdutoInfo();
    
    // Atualizar informações do produto periodicamente (a cada 10 segundos)
    setInterval(() => {
        loadProdutoInfo();
        showUpdateIndicator();
    }, 10000);
});

// Criar indicador de atualização
function createUpdateIndicator() {
    // Verificar se já existe
    if (document.getElementById('updateIndicator')) {
        return;
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'updateIndicator';
    indicator.className = 'update-indicator';
    indicator.innerHTML = '<i class="fas fa-sync-alt"></i> Dados atualizados';
    document.body.appendChild(indicator);
}

// Mostrar indicador de atualização
function showUpdateIndicator() {
    let indicator = document.getElementById('updateIndicator');
    
    if (!indicator) {
        createUpdateIndicator();
        indicator = document.getElementById('updateIndicator');
    }
    
    if (!indicator) {
        return; // Se ainda não existe, não fazer nada
    }
    
    // Resetar animação removendo e adicionando a classe
    indicator.classList.remove('show');
    // Pequeno delay para garantir o reset da animação
    setTimeout(() => {
        indicator.classList.add('show');
        // Remover após 2 segundos
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }, 10);
}

// Carregar dados do usuário no header
function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('user'));
    const usernameElement = document.querySelector('.username');
    
    if (usernameElement && userData) {
        usernameElement.textContent = userData.nome || 'Usuário';
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botão de logout
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

    // Botão de menu mobile
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }

    // Botão Criar Ordem
    const btnCreateOrder = document.querySelector('.btn-create-order');
    if (btnCreateOrder) {
        btnCreateOrder.addEventListener('click', function() {
            openOrdemModal();
        });
    }

    // Modal de ordem de produção
    const ordemModal = document.getElementById('ordemProducaoModal');
    const closeOrdemModalBtn = document.getElementById('closeOrdemModal');
    const cancelOrdemModalBtn = document.getElementById('cancelOrdemModal');
    const ordemForm = document.getElementById('ordemProducaoForm');

    if (closeOrdemModalBtn) {
        closeOrdemModalBtn.addEventListener('click', closeOrdemModal);
    }

    if (cancelOrdemModalBtn) {
        cancelOrdemModalBtn.addEventListener('click', closeOrdemModal);
    }

    if (ordemForm) {
        ordemForm.addEventListener('submit', handleOrdemSubmit);
    }

    // Fechar modal ao clicar fora
    if (ordemModal) {
        ordemModal.addEventListener('click', function(e) {
            if (e.target.id === 'ordemProducaoModal') {
                closeOrdemModal();
            }
        });
    }

    // Botão Registrar Descarte
    const btnRegisterScrap = document.querySelector('.btn-register-scrap');
    if (btnRegisterScrap) {
        btnRegisterScrap.addEventListener('click', function() {
            // Só abrir modal se o botão não estiver desabilitado
            if (!this.disabled && !this.classList.contains('disabled')) {
                openModal();
            }
        });
    }

    // Modal de descarte
    const closeModalBtn = document.getElementById('closeModal');
    const cancelModalBtn = document.getElementById('cancelModal');
    const descarteForm = document.getElementById('descarteForm');
    const descarteModal = document.getElementById('descarteModal');

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeModal);
    }

    if (descarteForm) {
        descarteForm.addEventListener('submit', handleFormSubmit);
    }

    // Fechar modal ao clicar fora
    if (descarteModal) {
        descarteModal.addEventListener('click', function(e) {
            if (e.target.id === 'descarteModal') {
                closeModal();
            }
        });
    }

    // Botão Lista de Descartes
    const btnScrapList = document.querySelector('.btn-scrap-list');
    if (btnScrapList) {
        btnScrapList.addEventListener('click', function() {
            window.location.href = 'lista-descartes.html';
        });
    }

    // Botão Finalizar Setup
    const btnFinalizarSetup = document.getElementById('btnFinalizarSetup');
    if (btnFinalizarSetup) {
        btnFinalizarSetup.addEventListener('click', async function() {
            await finalizarSetupForcado();
        });
    }

    // Navegação por cards com data-link (substitui <a href="...">)
    document.querySelectorAll('.monitoring-card[data-link]').forEach(card => {
        card.addEventListener('click', () => {
            const target = card.getAttribute('data-link');
            if (target) {
                window.location.href = target;
            }
        });
    });
}

// Inicializar dashboard
function initializeDashboard() {
    // Por enquanto, apenas manter valores padrão
    // TODO: Implementar conexão com API para dados em tempo real
    
    // Exemplo de atualização de gauge (será implementado depois)
    // updateGauge('geralGauge', 0);
    // updateGauge('disponibilidadeGauge', 0);
    // updateGauge('performanceGauge', 0);
    // updateGauge('qualidadeGauge', 0);
    
    // Inicializar botão de registrar descarte como desabilitado
    // Será habilitado quando houver ordem ativa
    toggleDescarteButton(false);
}

// Carregar informações do produto ativo (ordem de produção em produção)
async function loadProdutoInfo() {
    try {
        // Buscar máquinas do usuário
        const maquinasUsuario = await getUserMachineFromAPI();
        if (!maquinasUsuario || maquinasUsuario.length === 0) {
            updateProdutoInfo(null);
            updateQualidade(null);
            updatePerformance(null);
            updateDisponibilidade(null);
            resetOEE();
            return;
        }

        // Buscar ordens em produção para todas as máquinas
        const promises = maquinasUsuario.map(maquina => 
            makeAuthenticatedRequest(`/api/ordens-producao?maquina=${maquina.machineId}&status=em-producao`)
        );

        const responses = await Promise.all(promises);
        
        // Encontrar a primeira ordem em produção
        let ordemAtiva = null;
        for (const response of responses) {
            if (response && response.ok) {
                const data = await response.json();
                const ordens = data.data || [];
                if (ordens.length > 0) {
                    ordemAtiva = ordens[0]; // Pegar a primeira ordem ativa
                    break;
                }
            }
        }

        updateProdutoInfo(ordemAtiva);
        
        // Debug: verificar estrutura da ordem
        if (ordemAtiva) {
            console.log('Ordem ativa encontrada:', ordemAtiva);
            console.log('Ordem - vinculoProdutoMaquina:', ordemAtiva.vinculoProdutoMaquina);
        }
        
        // Orquestração dos cálculos OEE na ordem correta:
        // 1. Disponibilidade (primeiro, pois é base para outros cálculos)
        await updateDisponibilidade(ordemAtiva);
        
        // 2. Performance (calcula producaoReal que será usado em Qualidade)
        await updatePerformance(ordemAtiva);
        
        // Atualizar quantidade com as peças totais produzidas (após cálculo de performance)
        if (ordemAtiva) {
            updateQuantidadeProduto(ordemAtiva);
        }
        
        // 3. Qualidade (usa producaoReal da Performance)
        await updateQualidade(ordemAtiva);
        
        // 4. OEE Geral (após todos os indicadores)
        updateOEE();
    } catch (error) {
        console.error('Erro ao carregar informações do produto:', error);
        updateProdutoInfo(null);
        updateQualidade(null);
        updatePerformance(null);
        updateDisponibilidade(null);
        resetOEE();
    }
}

// Atualizar informações do produto na interface
function updateProdutoInfo(ordem) {
    const produtoAtualEl = document.getElementById('produtoAtualInfo');
    const codigoEl = document.getElementById('codigoProdutoInfo');
    const quantidadeEl = document.getElementById('quantidadeProdutoInfo');
    const statusEl = document.getElementById('statusProdutoInfo');

    if (!ordem) {
        if (produtoAtualEl) produtoAtualEl.textContent = 'Nenhum produto ativo';
        if (codigoEl) codigoEl.textContent = '-';
        if (quantidadeEl) quantidadeEl.textContent = '0';
        if (statusEl) {
            statusEl.textContent = 'Parado';
            statusEl.classList.remove('green-text');
            statusEl.classList.add('blue-text');
        }
        // Desabilitar botão de registrar descarte quando não há ordem ativa
        toggleDescarteButton(false);
        return;
    }

    // Popular com dados da ordem
    const produto = ordem.produto || {};
    const produtoNome = produto.nomeProduto || 'Produto sem nome';
    const produtoCodigo = produto.codigoProduto || '-';
    
    if (produtoAtualEl) produtoAtualEl.textContent = produtoNome;
    if (codigoEl) codigoEl.textContent = produtoCodigo;
    
    // Atualizar quantidade (será atualizada com peças totais após cálculo de performance)
    updateQuantidadeProduto(ordem);
    
    if (statusEl) {
        statusEl.textContent = ordem.status === 'em-producao' ? 'Em Produção' : 'Parado';
        if (ordem.status === 'em-producao') {
            statusEl.classList.remove('blue-text');
            statusEl.classList.add('green-text');
        } else {
            statusEl.classList.remove('green-text');
            statusEl.classList.add('blue-text');
        }
    }
    
    // Habilitar botão de registrar descarte quando há ordem ativa
    toggleDescarteButton(true);
}

// Atualizar quantidade do produto com as peças totais (produzidas)
function updateQuantidadeProduto(ordem) {
    const quantidadeEl = document.getElementById('quantidadeProdutoInfo');
    
    if (!quantidadeEl || !ordem) {
        return;
    }
    
    const quantidade = ordem.quantidade || 0;
    // Usar producaoRealGlobal (peças totais produzidas) em vez de quantidadeProduzida da ordem
    const quantidadeProduzida = producaoRealGlobal || 0;
    quantidadeEl.textContent = `${quantidadeProduzida} / ${quantidade}`;
}

// Função para habilitar/desabilitar botão de registrar descarte
function toggleDescarteButton(habilitar) {
    const btnRegisterScrap = document.querySelector('.btn-register-scrap');
    if (btnRegisterScrap) {
        if (habilitar) {
            btnRegisterScrap.disabled = false;
            btnRegisterScrap.classList.remove('disabled');
            btnRegisterScrap.title = 'Clique para registrar um descarte';
        } else {
            btnRegisterScrap.disabled = true;
            btnRegisterScrap.classList.add('disabled');
            btnRegisterScrap.title = 'Não há ordem ativa para registrar descarte';
        }
    }
}

// Função para atualizar gauge circular (para uso futuro)
function updateGauge(gaugeId, value) {
    const gauge = document.getElementById(gaugeId);
    if (!gauge) return;
    
    const gaugeValue = gauge.querySelector('.gauge-value');
    if (gaugeValue) {
        gaugeValue.textContent = value.toFixed(1) + '%';
    }
    
    // Atualizar cor baseado no valor
    // Verde: 81-100%, Laranja: 61-80%, Vermelho: 0-60%
    let color = '#ef4444'; // vermelho padrão
    
    if (value >= 81) {
        color = '#10b981'; // verde
    } else if (value >= 61) {
        color = '#f97316'; // laranja
    } else {
        color = '#ef4444'; // vermelho
    }
    
    // Colorir todo o círculo, não apenas o topo
    gauge.style.borderColor = color;
    if (gaugeValue) {
        gaugeValue.style.color = color;
    }
}

// Atualizar card de qualidade
async function updateQualidade(ordem) {
    try {
        // Se não houver ordem ativa, resetar valores
        if (!ordem || !ordem.maquina) {
            resetQualidade();
            return;
        }

        // Obter machineId da máquina usando função helper
        const machineId = await getMachineIdFromOrdem(ordem);
        
        if (!machineId) {
            console.error('MachineId não encontrado na ordem', ordem);
            resetQualidade();
            return;
        }
        
        console.log('Qualidade - machineId obtido:', machineId);

        // Obter data de início: usar resetTimestamp se existir, senão usar createdAt da ordem
        // Isso garante que dados antigos não sejam contabilizados quando uma nova ordem nasce
        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            // Usar resetTimestamp se existir (nova ordem criada)
            dataInicioOrdem = new Date(resetTimestampStored);
            console.log('Qualidade - Usando resetTimestamp armazenado:', dataInicioOrdem);
        } else {
            // Fallback para createdAt da ordem
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date 
                    ? ordem.createdAt 
                    : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date 
                    ? ordem.created_at 
                    : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
            console.log('Qualidade - Usando createdAt da ordem (sem resetTimestamp):', dataInicioOrdem);
        }
        const agora = new Date();

        // pecasTotais = valor Real da Performance (já calculado em updatePerformance)
        // Usa producaoRealGlobal que foi setado na Performance (ciclos desde o fim do setup)
        let pecasTotais = producaoRealGlobal;
        
        console.log('Qualidade - Peças Totais (valor Real da Performance):', pecasTotais);
        console.log('Qualidade - Usando producaoRealGlobal da Performance:', producaoRealGlobal);

        // Buscar descartes desde o início da ordem
        // API filtra por maquina e data no backend, mas fazemos filtro adicional no frontend por segurança
        const descartesResponse = await makeAuthenticatedRequest(
            `/api/descartes?maquina=${encodeURIComponent(machineId)}&dataInicio=${encodeURIComponent(dataInicioOrdem.toISOString())}&dataFim=${encodeURIComponent(agora.toISOString())}&limit=1000`
        );

        let totalDescartes = 0;
        if (descartesResponse && descartesResponse.ok) {
            const descartesData = await descartesResponse.json();
            const descartes = descartesData.data || [];
            
            console.log('Qualidade - Total de descartes encontrados:', descartes.length);
            console.log('Qualidade - Descarte filtros: machineId:', machineId, 'dataInicio:', dataInicioOrdem.toISOString(), 'dataFim:', agora.toISOString());
            
            // Filtrar descartes desde o início da ordem (verificação adicional)
            // Os descartes usam: dataHora (Date), maquina (String - pode ser machineId ou nome)
            const descartesDesdeOrdem = descartes.filter(descarte => {
                // Obter dataHora do descarte (pode ser Date ou string ISO)
                let descarteDate;
                if (descarte.dataHora) {
                    descarteDate = descarte.dataHora instanceof Date 
                        ? descarte.dataHora 
                        : new Date(descarte.dataHora);
                } else if (descarte.createdAt) {
                    descarteDate = descarte.createdAt instanceof Date 
                        ? descarte.createdAt 
                        : new Date(descarte.createdAt);
                } else {
                    return false; // Se não tem data, ignorar
                }
                
                // Verificar se o machineId/maquina corresponde (case insensitive)
                const descarteMaquina = (descarte.maquina || '').toString().toUpperCase();
                const ordemMachineId = machineId.toString().toUpperCase();
                
                return descarteDate >= dataInicioOrdem && descarteDate <= agora && descarteMaquina === ordemMachineId;
            });
            
            console.log('Qualidade - Descartos desde o início da ordem:', descartesDesdeOrdem.length);
            
            // Somar quantidade de todos os descartes
            totalDescartes = descartesDesdeOrdem.reduce((sum, descarte) => {
                return sum + (descarte.quantidade || 0);
            }, 0);
            
            console.log('Qualidade - Total de peças descartadas:', totalDescartes);
        } else {
            console.warn('Qualidade - Erro ao buscar descartes:', descartesResponse);
        }

        // Calcular valores
        const pecasBoas = Math.max(0, pecasTotais - totalDescartes); // Garantir que não seja negativo
        const pecasRuins = totalDescartes;
        
        console.log('Qualidade - Resultado final:');
        console.log('  - Peças Totais (ciclos):', pecasTotais);
        console.log('  - Total de Descartes:', totalDescartes);
        console.log('  - Peças Boas:', pecasBoas);
        console.log('  - Peças Ruins:', pecasRuins);
        
        // Calcular qualidade% (se houver produção)
        let qualidadePercent = 0;
        if (pecasTotais > 0) {
            qualidadePercent = (pecasBoas / pecasTotais) * 100;
        }
        
        console.log('Qualidade - Percentual calculado:', qualidadePercent.toFixed(2) + '%');

        // Armazenar valor de qualidade para cálculo do OEE (ANTES de atualizar UI)
        valoresOEE.qualidade = qualidadePercent;
        
        // Atualizar interface
        updateQualidadeUI(pecasTotais, pecasBoas, pecasRuins, qualidadePercent);
    } catch (error) {
        console.error('Erro ao atualizar qualidade:', error);
        resetQualidade();
    }
}

// Resetar valores de qualidade
function resetQualidade() {
    updateQualidadeUI(0, 0, 0, 0);
    valoresOEE.qualidade = 0;
    producaoRealGlobal = 0;
}

// Atualizar UI do card de qualidade
function updateQualidadeUI(pecasTotais, pecasBoas, pecasRuins, qualidadePercent) {
    // Atualizar gauge
    updateGauge('qualidadeGauge', qualidadePercent);

    // Se o gauge não existir nesta página, não tentar atualizar DOM
    const gaugeElQualidade = document.getElementById('qualidadeGauge');
    if (!gaugeElQualidade) {
        return;
    }

    // Atualizar valores dos campos - buscar dentro do card de qualidade
    const cardQualidade = gaugeElQualidade.closest('.monitoring-card');
    if (cardQualidade) {
        const infoItems = cardQualidade.querySelectorAll('.info-item');
        if (infoItems.length >= 3) {
            // Peças Totais (primeiro item)
            const pecasTotaisEl = infoItems[0].querySelector('.info-value');
            if (pecasTotaisEl) pecasTotaisEl.textContent = pecasTotais.toString();
            
            // Peças Boas (segundo item)
            const pecasBoasEl = infoItems[1].querySelector('.info-value');
            if (pecasBoasEl) pecasBoasEl.textContent = pecasBoas.toString();
            
            // Peças Ruins (terceiro item)
            const pecasRuinsEl = infoItems[2].querySelector('.info-value');
            if (pecasRuinsEl) pecasRuinsEl.textContent = pecasRuins.toString();
        }
    }
}

// Atualizar card de performance
async function updatePerformance(ordem) {
    try {
        // Se não houver ordem ativa, resetar valores
        if (!ordem || !ordem.vinculoProdutoMaquina) {
            resetPerformance();
            return;
        }

        // Obter vínculo produto-máquina (pode vir populado ou como ObjectId)
        let vinculo = ordem.vinculoProdutoMaquina;
        
        // Se o vínculo for um ObjectId (string), buscar os dados completos
        if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.producaoIdeal)) {
            const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
            
            // Buscar vínculo completo via API
            try {
                const vinculoResponse = await makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                if (vinculoResponse && vinculoResponse.ok) {
                    const vinculoData = await vinculoResponse.json();
                    vinculo = vinculoData.data || vinculo;
                } else {
                    console.warn('Não foi possível buscar dados completos do vínculo, usando dados da ordem');
                }
            } catch (err) {
                console.warn('Erro ao buscar vínculo completo:', err);
            }
        }

        if (!vinculo) {
            console.error('Vínculo não encontrado na ordem', ordem);
            resetPerformance();
            return;
        }

        // Debug: verificar dados do vínculo
        console.log('Performance - Vínculo completo:', vinculo);
        console.log('Performance - producaoIdeal:', vinculo.producaoIdeal);
        console.log('Performance - tempoSetup:', vinculo.tempoSetup);

        // Obter producaoIdeal (unidades por hora) do vínculo
        // Pode estar no vínculo diretamente ou no configuracaoProduto populado
        let producaoIdealPorHora = vinculo.producaoIdeal || 0;
        
        // Se não encontrou no vínculo diretamente, verificar se há configuracaoProduto populado
        if (producaoIdealPorHora === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.producaoIdeal) {
                producaoIdealPorHora = vinculo.configuracaoProduto.producaoIdeal;
            }
        }
        
        // Converter para unidades por minuto
        const producaoIdealPorMinuto = producaoIdealPorHora / 60;

        // Obter tempoSetup em segundos
        // Pode estar no vínculo diretamente ou no configuracaoProduto populado
        let tempoSetupSegundos = vinculo.tempoSetup || 0;
        
        // Se não encontrou no vínculo diretamente, verificar se há configuracaoProduto populado
        if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
            }
        }
        
        console.log('Performance - producaoIdealPorHora:', producaoIdealPorHora, 'tempoSetupSegundos:', tempoSetupSegundos);

        // Obter machineId primeiro para verificar resetTimestamp
        const machineId = await getMachineIdFromOrdem(ordem);
        
        if (!machineId) {
            console.error('MachineId não encontrado na ordem', ordem);
            resetPerformance();
            return;
        }
        
        console.log('Performance - machineId obtido:', machineId);

        // Obter data de início: usar resetTimestamp se existir, senão usar createdAt da ordem
        // Isso garante que dados antigos não sejam contabilizados quando uma nova ordem nasce
        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            // Usar resetTimestamp se existir (nova ordem criada)
            dataInicioOrdem = new Date(resetTimestampStored);
            console.log('Performance - Usando resetTimestamp armazenado:', dataInicioOrdem);
        } else {
            // Fallback para createdAt da ordem
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date 
                    ? ordem.createdAt 
                    : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date 
                    ? ordem.created_at 
                    : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
            console.log('Performance - Usando createdAt da ordem (sem resetTimestamp):', dataInicioOrdem);
        }
        const agora = new Date();

        // Verificar se o setup está finalizado
        // Pode ser finalizado automaticamente (tempo passou) ou forçado (botão)
        const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000; // em segundos
        
        // Verificar se há setup finalizado forçado no localStorage
        const setupForcadoKey = `setupFinalizado_${machineId}`;
        const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
        let dataFimSetup = null;
        let setupFinalizado = false;
        
        if (setupForcadoTimestamp) {
            // Setup foi finalizado forçadamente - sempre considerar finalizado se existe timestamp
            dataFimSetup = new Date(setupForcadoTimestamp);
            setupFinalizado = true; // Se existe timestamp no localStorage, setup está finalizado
            console.log('Performance - Setup finalizado forçadamente em:', dataFimSetup);
        } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
            // Setup finalizado automaticamente pelo tempo
            dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
            setupFinalizado = true;
            console.log('Performance - Setup finalizado automaticamente');
        }

        // Calcular tempo efetivo (após o fim do setup)
        let tempoEfetivoMinutos = 0;
        
        if (setupFinalizado && dataFimSetup) {
            // Tempo efetivo = desde o fim do setup até agora
            tempoEfetivoMinutos = (agora - dataFimSetup) / (1000 * 60);
        }

        // Produção teórica = producaoIdeal (unid/min) × minutos decorridos
        // Garantir que não seja negativa
        const producaoTeorica = Math.max(0, producaoIdealPorMinuto * tempoEfetivoMinutos);

        // Contar ciclos reais desde o fim do setup até agora
        let producaoReal = 0;
        
        if (setupFinalizado && dataFimSetup) {
            // Buscar ciclos desde o fim do setup
            // API filtra por machineId no backend, mas fazemos filtro adicional no frontend por segurança
            const ciclosResponse = await makeAuthenticatedRequest(
                `/api/producao?machineId=${encodeURIComponent(machineId)}&period=year`
            );

            if (ciclosResponse && ciclosResponse.ok) {
                const ciclosData = await ciclosResponse.json();
                const ciclos = ciclosData.data || [];
                
                // Filtrar ciclos desde o fim do setup até agora
                // Os ciclos_producao usam: timestamp (Date), machineId (String)
                const ciclosDesdeFimSetup = ciclos.filter(ciclo => {
                    // Obter timestamp do ciclo (pode ser Date ou string ISO)
                    let cicloDate;
                    if (ciclo.timestamp) {
                        cicloDate = ciclo.timestamp instanceof Date 
                            ? ciclo.timestamp 
                            : new Date(ciclo.timestamp);
                    } else {
                        return false; // Se não tem timestamp, ignorar
                    }
                    
                    // Verificar também se o machineId do ciclo corresponde (case insensitive)
                    const cicloMachineId = (ciclo.machineId || ciclo.machine || '').toString().toUpperCase();
                    const ordemMachineId = machineId.toString().toUpperCase();
                    
                    return cicloDate >= dataFimSetup && cicloDate <= agora && cicloMachineId === ordemMachineId;
                });
                
                // Cada ciclo = 1 peça
                producaoReal = ciclosDesdeFimSetup.length;
            }
        }

        // Calcular percentual de performance
        // Pode passar de 100%
        let performancePercent = 0;
        if (producaoTeorica > 0) {
            performancePercent = (producaoReal / producaoTeorica) * 100;
        } else if (producaoReal > 0) {
            // Se não há produção teórica mas há produção real, considerar 0% ou algum valor mínimo
            performancePercent = 0;
        }

        // Armazenar valor de performance para cálculo do OEE (ANTES de atualizar UI)
        valoresOEE.performance = performancePercent;
        
        // Armazenar producaoReal globalmente para uso na Qualidade
        producaoRealGlobal = producaoReal;
        
        // Sincronizar quantidadeProduzida no banco de dados
        if (ordem && ordem._id) {
            await syncQuantidadeProduzida(ordem._id, producaoReal);
        }
        
        // Atualizar interface
        updatePerformanceUI(producaoTeorica, producaoReal, performancePercent);
    } catch (error) {
        console.error('Erro ao atualizar performance:', error);
        resetPerformance();
    }
}

// Resetar valores de performance
function resetPerformance() {
    updatePerformanceUI(0, 0, 0);
    valoresOEE.performance = 0;
    producaoRealGlobal = 0;
}

// Sincronizar quantidadeProduzida no banco de dados
async function syncQuantidadeProduzida(ordemId, quantidadeProduzida) {
    try {
        console.log('🔄 Sincronizando quantidadeProduzida:', { ordemId, quantidadeProduzida });
        
        const response = await makeAuthenticatedRequest(`/api/ordens-producao/${ordemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantidadeProduzida })
        });

        if (response && response.ok) {
            const data = await response.json();
            console.log('✅ QuantidadeProduzida sincronizada com sucesso');
            
            // Verificar se a ordem foi finalizada automaticamente
            if (data.finalizada) {
                showNotification('🎉 Ordem de produção finalizada automaticamente! Quantidade meta atingida.', 'success');
                
                // Aguardar um pouco e recarregar os dados para refletir a finalização
                setTimeout(() => {
                    loadProdutoInfo();
                }, 2000);
            }
        } else {
            console.warn('⚠️ Não foi possível sincronizar quantidadeProduzida:', response?.status);
        }
    } catch (error) {
        console.warn('⚠️ Erro ao sincronizar quantidadeProduzida:', error);
        // Não propagar o erro para não interromper a atualização da interface
    }
}

// Atualizar UI do card de performance
function updatePerformanceUI(producaoTeorica, producaoReal, performancePercent) {
    // Atualizar gauge
    updateGauge('performanceGauge', performancePercent);

    // Se o gauge não existir nesta página, não tentar atualizar DOM
    const gaugeElPerformance = document.getElementById('performanceGauge');
    if (!gaugeElPerformance) {
        return;
    }

    // Atualizar valores dos campos - buscar dentro do card de performance
    const cardPerformance = gaugeElPerformance.closest('.monitoring-card');
    if (cardPerformance) {
        const infoItems = cardPerformance.querySelectorAll('.info-item');
        if (infoItems.length >= 2) {
            // Teórico (primeiro item)
            const teoricoEl = infoItems[0].querySelector('.info-value');
            if (teoricoEl) {
                const teoricoArredondado = Math.round(producaoTeorica);
                teoricoEl.textContent = `${teoricoArredondado} peças`;
            }
            
            // Real (segundo item)
            const realEl = infoItems[1].querySelector('.info-value');
            if (realEl) {
                realEl.textContent = `${producaoReal} peças`;
            }
        }
    }
}

// Função para formatar tempo em HH:MM:SS
function formatarTempo(minutos) {
    if (minutos < 0) minutos = 0;
    
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = Math.floor(minutos % 60);
    const segundos = Math.floor((minutos % 1) * 60);
    
    return `${String(horas).padStart(2, '0')}:${String(minutosRestantes).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

// Atualizar card de disponibilidade
async function updateDisponibilidade(ordem) {
    try {
        // Se não houver ordem ativa, resetar valores
        if (!ordem || !ordem.vinculoProdutoMaquina) {
            resetDisponibilidade();
            return;
        }

        // Obter vínculo produto-máquina (pode vir populado ou como ObjectId)
        let vinculo = ordem.vinculoProdutoMaquina;
        
        // Se o vínculo for um ObjectId (string), buscar os dados completos
        if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.tempoSetup)) {
            const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
            
            // Buscar vínculo completo via API
            try {
                const vinculoResponse = await makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                if (vinculoResponse && vinculoResponse.ok) {
                    const vinculoData = await vinculoResponse.json();
                    vinculo = vinculoData.data || vinculo;
                } else {
                    console.warn('Não foi possível buscar dados completos do vínculo, usando dados da ordem');
                }
            } catch (err) {
                console.warn('Erro ao buscar vínculo completo:', err);
            }
        }

        if (!vinculo) {
            console.error('Vínculo não encontrado na ordem', ordem);
            resetDisponibilidade();
            return;
        }

        // Debug: verificar dados do vínculo
        console.log('Disponibilidade - Vínculo completo:', vinculo);
        console.log('Disponibilidade - tempoSetup:', vinculo.tempoSetup);

        // Obter tempoSetup em segundos
        // Pode estar no vínculo diretamente ou no configuracaoProduto populado
        let tempoSetupSegundos = vinculo.tempoSetup || 0;
        
        // Se não encontrou no vínculo diretamente, verificar se há configuracaoProduto populado
        if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
            }
        }
        
        console.log('Disponibilidade - tempoSetupSegundos:', tempoSetupSegundos);

        // Obter machineId primeiro para verificar resetTimestamp
        const machineId = await getMachineIdFromOrdem(ordem);
        
        if (!machineId) {
            console.error('MachineId não encontrado na ordem', ordem);
            resetDisponibilidade();
            return;
        }
        
        console.log('Disponibilidade - machineId obtido:', machineId);

        // Obter data de início: usar resetTimestamp se existir, senão usar createdAt da ordem
        // Isso garante que dados antigos não sejam contabilizados quando uma nova ordem nasce
        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            // Usar resetTimestamp se existir (nova ordem criada)
            dataInicioOrdem = new Date(resetTimestampStored);
            console.log('Disponibilidade - Usando resetTimestamp armazenado:', dataInicioOrdem);
        } else {
            // Fallback para createdAt da ordem
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date 
                    ? ordem.createdAt 
                    : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date 
                    ? ordem.created_at 
                    : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
            console.log('Disponibilidade - Usando createdAt da ordem (sem resetTimestamp):', dataInicioOrdem);
        }
        const agora = new Date();

        // Verificar se o setup está finalizado
        // Pode ser finalizado automaticamente (tempo passou) ou forçado (botão)
        const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000; // em segundos
        
        // Verificar se há setup finalizado forçado no localStorage
        const setupForcadoKey = `setupFinalizado_${machineId}`;
        const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
        let dataFimSetup = null;
        let setupFinalizado = false;
        
        if (setupForcadoTimestamp) {
            // Setup foi finalizado forçadamente - sempre considerar finalizado se existe timestamp
            dataFimSetup = new Date(setupForcadoTimestamp);
            setupFinalizado = true; // Se existe timestamp no localStorage, setup está finalizado
            console.log('Disponibilidade - Setup finalizado forçadamente em:', dataFimSetup);
        } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
            // Setup finalizado automaticamente pelo tempo
            dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
            setupFinalizado = true;
            console.log('Disponibilidade - Setup finalizado automaticamente');
        }

        // Definir início teórico após setup
        const dataInicioTeorico = setupFinalizado && dataFimSetup 
            ? dataFimSetup 
            : new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);

        // Calcular tempo teórico (desde o fim do setup até agora)
        let tempoTeoricoMinutos = 0;
        if (setupFinalizado) {
            tempoTeoricoMinutos = (agora - dataInicioTeorico) / (1000 * 60);
        }

        // Buscar paradas desde o início teórico até agora
        let totalParadasSegundos = 0;
        
        if (setupFinalizado) {
            // Buscar paradas desde o início teórico
            // API filtra por machineId no backend, mas fazemos filtro adicional no frontend por segurança
            const machineIdUppercase = machineId.toString().toUpperCase();
            console.log('Disponibilidade - Buscando paradas para machineId:', machineIdUppercase);
            const paradasResponse = await makeAuthenticatedRequest(
                `/api/paradas-maquina?machineId=${encodeURIComponent(machineIdUppercase)}&period=year`
            );

            if (paradasResponse && paradasResponse.ok) {
                const paradasData = await paradasResponse.json();
                const paradas = paradasData.data || [];
                console.log('Disponibilidade - Paradas retornadas:', paradas.length, paradas);
                
                // Filtrar paradas que estão dentro do período da ordem e somar duration_seconds
                // As paradas_maquina usam: timestamp (Date), machineId (String, uppercase), duration_seconds (Number)
                // O timestamp representa quando a parada foi registrada (fim da parada)
                paradas.forEach(parada => {
                    // Verificar se o machineId corresponde (paradas usam uppercase)
                    const paradaMachineId = (parada.machineId || '').toString().toUpperCase();
                    const ordemMachineId = machineId.toString().toUpperCase();
                    
                    if (paradaMachineId !== ordemMachineId) {
                        return; // Parada de outra máquina
                    }
                    
                    // Obter timestamp da parada (pode ser Date ou string ISO)
                    let paradaTimestamp;
                    if (parada.timestamp) {
                        paradaTimestamp = parada.timestamp instanceof Date 
                            ? parada.timestamp 
                            : new Date(parada.timestamp);
                    } else {
                        return; // Se não tem timestamp, ignorar
                    }
                    
                    // Usar duration_seconds (campo principal) ou duration (fallback)
                    const duracaoSegundos = parada.duration_seconds || parada.duration || 0;
                    
                    if (duracaoSegundos <= 0) {
                        return; // Parada sem duração válida
                    }
                    
                    // Calcular início e fim da parada
                    // Assumimos que timestamp é quando a parada foi registrada (fim)
                    const paradaFim = new Date(paradaTimestamp);
                    const paradaInicio = new Date(paradaFim.getTime() - (duracaoSegundos * 1000));
                    
                    // Verificar se a parada está dentro do período [dataInicioTeorico, agora]
                    // A parada está dentro se: paradaInicio >= dataInicioTeorico E paradaFim <= agora
                    const paradaEstaNoPeriodo = paradaInicio >= dataInicioTeorico && paradaFim <= agora;
                    
                    if (paradaEstaNoPeriodo) {
                        // Parada completamente dentro do período - somar toda a duração
                        totalParadasSegundos += duracaoSegundos;
                        console.log('Parada no período:', parada.reason, duracaoSegundos, 'segundos');
                    } else {
                        // Verificar se a parada se sobrepõe parcialmente ao período
                        const paradaSeSobrepoe = paradaInicio < agora && paradaFim > dataInicioTeorico;
                        
                        if (paradaSeSobrepoe) {
                            // Calcular a quantidade de segundos da parada que está dentro do período
                            const inicioSobreposicao = paradaInicio < dataInicioTeorico ? dataInicioTeorico : paradaInicio;
                            const fimSobreposicao = paradaFim > agora ? agora : paradaFim;
                            const segundosNoPeriodo = Math.max(0, (fimSobreposicao - inicioSobreposicao) / 1000);
                            
                            totalParadasSegundos += segundosNoPeriodo;
                            console.log('Parada parcialmente no período:', parada.reason, segundosNoPeriodo, 'segundos');
                        }
                    }
                });
                
                console.log('Disponibilidade - Total paradas segundos:', totalParadasSegundos);
            }
        }

        // Converter tempo de paradas para minutos
        const totalParadasMinutos = totalParadasSegundos / 60;

        // Calcular tempo real = tempo teórico - paradas
        const tempoRealMinutos = Math.max(0, tempoTeoricoMinutos - totalParadasMinutos);
        
        console.log('Disponibilidade - Cálculo:', {
            tempoTeoricoMinutos,
            totalParadasMinutos,
            tempoRealMinutos,
            totalParadasSegundos
        });

        // Calcular percentual de disponibilidade
        let disponibilidadePercentual = 0;
        if (tempoTeoricoMinutos > 0) {
            disponibilidadePercentual = (tempoRealMinutos / tempoTeoricoMinutos) * 100;
        } else {
            // Fallback: 100% se o teórico for 0
            disponibilidadePercentual = 100;
        }

        // Calcular tempo de setup em minutos
        const tempoSetupMinutos = tempoSetupSegundos / 60;

        // Determinar status do setup
        let statusSetup = 'Aguardando Ordem';
        if (setupFinalizado) {
            statusSetup = 'Finalizado';
        } else {
            const tempoRestanteSetup = (dataInicioTeorico - agora) / (1000 * 60);
            statusSetup = `Em Setup (${formatarTempo(tempoRestanteSetup)} restante)`;
        }

        // Armazenar valor de disponibilidade para cálculo do OEE (ANTES de atualizar UI)
        valoresOEE.disponibilidade = disponibilidadePercentual;
        
        // Atualizar interface (passar também se está em setup para mostrar botão)
        const emSetup = !setupFinalizado && ordem && ordem.status === 'em-producao';
        updateDisponibilidadeUI(tempoTeoricoMinutos, tempoRealMinutos, tempoSetupMinutos, disponibilidadePercentual, statusSetup, emSetup, machineId);
    } catch (error) {
        console.error('Erro ao atualizar disponibilidade:', error);
        resetDisponibilidade();
    }
}

// Resetar valores de disponibilidade
function resetDisponibilidade() {
    updateDisponibilidadeUI(0, 0, 0, 0, 'Aguardando Ordem', false);
    valoresOEE.disponibilidade = 0;
}

// Função para finalizar setup forçadamente
async function finalizarSetupForcado() {
    try {
        // Obter ordem ativa
        const maquinasUsuario = await getUserMachineFromAPI();
        if (!maquinasUsuario || maquinasUsuario.length === 0) {
            return;
        }

        const promises = maquinasUsuario.map(maquina => 
            makeAuthenticatedRequest(`/api/ordens-producao?maquina=${maquina.machineId}&status=em-producao`)
        );

        const responses = await Promise.all(promises);
        
        let ordemAtiva = null;
        for (const response of responses) {
            if (response && response.ok) {
                const data = await response.json();
                const ordens = data.data || [];
                if (ordens.length > 0) {
                    ordemAtiva = ordens[0];
                    break;
                }
            }
        }

        if (!ordemAtiva) {
            showNotification('Nenhuma ordem ativa encontrada', 'error');
            return;
        }

        // Obter machineId
        const machineId = await getMachineIdFromOrdem(ordemAtiva);
        if (!machineId) {
            showNotification('Não foi possível identificar a máquina', 'error');
            return;
        }

        // Armazenar timestamp do fim do setup forçado
        const agora = new Date();
        const setupForcadoKey = `setupFinalizado_${machineId}`;
        localStorage.setItem(setupForcadoKey, agora.toISOString());
        
        console.log(`Setup finalizado forçadamente para máquina ${machineId} em:`, agora.toISOString());
        
        showNotification('Setup finalizado com sucesso!', 'success');
        
        // Recarregar dados para atualizar os cálculos
        await loadProdutoInfo();
    } catch (error) {
        console.error('Erro ao finalizar setup:', error);
        showNotification('Erro ao finalizar setup', 'error');
    }
}

// Atualizar UI do card de disponibilidade
function updateDisponibilidadeUI(tempoTeoricoMinutos, tempoRealMinutos, tempoSetupMinutos, disponibilidadePercentual, statusSetup, emSetup = false, machineId = null) {
    // Atualizar gauge
    updateGauge('disponibilidadeGauge', disponibilidadePercentual);

    // Se o gauge não existir nesta página, não tentar atualizar DOM
    const gaugeElDispon = document.getElementById('disponibilidadeGauge');
    if (!gaugeElDispon) {
        return;
    }

    // Atualizar valores dos campos - buscar dentro do card de disponibilidade
    const cardDisponibilidade = gaugeElDispon.closest('.monitoring-card');
    if (cardDisponibilidade) {
        const infoItems = cardDisponibilidade.querySelectorAll('.info-item');
        if (infoItems.length >= 4) {
            // Teórico (primeiro item)
            const teoricoEl = infoItems[0].querySelector('.info-value');
            if (teoricoEl) {
                teoricoEl.textContent = formatarTempo(tempoTeoricoMinutos);
            }
            
            // Real (segundo item)
            const realEl = infoItems[1].querySelector('.info-value');
            if (realEl) {
                realEl.textContent = formatarTempo(tempoRealMinutos);
            }
            
            // Setup (terceiro item)
            const setupEl = infoItems[2].querySelector('.info-value');
            if (setupEl) {
                setupEl.textContent = formatarTempo(tempoSetupMinutos);
            }
            
            // Status Setup (quarto item)
            const statusSetupEl = infoItems[3].querySelector('.info-value');
            if (statusSetupEl) {
                statusSetupEl.textContent = statusSetup;
                // Alterar cor baseado no status
                statusSetupEl.classList.remove('blue-text', 'green-text');
                if (statusSetup === 'Finalizado') {
                    statusSetupEl.classList.add('green-text');
                } else {
                    // Em Setup ou Aguardando Ordem - usar azul
                    statusSetupEl.classList.add('blue-text');
                }
            }
        }

        // Mostrar/ocultar botão de finalizar setup
        const btnFinalizarSetup = document.getElementById('btnFinalizarSetup');
        if (btnFinalizarSetup) {
            if (emSetup && machineId) {
                // Verificar se o setup ainda não foi finalizado forçadamente
                const setupForcadoKey = `setupFinalizado_${machineId}`;
                const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
                if (!setupForcadoTimestamp) {
                    btnFinalizarSetup.style.display = 'flex';
                } else {
                    btnFinalizarSetup.style.display = 'none';
                }
            } else {
                btnFinalizarSetup.style.display = 'none';
            }
        }
    }
}

// Atualizar card de OEE (Overall Equipment Effectiveness)
function updateOEE() {
    // Obter valores dos outros cards
    const disponibilidade = valoresOEE.disponibilidade || 0;
    const performance = valoresOEE.performance || 0;
    const qualidade = valoresOEE.qualidade || 0;
    
    // Debug: verificar valores armazenados
    console.log('OEE - Valores armazenados nos cards:');
    console.log('  - valoresOEE.disponibilidade:', valoresOEE.disponibilidade);
    console.log('  - valoresOEE.performance:', valoresOEE.performance);
    console.log('  - valoresOEE.qualidade:', valoresOEE.qualidade);
    
    // Calcular OEE usando a fórmula: OEE = (Disponibilidade × Performance × Qualidade) / 10000
    let oee = (disponibilidade * performance * qualidade) / 10000;
    
    // Clampar o valor entre 0 e 100
    oee = Math.max(0, Math.min(100, oee));
    
    console.log('OEE - Cálculo:');
    console.log(`  - Disponibilidade: ${disponibilidade.toFixed(2)}%`);
    console.log(`  - Performance: ${performance.toFixed(2)}%`);
    console.log(`  - Qualidade: ${qualidade.toFixed(2)}%`);
    console.log(`  - OEE = (${disponibilidade.toFixed(2)} × ${performance.toFixed(2)} × ${qualidade.toFixed(2)}) / 10000 = ${oee.toFixed(2)}%`);
    
    // Atualizar gauge
    updateGauge('geralGauge', oee);
}

// Resetar valores de OEE
function resetOEE() {
    valoresOEE = {
        disponibilidade: 0,
        performance: 0,
        qualidade: 0
    };
    producaoRealGlobal = 0;
    updateGauge('geralGauge', 0);
}

// Funções para modal de descarte
async function loadInitialData() {
    try {
        await loadMotivosFromAPI();
        await loadMaquinasFromAPI();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

async function loadMotivosFromAPI() {
    try {
        const response = await makeAuthenticatedRequest('/api/motivos-descarte');
        if (response && response.ok) {
            const data = await response.json();
            motivosDescarte = data.data || [];
            populateMotivosSelect();
        }
    } catch (error) {
        console.error('Erro ao carregar motivos da API:', error);
        motivosDescarte = [];
    }
}

async function loadMaquinasFromAPI() {
    try {
        const response = await makeAuthenticatedRequest('/api/auth/maquinas-operador');
        if (response && response.ok) {
            const data = await response.json();
            const todas = data.data || [];
            const fixedId = getFixedMachineIdFromPage();
            maquinas = fixedId ? todas.filter(m => (m.machineId || '').toString().toUpperCase() === fixedId.toString().toUpperCase()) : todas;
            populateMachineSelect();
        }
    } catch (error) {
        console.error('Erro ao carregar máquinas da API:', error);
        maquinas = [];
    }
}

function populateMotivosSelect() {
    const motivoSelect = document.getElementById('modalMotivo');
    if (motivoSelect) {
        motivoSelect.innerHTML = '<option value="">Selecione um motivo</option>';
        motivosDescarte.forEach(motivo => {
            const option = document.createElement('option');
            option.value = motivo._id;
            option.textContent = `${motivo.codigo} - ${motivo.nome}`;
            motivoSelect.appendChild(option);
        });
    }
}

function populateMachineSelect() {
    const machineSelect = document.getElementById('modalMachine');
    if (machineSelect) {
        machineSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
        maquinas.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.machineId;
            option.textContent = `${machine.machineId} - ${machine.nome}`;
            machineSelect.appendChild(option);
        });
    }
}

function openModal() {
    const modal = document.getElementById('descarteModal');
    const form = document.getElementById('descarteForm');
    
    if (!modal || !form) return;
    
    // Limpar formulário
    form.reset();
    
    // Garantir que os selects estão populados
    if (motivosDescarte.length === 0 || maquinas.length === 0) {
        loadInitialData().then(() => {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    } else {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const modal = document.getElementById('descarteModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Obter valores dos campos
    const maquinaId = document.getElementById('modalMachine').value;
    const motivoId = document.getElementById('modalMotivo').value;
    const quantidade = parseInt(document.getElementById('modalQuantidade').value);
    const severidade = document.getElementById('modalSeveridade').value;
    const descricao = document.getElementById('modalDescricao').value;
    
    // Validações básicas
    if (!maquinaId || !motivoId || !quantidade || !severidade) {
        showNotification('Todos os campos obrigatórios devem ser preenchidos', 'error');
        return;
    }
    
    // Buscar dados da máquina e motivo selecionados
    const maquinaSelecionada = maquinas.find(m => m.machineId === maquinaId);
    const motivoSelecionado = motivosDescarte.find(m => m._id === motivoId);
    
    if (!maquinaSelecionada) {
        showNotification('Máquina selecionada não encontrada', 'error');
        return;
    }
    
    if (!motivoSelecionado) {
        showNotification('Motivo selecionado não encontrado', 'error');
        return;
    }
    
    // Preparar dados para envio
    const formData = {
        maquina: maquinaSelecionada.machineId,
        categoria: motivoSelecionado.classe,
        motivo: motivoSelecionado.nome,
        quantidade: quantidade,
        severidade: severidade.toLowerCase(),
        descricao: descricao.trim()
    };

    try {
        const response = await makeAuthenticatedRequest('/api/descartes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response && response.ok) {
            const data = await response.json();
            console.log('Descarte salvo com sucesso:', data);
            
            closeModal();
            showNotification('Descarte registrado com sucesso!', 'success');
            
            // Recarregar qualidade após registrar descarte
            await loadProdutoInfo();
        } else {
            const errorData = await response.json();
            console.error('Erro ao salvar descarte:', errorData);
            showNotification(errorData.message || 'Erro ao registrar descarte', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar descarte:', error);
        showNotification('Erro ao registrar descarte', 'error');
    }
}

// Atualizar informações de descartes (Descartes Hoje e Total do Mês)
async function updateDescartesInfo() {
    try {
        // Buscar ordem ativa para obter a máquina
        const maquinasUsuario = await getUserMachineFromAPI();
        if (!maquinasUsuario || maquinasUsuario.length === 0) {
            // Se não há máquinas, resetar valores para 0
            resetDescartesInfoUI();
            return;
        }

        // Buscar ordens em produção para todas as máquinas
        const promises = maquinasUsuario.map(maquina => 
            makeAuthenticatedRequest(`/api/ordens-producao?maquina=${maquina.machineId}&status=em-producao`)
        );

        const responses = await Promise.all(promises);
        
        // Encontrar a primeira ordem em produção
        let ordemAtiva = null;
        for (const response of responses) {
            if (response && response.ok) {
                const data = await response.json();
                const ordens = data.data || [];
                if (ordens.length > 0) {
                    ordemAtiva = ordens[0];
                    break;
                }
            }
        }

        // Obter machineId da ordem ativa
        const machineId = ordemAtiva ? await getMachineIdFromOrdem(ordemAtiva) : null;
        
        if (!machineId) {
            // Se não há ordem ativa, resetar valores para 0
            resetDescartesInfoUI();
            return;
        }

        const agora = new Date();
        
        // Calcular início do dia (00:00:00)
        const inicioHoje = new Date(agora);
        inicioHoje.setHours(0, 0, 0,经纪人);
        
        // Calcular início do mês (primeiro dia do mês, 00:00:00)
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        inicioMes.setHours(0, 0, 0, 0);
        
        // Buscar descartes de hoje da máquina ativa (peças ruins)
        const descartesHojeResponse = await makeAuthenticatedRequest(
            `/api/descartes?maquina=${encodeURIComponent(machineId)}&dataInicio=${encodeURIComponent(inicioHoje.toISOString())}&脑海Fim=${encodeURIComponent(agora.toISOString())}&limit=1000`
        );
        
        // Buscar descartes do mês da máquina ativa (peças ruins)
        const descartesMesResponse = await makeAuthenticatedRequest(
            `/api/descartes?maquina=${encodeURIComponent(machineId)}&dataInicio=${encodeURIComponent(inicioMes.toISO繞())}&dataFim=${encodeURIComponent(agora.toISOString())}&limit=1000`
        );
        
        let descartesHoje = 0;
        let descartesMes = 0;
        
        // Processar descartes de hoje (peças ruins)
        if (descartesHojeResponse && descartesHojeResponse.ok) {
            const data = await descartesHojeResponse.json();
            const descartes = data.data || [];
            
            // Filtrar descartes por máquina e data (verificação adicional)
            const descartesHojeFiltrados = descartes.filter(descarte => {
                // Obter dataHora do descarte
                let descarteDate;
                if (descarte.dataHora) {
                    descarteDate = descarte.dataHora instanceof Date 
                        ? descarte.dataHora 
                        : new Date(descarte.dataHora);
                } else if (descarte.createdAt) {
                    descarteDate = descarte.createdAt instanceof Date 
                        ? descarte.createdAt 
                        : new Date(descarte.createdAt);
                } else {
                    return false;
                }
                
                // Verificar se o machineId/maquina corresponde (case insensitive)
                const descarteMaquina = (descarte.maquina || '').toString().toUpperCase();
                const ordemMachineId = machineId.toString().toUpperCase();
                
                return descarteDate >= inicioHoje && descarteDate <= agora && descarteMaquina === ordemMachineId;
            });
            
            // Somar quantidade de todos os descartes de hoje (peças ruins)
            descartesHoje = descartesHojeFiltrados.reduce((sum, descarte) => {
                return sum + (descarte.quantidade || 0);
            }, 0);
            
            console.log('updateDescartesInfo - Descartes hoje (peças ruins):', descartesHoje);
        } else {
            console.warn('updateDescartesInfo descartes hoje - Erro na resposta:', descartesHojeResponse?.status);
        }
        
        // Processar descartes do mês (peças ruins)
        if (descartesMesResponse && descartesMesResponse.ok) {
            const data = await descartesMesResponse.json();
            const descartes = data.data || [];
            
            // Filtrar descartes por máquina e data (verificação adicional)
            const descartesMesFiltrados = descartes.filter(descarte => {
                // Obter dataHora do descarte
                let descarteDate;
                if (descarte.dataHora) {
                    descarteDate = descarte.dataHora instanceof Date 
                        ? descarte.dataHora 
                        : new Date(descarte.dataHora);
                } else if (descarte.createdAt) {
                    descarteDate = descarte.createdAt instanceof Date 
                        ? descarte.createdAt 
                        : new Date(descarte.createdAt);
                } else {
                    return false;
                }
                
                // Verificar se o machineId/maquina corresponde (case insensitive)
                const descarteMaquina = (descarte.maquina || '').toString().toUpperCase();
                const ordemMachineId = machineId.toString().toUpperCase();
                
                return descarteDate >= inicioMes && descarteDate <= agora && descarteMaquina === ordemMachineId;
            });
            
            // Somar quantidade de todos os descartes do mês (peças ruins)
            descartesMes = descartesMesFiltrados.reduce((sum, descarte) => {
                return sum + (descarte.quantidade || 0);
            }, 0);
            
            console.log('updateDescartesInfo - Descartes do mês (peças ruins):', descartesMes);
        } else {
            console.warn('updateDescartesInfo descartes mês - Erro na resposta:', descartesMesResponse?.status);
        }
        
        // Atualizar interface
        const cardDescarte = document.querySelector('.descarte-card');
        if (!cardDescarte) {
            console.error('updateDescartesInfo - Card de descarte não encontrado na página');
            return;
        }
        
        const infoItems = cardDescarte.querySelectorAll('.info-item');
        console.log('updateDescartesInfo - Info items encontrados:', infoItems.length);
        
        // Primeiro info-item é "Descartes Hoje"
        if (infoItems.length >= 1) {
            const descartesHojeEl = infoItems[0].querySelector('.info-value');
            if (descartesHojeEl) {
                descartesHojeEl.textContent = descartesHoje.toString();
                console.log('updateDescartesInfo - Descartes Hoje atualizado na UI:', descartesHoje);
            } else {
                console.warn('updateDescartesInfo - Elemento de descartes hoje não encontrado');
            }
        }
        
        // Segundo info-item é "Total do Mês"
        if (infoItems.length >= 2) {
            const descartesMesEl = infoItems[1].querySelector('.info-value');
            if (descartesMesEl) {
                descartesMesEl.textContent = descartesMes.toString();
                console.log('updateDescartesInfo - Descartes do Mês atualizado na UI:', descartesMes);
            } else {
                console.warn('updateDescartesInfo - Elemento de descartes do mês não encontrado');
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar informações de descartes:', error);
        // Em caso de erro, manter valores atuais ou resetar para 0
        const cardDescarte = document.querySelector('.descarte-card');
        if (cardDescarte) {
            const infoItems = cardDescarte.querySelectorAll('.info-item');
            if (infoItems.length >= 1) {
                const descartesHojeEl = infoItems[0].querySelector('.info-value');
                if (descartesHojeEl) {
                    descartesHojeEl.textContent = '0';
                }
            }
            if (infoItems.length >= 2) {
                const descartesMesEl = infoItems[1].querySelector('.info-value');
                if (descartesMesEl) {
                    descartesMesEl.textContent = '0';
                }
            }
        }
    }
}

function showNotification(message, type = 'info') {
    const statusMessage = document.querySelector('.status-message');
    if (!statusMessage) return;

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    statusMessage.innerHTML = `
        <div style="background: ${colors[type]}; color: white; padding: 1rem; border-radius: 8px; text-align: center;">
            ${message}
        </div>
    `;
    statusMessage.classList.add('show');

    // Remove após 3 segundos
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

// ===== FUNÇÕES DE ORDEM DE PRODUÇÃO =====
let ordemEditandoId = null;
let maquinasUsuario = [];
let vinculosProdutos = [];

// Abrir modal de ordem de produção
async function openOrdemModal() {
    const modal = document.getElementById('ordemProducaoModal');
    if (!modal) return;

    // Obter todas as máquinas do usuário
    maquinasUsuario = await getUserMachineFromAPI();
    if (!maquinasUsuario || maquinasUsuario.length === 0) {
        showNotification('Nenhuma máquina associada ao usuário', 'error');
        return;
    }

    // Atualizar título com todas as máquinas
    const maquinasTexto = maquinasUsuario.map(m => m.nome || m.machineId).join(', ');
    document.getElementById('maquinaNomeOrdenacao').textContent = maquinasTexto || 'Todas as máquinas';

    // Resetar formulário
    ordemEditandoId = null;
    const form = document.getElementById('ordemProducaoForm');
    if (form) {
        form.reset();
        document.getElementById('ordemStatus').value = 'Em Produção';
    }

    // Atualizar botão
    const salvarBtn = document.getElementById('salvarOrdemBtn');
    if (salvarBtn) {
        salvarBtn.innerHTML = '<i class="fas fa-save"></i> Criar Ordem';
    }

    // Carregar produtos e ordens de todas as máquinas
    await Promise.all([
        loadVinculosProdutos(),
        loadOrdensProducao()
    ]);

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Fechar modal de ordem
function closeOrdemModal() {
    const modal = document.getElementById('ordemProducaoModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    ordemEditandoId = null;
    maquinasUsuario = [];
    vinculosProdutos = [];
    const form = document.getElementById('ordemProducaoForm');
    if (form) {
        form.reset();
    }
}

// Obter máquina do usuário via API
async function getUserMachineFromAPI() {
    try {
        const response = await makeAuthenticatedRequest('/api/auth/maquinas-operador');
        if (response && response.ok) {
            const data = await response.json();
            const todas = data.data || [];
            const fixedId = getFixedMachineIdFromPage();
            if (fixedId) {
                return todas.filter(m => (m.machineId || '').toString().toUpperCase() === fixedId.toString().toUpperCase());
            }
            return todas;
        }
    } catch (error) {
        console.error('Erro ao buscar máquinas:', error);
    }
    return [];
}

// Carregar vínculos de produtos para todas as máquinas
async function loadVinculosProdutos() {
    if (!maquinasUsuario || maquinasUsuario.length === 0) {
        vinculosProdutos = [];
        populateProdutoSelect();
        return;
    }

    try {
        // Buscar vínculos de todas as máquinas em paralelo
        const promises = maquinasUsuario.map(maquina => 
            makeAuthenticatedRequest(`/api/ordens-producao/vinculos/${maquina.machineId}`)
        );

        const responses = await Promise.all(promises);
        
        // Unificar todos os vínculos
        const vinculosMap = new Map(); // Usar Map para evitar duplicatas

        // Processar todas as respostas
        await Promise.all(responses.map(async (response, index) => {
            if (response && response.ok) {
                try {
                    const data = await response.json();
                    const vinculos = data.data || [];
                    vinculos.forEach(vinculo => {
                        // Usar _id do vínculo como chave para evitar duplicatas do mesmo vínculo
                        // Mas permitir o mesmo produto em máquinas diferentes
                        const key = `${vinculo._id}-${maquinasUsuario[index].machineId}`;
                        if (!vinculosMap.has(key)) {
                            // Adicionar informação da máquina ao vínculo
                            vinculo.maquinaInfo = {
                                machineId: maquinasUsuario[index].machineId,
                                nome: maquinasUsuario[index].nome
                            };
                            vinculosMap.set(key, vinculo);
                        }
                    });
                } catch (err) {
                    console.error(`Erro ao processar vínculos da máquina ${maquinasUsuario[index].machineId}:`, err);
                }
            }
        }));

        vinculosProdutos = Array.from(vinculosMap.values());
        populateProdutoSelect();
    } catch (error) {
        console.error('Erro ao carregar vínculos:', error);
        vinculosProdutos = [];
        populateProdutoSelect();
    }
}

// Popular select de produtos
function populateProdutoSelect() {
    const select = document.getElementById('ordemProduto');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um produto</option>';

    if (vinculosProdutos.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nenhum produto vinculado às máquinas';
        option.disabled = true;
        select.appendChild(option);
        return;
    }

    vinculosProdutos.forEach(vinculo => {
        const produto = vinculo.produto;
        if (produto) {
            const option = document.createElement('option');
            option.value = vinculo._id;
            // Incluir informação da máquina se disponível
            const maquinaInfo = vinculo.maquinaInfo ? ` [${vinculo.maquinaInfo.nome || vinculo.maquinaInfo.machineId}]` : '';
            option.textContent = `${produto.codigoProduto || ''} - ${produto.nomeProduto || 'Produto sem nome'}${maquinaInfo}`;
            select.appendChild(option);
        }
    });
}

// Carregar ordens de produção de todas as máquinas
async function loadOrdensProducao() {
    if (!maquinasUsuario || maquinasUsuario.length === 0) {
        const tbody = document.getElementById('ordensTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">Nenhuma máquina disponível</td></tr>';
        }
        return;
    }

    const tbody = document.getElementById('ordensTableBody');
    if (!tbody) return;

    try {
        // Buscar ordens de todas as máquinas em paralelo
        const promises = maquinasUsuario.map(maquina => 
            makeAuthenticatedRequest(`/api/ordens-producao?maquina=${maquina.machineId}`)
        );

        const responses = await Promise.all(promises);
        
        // Unificar todas as ordens
        let todasOrdens = [];

        await Promise.all(responses.map(async (response, index) => {
            if (response && response.ok) {
                try {
                    const data = await response.json();
                    const ordens = data.data || [];
                    todasOrdens = todasOrdens.concat(ordens);
                } catch (err) {
                    console.error(`Erro ao processar ordens da máquina ${maquinasUsuario[index].machineId}:`, err);
                }
            }
        }));

        // Filtrar ordens finalizadas - não mostrar na interface
        todasOrdens = todasOrdens.filter(ordem => ordem.status !== 'finalizada');

        // Ordenar por data de criação (mais recentes primeiro)
        todasOrdens.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });

        renderOrdensTable(todasOrdens);
    } catch (error) {
        console.error('Erro ao carregar ordens:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">Erro ao carregar ordens</td></tr>';
    }
}

// Renderizar tabela de ordens
function renderOrdensTable(ordens) {
    const tbody = document.getElementById('ordensTableBody');
    if (!tbody) return;

    if (ordens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: #6b7280; font-size: 0.9rem;">Nenhuma ordem de produção encontrada</td></tr>';
        return;
    }

    tbody.innerHTML = ordens.map(ordem => {
        const produto = ordem.produto || {};
        const maquina = ordem.maquina || {};
        const dataFim = ordem.dataFim ? new Date(ordem.dataFim).toLocaleDateString('pt-BR') : '-';
        const statusClass = ordem.status || 'em-producao';
        const statusText = {
            'em-producao': 'Em Produção',
            'finalizada': 'Finalizada',
            'cancelada': 'Cancelada'
        }[ordem.status] || ordem.status;

        // Adicionar informação da máquina no produto se disponível
        const produtoTexto = produto.nomeProduto || produto.codigoProduto || '-';
        const maquinaTexto = maquina.nome || maquina.machineId || '';
        const produtoCompleto = maquinaTexto ? `${produtoTexto} [${maquinaTexto}]` : produtoTexto;

        // Truncar produto se muito longo
        const produtoDisplay = produtoCompleto.length > 40 
            ? produtoCompleto.substring(0, 40) + '...' 
            : produtoCompleto;

        const ordemId = ordem._id;
        const numeroOrdem = ordem.numeroOrdem || '';
        
        return `
            <tr>
                <td>${ordem.numeroOrdem || '-'}</td>
                <td title="${produtoCompleto}">${produtoDisplay}</td>
                <td>${ordem.quantidade || 0}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${dataFim}</td>
                <td>
                    ${ordem.status === 'em-producao' ? `
                        <button class="btn-edit-ordem" data-ordem-id="${ordemId}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-ordem" data-ordem-id="${ordemId}" data-numero-ordem="${numeroOrdem}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <button class="btn-delete-ordem" data-ordem-id="${ordemId}" data-numero-ordem="${numeroOrdem}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

// Configurar event delegation para tabela de ordens (uma vez só)
function setupOrdensTableDelegation() {
    const tbody = document.getElementById('ordensTableBody');
    if (tbody && !tbody.hasAttribute('data-listener-setup')) {
        tbody.setAttribute('data-listener-setup', 'true');
        tbody.addEventListener('click', handleOrdemTableClick);
    }
}

// Handler para cliques na tabela de ordens
function handleOrdemTableClick(e) {
    const target = e.target.closest('button');
    if (!target) return;
    
    if (target.classList.contains('btn-edit-ordem')) {
        const ordemId = target.getAttribute('data-ordem-id');
        if (ordemId) {
            editarOrdem(ordemId);
        }
    } else if (target.classList.contains('btn-delete-ordem')) {
        const ordemId = target.getAttribute('data-ordem-id');
        const numeroOrdem = target.getAttribute('data-numero-ordem');
        if (ordemId) {
            excluirOrdem(ordemId, numeroOrdem);
        }
    }
}

// Função para editar ordem
async function editarOrdem(ordemId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/ordens-producao/${ordemId}`);
        if (!response || !response.ok) {
            showNotification('Erro ao carregar ordem para edição', 'error');
            return;
        }

        const data = await response.json();
        const ordem = data.data;

        if (!ordem || ordem.status !== 'em-producao') {
            showNotification('Apenas ordens em produção podem ser editadas', 'error');
            return;
        }

        ordemEditandoId = ordemId;

        // Preencher formulário
        const vinculoId = ordem.vinculoProdutoMaquina 
            ? (ordem.vinculoProdutoMaquina._id || ordem.vinculoProdutoMaquina.toString())
            : '';
        document.getElementById('ordemProduto').value = vinculoId;
        document.getElementById('ordemQuantidade').value = ordem.quantidade || '';
        
        if (ordem.dataFim) {
            const data = new Date(ordem.dataFim);
            document.getElementById('ordemDataFim').value = data.toISOString().split('T')[0];
        } else {
            document.getElementById('ordemDataFim').value = '';
        }
        
        document.getElementById('ordemObservacoes').value = ordem.observacoes || '';

        // Atualizar botão
        const salvarBtn = document.getElementById('salvarOrdemBtn');
        if (salvarBtn) {
            salvarBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Ordem';
        }

        // Scroll para o topo do formulário
        const modalBody = document.querySelector('.ordem-producao-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
    } catch (error) {
        console.error('Erro ao editar ordem:', error);
        showNotification('Erro ao carregar ordem para edição', 'error');
    }
}

// Função para excluir ordem (na verdade, finaliza a ordem)
async function excluirOrdem(ordemId, numeroOrdem) {
    if (!confirm(`Tem certeza que deseja finalizar a ordem ${numeroOrdem || ordemId}?`)) {
        return;
    }

    try {
        const response = await makeAuthenticatedRequest(`/api/ordens-producao/${ordemId}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            showNotification('Ordem finalizada com sucesso!', 'success');
            await Promise.all([
                loadOrdensProducao(),
                loadProdutoInfo() // Atualizar informações do produto
            ]);
        } else {
            const data = await response.json();
            showNotification(data.message || 'Erro ao finalizar ordem', 'error');
        }
    } catch (error) {
        console.error('Erro ao finalizar ordem:', error);
        showNotification('Erro ao finalizar ordem', 'error');
    }
};

// Submeter formulário de ordem
async function handleOrdemSubmit(e) {
    e.preventDefault();

    const vinculoId = document.getElementById('ordemProduto').value;
    const quantidade = document.getElementById('ordemQuantidade').value;
    const dataFim = document.getElementById('ordemDataFim').value;
    const observacoes = document.getElementById('ordemObservacoes').value;

    if (!vinculoId || !quantidade) {
        showNotification('Produto e quantidade são obrigatórios', 'error');
        return;
    }

    try {
        let response;
        if (ordemEditandoId) {
            // Atualizar ordem existente
            response = await makeAuthenticatedRequest(`/api/ordens-producao/${ordemEditandoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quantidade: parseInt(quantidade),
                    dataFim: dataFim || null,
                    observacoes: observacoes.trim()
                })
            });
        } else {
            // Criar nova ordem
            response = await makeAuthenticatedRequest('/api/ordens-producao', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vinculoProdutoMaquinaId: vinculoId,
                    quantidade: parseInt(quantidade),
                    dataFim: dataFim || null,
                    observacoes: observacoes.trim()
                })
            });
        }

        if (response && response.ok) {
            const data = await response.json();
            showNotification(ordemEditandoId ? 'Ordem atualizada com sucesso!' : 'Ordem criada com sucesso!', 'success');
            
            // Se for uma nova ordem (não edição), armazenar resetTimestamp para resetar contadores
            if (!ordemEditandoId && data.data) {
                const novaOrdem = data.data;
                // Obter machineId da nova ordem
                const machineId = await getMachineIdFromOrdem(novaOrdem);
                if (machineId) {
                    // Armazenar timestamp de reset para esta máquina
                    const resetTimestamp = novaOrdem.createdAt 
                        ? (novaOrdem.createdAt instanceof Date ? novaOrdem.createdAt : new Date(novaOrdem.createdAt))
                        : new Date();
                    const resetKey = `resetTimestamp_${machineId}`;
                    localStorage.setItem(resetKey, resetTimestamp.toISOString());
                    console.log(`Reset timestamp armazenado para máquina ${machineId}:`, resetTimestamp.toISOString());
                    
                    // Limpar setup finalizado forçado ao criar nova ordem
                    const setupForcadoKey = `setupFinalizado_${machineId}`;
                    localStorage.removeItem(setupForcadoKey);
                    console.log(`Setup finalizado forçado removido para máquina ${machineId}`);
                }
            }
            
            // Recarregar tabela e resetar formulário
            // Recarregar vínculos também para garantir que a lista está atualizada
            await Promise.all([
                loadVinculosProdutos(),
                loadOrdensProducao(),
                loadProdutoInfo() // Atualizar informações do produto
            ]);
            
            if (!ordemEditandoId) {
                document.getElementById('ordemProducaoForm').reset();
                document.getElementById('ordemStatus').value = 'Em Produção';
            } else {
                ordemEditandoId = null;
                const salvarBtn = document.getElementById('salvarOrdemBtn');
                if (salvarBtn) {
                    salvarBtn.innerHTML = '<i class="fas fa-save"></i> Criar Ordem';
                }
            }
        } else {
            const data = await response.json();
            showNotification(data.message || 'Erro ao salvar ordem', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar ordem:', error);
        showNotification('Erro ao salvar ordem', 'error');
    }
}

// Função para fazer requisições autenticadas
async function makeAuthenticatedRequest(url, options = {}) {
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
        showNotification('Erro de conexão. Tente novamente.', 'error');
        return null;
    }
}

