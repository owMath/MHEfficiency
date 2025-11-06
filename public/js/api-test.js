// Teste de conectividade com a API
async function testAPI() {
    console.log('🧪 Testando conectividade com a API...');
    
    try {
        // Teste 1: Health check
        console.log('1️⃣ Testando health check...');
        const healthResponse = await fetch('/health');
        console.log('Health check status:', healthResponse.status);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('✅ Servidor funcionando:', healthData);
        }
        
        // Teste 2: Verificar token
        console.log('2️⃣ Verificando token...');
        const token = localStorage.getItem('token');
        if (token) {
            console.log('✅ Token encontrado:', token.substring(0, 20) + '...');
            
            // Teste 3: Testar rota de configurações
            console.log('3️⃣ Testando rota de configurações...');
            const configResponse = await fetch('/api/configuracoes/empresa', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Config status:', configResponse.status);
            console.log('Config headers:', Object.fromEntries(configResponse.headers.entries()));
            
            if (configResponse.ok) {
                const configData = await configResponse.json();
                console.log('✅ Configurações carregadas:', configData);
            } else {
                const errorText = await configResponse.text();
                console.log('❌ Erro na configuração:', errorText);
            }
        } else {
            console.log('❌ Token não encontrado');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Executar teste quando a página carregar
if (typeof window !== 'undefined') {
    window.testAPI = testAPI;
    console.log('🔧 Função testAPI() disponível. Execute testAPI() no console para testar.');
}
