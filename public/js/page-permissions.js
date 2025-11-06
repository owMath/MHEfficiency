// Sistema de permissões para todas as páginas
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar um pouco para garantir que permissions.js foi carregado
    setTimeout(async () => {
        // Verificar se é operador
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (user.tipoUsuario === 'operador') {
            console.log('Usuário é operador - aplicando restrições...');
            
            if (window.initPermissions) {
                await window.initPermissions();
            } else {
                console.error('Função initPermissions não encontrada!');
            }
            
            // Verificar permissão específica da página atual
            checkPagePermission();
        } else {
            console.log('Usuário é empresa - acesso total');
        }
        
        console.log('Sistema de permissões inicializado!');
    }, 100);
});

// Função para verificar permissão da página atual
function checkPagePermission() {
    const currentPage = getCurrentPagePermission();
    
    if (currentPage && window.hasPermission && !window.hasPermission(currentPage)) {
        console.log(`Usuário não tem permissão para acessar: ${currentPage}`);
        alert('Você não tem permissão para acessar esta página.');
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Função para identificar qual permissão corresponde à página atual
function getCurrentPagePermission() {
    const currentPath = window.location.pathname;
    const fileName = currentPath.split('/').pop();
    
    const pagePermissions = {
        'index.html': 'dashboard',
        'visao-tempo-real.html': 'tempo-real',
        'usuarios.html': 'usuarios',
        'aprovacao-operadores.html': 'aprovacao-operadores',
        'cadastro-empresa.html': 'config-sistema',
        'cadastro-operador.html': 'config-sistema',
        'configuracoes-sistema.html': 'config-sistema',
        'motivos-parada.html': 'motivos-parada',
        'motivos-descarte.html': 'motivos-descarte',
        'paradas-maquina.html': 'paradas',
        'analise-producao.html': 'producao',
        'cadastro-produtos.html': 'cadastro-produtos',
        'produto-maquina.html': 'produto-maquina',
        'configuracao-produtos.html': 'config-produtos',
        'configuracoes-turno.html': 'config-turno',
        'previsao.html': 'previsao-oee',
        'mtbf.html': 'mtbf',
        'mttr.html': 'mttr'
    };
    
    return pagePermissions[fileName] || null;
}
