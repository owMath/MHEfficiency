// Teste específico para a rota de configurações da empresa
async function testConfigRoute() {
    console.log('🧪 Testando rota de configurações da empresa...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ Token não encontrado');
        return;
    }
    
    console.log('🔑 Token encontrado:', token.substring(0, 20) + '...');
    
    try {
        // Teste 1: GET - Buscar configurações
        console.log('1️⃣ Testando GET /api/configuracoes/empresa...');
        const getResponse = await fetch('/api/configuracoes/empresa', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        console.log('GET Status:', getResponse.status);
        console.log('GET Headers:', Object.fromEntries(getResponse.headers.entries()));
        
        if (getResponse.ok) {
            const data = await getResponse.json();
            console.log('✅ GET funcionando:', data);
        } else {
            const errorText = await getResponse.text();
            console.log('❌ GET erro:', errorText);
        }
        
        // Teste 2: POST - Salvar configurações
        console.log('2️⃣ Testando POST /api/configuracoes/empresa...');
        const testData = {
            nome: 'Empresa Teste',
            email: 'teste@empresa.com',
            cnpj: '12.345.678/0001-90',
            razaoSocial: 'Empresa Teste LTDA',
            moedaPadrao: 'BRL',
            cep: '12345-678',
            endereco: 'Rua Teste, 123',
            numero: '123',
            bairro: 'Centro',
            cidade: 'São Paulo',
            estado: 'SP',
            telefone: '(11) 1234-5678',
            celular: '(11) 98765-4321',
            website: 'https://www.empresa-teste.com'
        };
        
        const postResponse = await fetch('/api/configuracoes/empresa', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('POST Status:', postResponse.status);
        console.log('POST Headers:', Object.fromEntries(postResponse.headers.entries()));
        
        if (postResponse.ok) {
            const data = await postResponse.json();
            console.log('✅ POST funcionando:', data);
        } else {
            const errorText = await postResponse.text();
            console.log('❌ POST erro:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Teste de conectividade básica
async function testBasicConnectivity() {
    console.log('🌐 Testando conectividade básica...');
    
    try {
        // Teste health check
        const healthResponse = await fetch('/health');
        console.log('Health check status:', healthResponse.status);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('✅ Servidor funcionando:', healthData);
        } else {
            console.log('❌ Servidor com problemas');
        }
        
        // Teste database status
        const dbResponse = await fetch('/api/database/status');
        console.log('Database status:', dbResponse.status);
        
        if (dbResponse.ok) {
            const dbData = await dbResponse.json();
            console.log('✅ Database funcionando:', dbData);
        } else {
            console.log('❌ Database com problemas');
        }
        
    } catch (error) {
        console.error('❌ Erro de conectividade:', error);
    }
}

// Função principal de teste
async function runAllTests() {
    console.log('🚀 Iniciando todos os testes...');
    
    await testBasicConnectivity();
    await testConfigRoute();
    
    console.log('✅ Testes concluídos!');
}

// Disponibilizar funções globalmente
if (typeof window !== 'undefined') {
    window.testConfigRoute = testConfigRoute;
    window.testBasicConnectivity = testBasicConnectivity;
    window.runAllTests = runAllTests;
    
    console.log('🔧 Funções de teste disponíveis:');
    console.log('- testBasicConnectivity()');
    console.log('- testConfigRoute()');
    console.log('- runAllTests()');
}
