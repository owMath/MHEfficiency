// JavaScript para página de OEE Geral
// Usa a mesma lógica de cálculo do OEE que maquina-1.html (visao-tempo-real.js)

// Variáveis para armazenar valores dos indicadores OEE por máquina
const valoresOEEPorMaquina = {};

// Variável para armazenar produção real por máquina (para uso na Qualidade)
const producaoRealGlobalPorMaquina = {};

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
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('Erro na requisição:', error);
        return null;
    }
}

// Buscar máquinas do usuário
async function getUserMachines() {
    try {
        const response = await makeAuthenticatedRequest('/api/auth/maquinas-operador');
        if (response && response.ok) {
            const data = await response.json();
            return data.data || [];
        }
    } catch (error) {
        console.error('Erro ao buscar máquinas:', error);
    }
    return [];
}

// Função helper para obter machineId da ordem
async function getMachineIdFromOrdem(ordem, maquinasUsuario) {
    if (!ordem || !ordem.maquina) {
        return null;
    }

    if (typeof ordem.maquina === 'object') {
        if (ordem.maquina.machineId) {
            return ordem.maquina.machineId.toString();
        }
    }
    
    if (typeof ordem.maquina === 'string') {
        if (ordem.maquina.length === 24 && /^[0-9a-fA-F]{24}$/.test(ordem.maquina)) {
            const maquina = maquinasUsuario.find(m => {
                const maquinaIdObj = m._id?.toString() || m.machineId?.toString();
                return maquinaIdObj === ordem.maquina;
            });
            
            if (maquina && maquina.machineId) {
                return maquina.machineId.toString();
            }
        } else {
            return ordem.maquina;
        }
    }
    
    return null;
}

// Calcular Disponibilidade para uma máquina específica (mesma lógica de visao-tempo-real.js)
async function calcularDisponibilidade(ordem, machineId) {
    try {
        if (!ordem || !ordem.vinculoProdutoMaquina) {
            return { disponibilidade: 0 };
        }

        let vinculo = ordem.vinculoProdutoMaquina;
        
        if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.producaoIdeal)) {
            const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
            try {
                const vinculoResponse = await makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                if (vinculoResponse && vinculoResponse.ok) {
                    const vinculoData = await vinculoResponse.json();
                    vinculo = vinculoData.data || vinculo;
                }
            } catch (err) {
                console.warn('Erro ao buscar vínculo completo:', err);
            }
        }

        if (!vinculo) {
            return { disponibilidade: 0 };
        }

        let tempoSetupSegundos = vinculo.tempoSetup || 0;
        if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
            }
        }

        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            dataInicioOrdem = new Date(resetTimestampStored);
        } else {
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date ? ordem.createdAt : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date ? ordem.created_at : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
        }
        const agora = new Date();

        const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000;
        const setupForcadoKey = `setupFinalizado_${machineId}`;
        const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
        let dataFimSetup = null;
        let setupFinalizado = false;
        
        if (setupForcadoTimestamp) {
            dataFimSetup = new Date(setupForcadoTimestamp);
            setupFinalizado = true;
        } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
            dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
            setupFinalizado = true;
        }

        const dataInicioTeorico = setupFinalizado && dataFimSetup 
            ? dataFimSetup 
            : new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);

        let tempoTeoricoMinutos = 0;
        if (setupFinalizado) {
            tempoTeoricoMinutos = (agora - dataInicioTeorico) / (1000 * 60);
        }

        let totalParadasSegundos = 0;
        
        if (setupFinalizado) {
            const machineIdUppercase = machineId.toString().toUpperCase();
            const paradasResponse = await makeAuthenticatedRequest(
                `/api/paradas-maquina?machineId=${encodeURIComponent(machineIdUppercase)}&period=year`
            );

            if (paradasResponse && paradasResponse.ok) {
                const paradasData = await paradasResponse.json();
                const paradas = paradasData.data || [];
                
                paradas.forEach(parada => {
                    const paradaMachineId = (parada.machineId || '').toString().toUpperCase();
                    const ordemMachineId = machineId.toString().toUpperCase();
                    
                    if (paradaMachineId !== ordemMachineId) {
                        return;
                    }
                    
                    let paradaTimestamp;
                    if (parada.timestamp) {
                        paradaTimestamp = parada.timestamp instanceof Date 
                            ? parada.timestamp 
                            : new Date(parada.timestamp);
                    } else {
                        return;
                    }
                    
                    const duracaoSegundos = parada.duration_seconds || parada.duration || 0;
                    if (duracaoSegundos <= 0) {
                        return;
                    }
                    
                    const paradaFim = new Date(paradaTimestamp);
                    const paradaInicio = new Date(paradaFim.getTime() - (duracaoSegundos * 1000));
                    const paradaEstaNoPeriodo = paradaInicio >= dataInicioTeorico && paradaFim <= agora;
                    
                    if (paradaEstaNoPeriodo) {
                        totalParadasSegundos += duracaoSegundos;
                    } else {
                        const paradaSeSobrepoe = paradaInicio < agora && paradaFim > dataInicioTeorico;
                        if (paradaSeSobrepoe) {
                            const inicioSobreposicao = paradaInicio < dataInicioTeorico ? dataInicioTeorico : paradaInicio;
                            const fimSobreposicao = paradaFim > agora ? agora : paradaFim;
                            const segundosNoPeriodo = Math.max(0, (fimSobreposicao - inicioSobreposicao) / 1000);
                            totalParadasSegundos += segundosNoPeriodo;
                        }
                    }
                });
            }
        }

        const totalParadasMinutos = totalParadasSegundos / 60;
        const tempoRealMinutos = Math.max(0, tempoTeoricoMinutos - totalParadasMinutos);

        let disponibilidadePercentual = 0;
        if (tempoTeoricoMinutos > 0) {
            disponibilidadePercentual = (tempoRealMinutos / tempoTeoricoMinutos) * 100;
        } else {
            disponibilidadePercentual = 100;
        }

        return { disponibilidade: disponibilidadePercentual };
    } catch (error) {
        console.error(`Erro ao calcular disponibilidade para ${machineId}:`, error);
        return { disponibilidade: 0 };
    }
}

