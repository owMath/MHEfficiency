// Script específico para inicializar permissões no dashboard
console.log('=== INICIANDO SISTEMA DE PERMISSÕES ===');

// Aguardar um pouco para garantir que permissions.js foi carregado
setTimeout(async () => {
    // Verificar se é operador
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Usuário logado:', user);
    
    if (user.tipoUsuario === 'operador') {
        console.log('Usuário é operador - aplicando restrições...');
        if (window.initPermissions) {
            await window.initPermissions();
        } else {
            console.error('Função initPermissions não encontrada!');
        }
    } else {
        console.log('Usuário é empresa - acesso total');
    }
    
    console.log('=== SISTEMA DE PERMISSÕES INICIALIZADO ===');
}, 100);

// Sistema de permissões funcionando corretamente
