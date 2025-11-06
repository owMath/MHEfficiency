// Script para verificar e corrigir status do usuário
async function checkUserStatus() {
    console.log('🔍 Verificando status do usuário...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ Token não encontrado');
        return;
    }
    
    try {
        // Verificar status atual
        const statusResponse = await fetch('/api/configuracoes/debug/user-status', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (statusResponse.ok) {
            const data = await statusResponse.json();
            console.log('👤 Status atual do usuário:', data.user);
            
            if (data.user.status !== 'ativo') {
                console.log(`⚠️ Usuário com status: ${data.user.status}`);
                
                // Perguntar se quer corrigir
                if (confirm(`Usuário tem status "${data.user.status}". Deseja corrigir para "ativo"?`)) {
                    await fixUserStatus();
                }
            } else {
                console.log('✅ Usuário já está ativo');
            }
        } else {
            console.log('❌ Erro ao verificar status:', statusResponse.status);
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

async function fixUserStatus() {
    console.log('🔧 Corrigindo status do usuário...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ Token não encontrado');
        return;
    }
    
    try {
        const fixResponse = await fetch('/api/configuracoes/debug/fix-user-status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (fixResponse.ok) {
            const data = await fixResponse.json();
            console.log('✅ Status corrigido:', data);
            alert('Status do usuário corrigido com sucesso!');
        } else {
            console.log('❌ Erro ao corrigir status:', fixResponse.status);
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

// Função para testar a API de configurações após corrigir o status
async function testConfigAfterFix() {
    console.log('🧪 Testando API de configurações após correção...');
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ Token não encontrado');
        return;
    }
    
    try {
        const response = await fetch('/api/configuracoes/empresa', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📊 Status da resposta:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API funcionando:', data);
        } else {
            const errorText = await response.text();
            console.log('❌ Erro na API:', errorText);
        }
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

// Função completa para resolver o problema
async function resolveUserStatusIssue() {
    console.log('🚀 Iniciando resolução do problema de status...');
    
    await checkUserStatus();
    await testConfigAfterFix();
    
    console.log('✅ Processo concluído!');
}

// Disponibilizar funções globalmente
if (typeof window !== 'undefined') {
    window.checkUserStatus = checkUserStatus;
    window.fixUserStatus = fixUserStatus;
    window.testConfigAfterFix = testConfigAfterFix;
    window.resolveUserStatusIssue = resolveUserStatusIssue;
    
    console.log('🔧 Funções de correção disponíveis:');
    console.log('- checkUserStatus()');
    console.log('- fixUserStatus()');
    console.log('- testConfigAfterFix()');
    console.log('- resolveUserStatusIssue()');
}