// Calcular Performance para uma máquina específica (mesma lógica de visao-tempo-real.js)
async function calcularPerformance(ordem, machineId) {
    try {
        if (!ordem || !ordem.vinculoProdutoMaquina) {
            return { performance: 0, producaoReal: 0 };
        }

        let vinculo = ordem.vinculoProdutoMaquina;
        
        if (typeof vinculo === 'string' || (typeof vinculo === 'object' && vinculo._id && !vinculo.producaoIdeal)) {
            const vinculoId = typeof vinculo === 'string' ? vinculo : vinculo._id || vinculo;
            try {
                const vinculoResponse = await makeAuthenticatedRequest(`/api/vinculos-produto-maquina/${vinculoId}`);
                if (vinculoResponse && vinculoResponse.ok) {
                    const vinculoData = await vinculoResponse.json();
                    vinculo = vinculoData.data || vinculo;
                }
            } catch (err) {
                console.warn('Erro ao buscar vínculo completo:', err);
            }
        }

        if (!vinculo) {
            return { performance: 0, producaoReal: 0 };
        }

        let producaoIdealPorHora = vinculo.producaoIdeal || 0;
        if (producaoIdealPorHora === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.producaoIdeal) {
                producaoIdealPorHora = vinculo.configuracaoProduto.producaoIdeal;
            }
        }
        
        const producaoIdealPorMinuto = producaoIdealPorHora / 60;

        let tempoSetupSegundos = vinculo.tempoSetup || 0;
        if (tempoSetupSegundos === 0 && vinculo.configuracaoProduto) {
            if (typeof vinculo.configuracaoProduto === 'object' && vinculo.configuracaoProduto.tempoSetup) {
                tempoSetupSegundos = vinculo.configuracaoProduto.tempoSetup;
            }
        }

        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            dataInicioOrdem = new Date(resetTimestampStored);
        } else {
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date ? ordem.createdAt : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date ? ordem.created_at : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
        }
        const agora = new Date();

        const tempoDecorridoDesdeInicio = (agora - dataInicioOrdem) / 1000;
        const setupForcadoKey = `setupFinalizado_${machineId}`;
        const setupForcadoTimestamp = localStorage.getItem(setupForcadoKey);
        let dataFimSetup = null;
        let setupFinalizado = false;
        
        if (setupForcadoTimestamp) {
            dataFimSetup = new Date(setupForcadoTimestamp);
            setupFinalizado = true;
        } else if (tempoDecorridoDesdeInicio >= tempoSetupSegundos) {
            dataFimSetup = new Date(dataInicioOrdem.getTime() + tempoSetupSegundos * 1000);
            setupFinalizado = true;
        }

        let tempoEfetivoMinutos = 0;
        if (setupFinalizado && dataFimSetup) {
            tempoEfetivoMinutos = (agora - dataFimSetup) / (1000 * 60);
        }

        const producaoTeorica = Math.max(0, producaoIdealPorMinuto * tempoEfetivoMinutos);

        let producaoReal = 0;
        
        if (setupFinalizado && dataFimSetup) {
            const ciclosResponse = await makeAuthenticatedRequest(
                `/api/producao?machineId=${encodeURIComponent(machineId)}&period=year`
            );

            if (ciclosResponse && ciclosResponse.ok) {
                const ciclosData = await ciclosResponse.json();
                const ciclos = ciclosData.data || [];
                
                const ciclosDesdeFimSetup = ciclos.filter(ciclo => {
                    let cicloDate;
                    if (ciclo.timestamp) {
                        cicloDate = ciclo.timestamp instanceof Date 
                            ? ciclo.timestamp 
                            : new Date(ciclo.timestamp);
                    } else {
                        return false;
                    }
                    
                    const cicloMachineId = (ciclo.machineId || ciclo.machine || '').toString().toUpperCase();
                    const ordemMachineId = machineId.toString().toUpperCase();
                    
                    return cicloDate >= dataFimSetup && cicloDate <= agora && cicloMachineId === ordemMachineId;
                });
                
                producaoReal = ciclosDesdeFimSetup.length;
            }
        }

        let performancePercent = 0;
        if (producaoTeorica > 0) {
            performancePercent = (producaoReal / producaoTeorica) * 100;
        }

        return { performance: performancePercent, producaoReal: producaoReal };
    } catch (error) {
        console.error(`Erro ao calcular performance para ${machineId}:`, error);
        return { performance: 0, producaoReal: 0 };
    }
}

// Calcular Qualidade para uma máquina específica (mesma lógica de visao-tempo-real.js)
async function calcularQualidade(ordem, machineId, producaoReal) {
    try {
        if (!ordem || !ordem.maquina) {
            return { qualidade: 0 };
        }

        let dataInicioOrdem;
        const resetKey = `resetTimestamp_${machineId}`;
        const resetTimestampStored = localStorage.getItem(resetKey);
        
        if (resetTimestampStored) {
            dataInicioOrdem = new Date(resetTimestampStored);
        } else {
            if (ordem.createdAt) {
                dataInicioOrdem = ordem.createdAt instanceof Date ? ordem.createdAt : new Date(ordem.createdAt);
            } else if (ordem.created_at) {
                dataInicioOrdem = ordem.created_at instanceof Date ? ordem.created_at : new Date(ordem.created_at);
            } else {
                dataInicioOrdem = new Date();
            }
        }
        const agora = new Date();

        const pecasTotais = producaoReal;

        const descartesResponse = await makeAuthenticatedRequest(
            `/api/descartes?maquina=${encodeURIComponent(machineId)}&dataInicio=${encodeURIComponent(dataInicioOrdem.toISOString())}&dataFim=${encodeURIComponent(agora.toISOString())}&limit=1000`
        );

        let totalDescartes = 0;
        if (descartesResponse && descartesResponse.ok) {
            const descartesData = await descartesResponse.json();
            const descartes = descartesData.data || [];
            
            const descartesDesdeOrdem = descartes.filter(descarte => {
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
                
                const descarteMaquina = (descarte.maquina || '').toString().toUpperCase();
                const ordemMachineId = machineId.toString().toUpperCase();
                
                return descarteDate >= dataInicioOrdem && descarteDate <= agora && descarteMaquina === ordemMachineId;
            });
            
            totalDescartes = descartesDesdeOrdem.reduce((sum, descarte) => {
                return sum + (descarte.quantidade || 0);
            }, 0);
        }

        const pecasBoas = Math.max(0, pecasTotais - totalDescartes);
        
        let qualidadePercent = 0;
        if (pecasTotais > 0) {
            qualidadePercent = (pecasBoas / pecasTotais) * 100;
        }

        return { qualidade: qualidadePercent };
    } catch (error) {
        console.error(`Erro ao calcular qualidade para ${machineId}:`, error);
        return { qualidade: 0 };
    }
}

// Calcular OEE completo para uma máquina
async function calcularOEEPorMaquina(maquina, maquinasUsuario) {
    try {
        const machineId = maquina.machineId || maquina._id;
        
        // Buscar ordem em produção para esta máquina
        const ordemResponse = await makeAuthenticatedRequest(
            `/api/ordens-producao?maquina=${machineId}&status=em-producao`
        );
        
        if (!ordemResponse || !ordemResponse.ok) {
            return {
                machineId: machineId,
                disponibilidade: 0,
                performance: 0,
                qualidade: 0,
                oee: 0
            };
        }
        
        const ordemData = await ordemResponse.json();
        const ordens = ordemData.data || [];
        
        if (ordens.length === 0) {
            return {
                machineId: machineId,
                disponibilidade: 0,
                performance: 0,
                qualidade: 0,
                oee: 0
            };
        }
        
        const ordem = ordens[0]; // Pegar a primeira ordem ativa
        
        // Obter machineId da ordem
        const ordemMachineId = await getMachineIdFromOrdem(ordem, maquinasUsuario);
        if (!ordemMachineId) {
            return {
                machineId: machineId,
                disponibilidade: 0,
                performance: 0,
                qualidade: 0,
                oee: 0
            };
        }
        
        // Calcular na ordem correta: Disponibilidade -> Performance -> Qualidade
        const disponibilidadeResult = await calcularDisponibilidade(ordem, ordemMachineId);
        const performanceResult = await calcularPerformance(ordem, ordemMachineId);
        const qualidadeResult = await calcularQualidade(ordem, ordemMachineId, performanceResult.producaoReal);
        
        // Calcular OEE
        const oee = (disponibilidadeResult.disponibilidade * performanceResult.performance * qualidadeResult.qualidade) / 10000;
        const oeeClamped = Math.max(0, Math.min(100, oee));
        
        return {
            machineId: machineId,
            disponibilidade: disponibilidadeResult.disponibilidade,
            performance: performanceResult.performance,
            qualidade: qualidadeResult.qualidade,
            oee: oeeClamped
        };
    } catch (error) {
        console.error(`Erro ao calcular OEE para máquina ${maquina.machineId}:`, error);
        return {
            machineId: maquina.machineId || maquina._id,
            disponibilidade: 0,
            performance: 0,
            qualidade: 0,
            oee: 0
        };
    }
}

// Criar card de OEE para uma máquina
function criarCardOEE(maquina) {
    const card = document.createElement('div');
    const machineId = maquina.machineId || maquina._id || 'unknown';
    card.className = 'oee-geral-card';
    card.dataset.machineId = machineId;
    
    const nomeMaquina = maquina.nome || 
                        maquina.configuracoes?.nome || 
                        maquina.name || 
                        machineId || 
                        'Máquina';
    
    card.innerHTML = `
        <h3 class="card-title-geral">${nomeMaquina.toUpperCase()}</h3>
        <div class="card-content-geral">
            <div class="gauge-container-geral">
                <div class="circular-gauge-geral" id="gauge-${machineId}">
                    <span class="gauge-value-geral">0.0%</span>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Atualizar o gauge de uma máquina específica
function atualizarGaugeOEE(machineId, valor) {
    const gauge = document.getElementById(`gauge-${machineId}`);
    if (!gauge) return;
    
    const gaugeValue = gauge.querySelector('.gauge-value-geral');
    if (gaugeValue) {
        gaugeValue.textContent = valor.toFixed(1) + '%';
    }
    
    gauge.removeAttribute('data-oee-excellent');
    gauge.removeAttribute('data-oee-good');
    gauge.removeAttribute('data-oee-poor');
    
    if (valor >= 81) {
        gauge.setAttribute('data-oee-excellent', 'true');
    } else if (valor >= 61) {
        gauge.setAttribute('data-oee-good', 'true');
    } else {
        gauge.setAttribute('data-oee-poor', 'true');
    }
}

// Carregar e exibir OEE de todas as máquinas
async function carregarOEEPorMaquinas() {
    try {
        const grid = document.getElementById('oeeMachinesGrid');
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading-message"><i class="fas fa-spinner fa-spin"></i><span>Carregando OEE das máquinas...</span></div>';
        
        const maquinas = await getUserMachines();
        
        if (!maquinas || maquinas.length === 0) {
            grid.innerHTML = '<div class="loading-message"><i class="fas fa-exclamation-triangle"></i><span>Nenhuma máquina encontrada</span></div>';
            return;
        }

        grid.innerHTML = '';

        // Criar cards e calcular OEE para cada máquina
        const promises = maquinas.map(async (maquina) => {
            const machineId = maquina.machineId || maquina._id || 'unknown';
            
            // Criar card
            const card = criarCardOEE(maquina);
            grid.appendChild(card);
            
            // Calcular OEE usando a mesma lógica de maquina-1.html
            const resultadoOEE = await calcularOEEPorMaquina(maquina, maquinas);
            atualizarGaugeOEE(machineId, resultadoOEE.oee);
            
            return resultadoOEE;
        });
        
        await Promise.all(promises);
        
        console.log('OEE de todas as máquinas carregado com sucesso');
        
    } catch (error) {
        console.error('Erro ao carregar OEE das máquinas:', error);
        const grid = document.getElementById('oeeMachinesGrid');
        if (grid) {
            grid.innerHTML = '<div class="loading-message"><i class="fas fa-exclamation-triangle"></i><span>Erro ao carregar dados</span></div>';
        }
    }
}

// Inicializar página
async function initializeOEEGeral() {
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }
    
    await carregarOEEPorMaquinas();
    
    // Atualizar a cada 10 segundos (mesmo intervalo de maquina-1.html)
    setInterval(async () => {
        await carregarOEEPorMaquinas();
    }, 10000);
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    initializeOEEGeral();
});
