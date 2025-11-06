// Configurações da API
const API_BASE_URL = '/api/auth';

// Elementos do DOM
let currentAction = null;
let currentOperatorId = null;

// Função para mostrar/ocultar senha
function togglePassword(inputId) {
    console.log('togglePassword chamado para:', inputId);
    
    const input = document.getElementById(inputId);
    if (!input) {
        console.error('Input não encontrado:', inputId);
        return;
    }
    
    console.log('Input encontrado:', input);
    
    // Encontrar o botão toggle-password dentro do mesmo input-group
    const inputGroup = input.closest('.input-group');
    if (!inputGroup) {
        console.error('Input group não encontrado para:', inputId);
        return;
    }
    
    console.log('Input group encontrado:', inputGroup);
    
    const button = inputGroup.querySelector('.toggle-password');
    if (!button) {
        console.error('Botão toggle-password não encontrado para:', inputId);
        return;
    }
    
    console.log('Botão encontrado:', button);
    
    const icon = button.querySelector('i');
    if (!icon) {
        console.error('Ícone não encontrado no botão para:', inputId);
        return;
    }
    
    console.log('Ícone encontrado:', icon);
    console.log('Tipo atual do input:', input.type);
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        console.log('Senha mostrada');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        console.log('Senha ocultada');
    }
}

// Função para formatar CNPJ
function formatCNPJ(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 18);
}

// Função para formatar telefone
function formatPhone(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})/, '$1-$2')
        .substring(0, 15);
}

// Função para formatar CEP
function formatCEP(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 9);
}

// Aplicar formatação aos campos
document.addEventListener('DOMContentLoaded', function() {
    // Formatação de CNPJ
    const cnpjInput = document.getElementById('cnpj');
    if (cnpjInput) {
        cnpjInput.addEventListener('input', function(e) {
            e.target.value = formatCNPJ(e.target.value);
        });
    }

    // Formatação de telefone
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            e.target.value = formatPhone(e.target.value);
        });
    });

    // Formatação de CEP
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('input', function(e) {
            e.target.value = formatCEP(e.target.value);
        });
    }

    // Event listeners para botões de toggle de senha
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            if (targetId) {
                togglePassword(targetId);
            }
        });
    });

    // Carregar empresas para o select de operador
    loadEmpresas();
});

// Função para carregar empresas ativas
async function loadEmpresas() {
    const select = document.getElementById('empresaVinculada');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE_URL}/empresas-ativas`);
        if (response.ok) {
            const data = await response.json();
            select.innerHTML = '<option value="">Selecione uma empresa</option>';
            
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa._id;
                option.textContent = empresa.empresa.nome;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

// Função para mostrar loading
function showLoading() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Função para ocultar loading
function hideLoading() {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para mostrar mensagem
function showMessage(title, text, type = 'success') {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('messageIcon');
    const titleEl = document.getElementById('messageTitle');
    const textEl = document.getElementById('messageText');
    
    if (modal) {
        // Definir ícone baseado no tipo
        icon.className = type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        
        titleEl.textContent = title;
        textEl.textContent = text;
        
        modal.style.display = 'flex';
        
        // Fechar modal após 3 segundos se for sucesso
        if (type === 'success') {
            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);
        }
    }
}

// Função para fechar modal de mensagem
function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event listeners para modais
document.addEventListener('DOMContentLoaded', function() {
    const messageClose = document.getElementById('messageClose');
    if (messageClose) {
        messageClose.addEventListener('click', closeMessageModal);
    }
});

// Função para validar máquinas selecionadas
function validateMachines() {
    const checkboxes = document.querySelectorAll('input[name="maquinas"]:checked');
    
    if (checkboxes.length === 0) {
        showMessage('Erro', 'Selecione pelo menos uma máquina para a linha de produção', 'error');
        return false;
    }
    
    if (checkboxes.length > 5) {
        showMessage('Erro', 'Você pode selecionar no máximo 5 máquinas', 'error');
        return false;
    }
    
    return true;
}

// Função para validar senhas
function validatePasswords() {
    const senha = document.getElementById('senha');
    const confirmarSenha = document.getElementById('confirmarSenha');
    
    if (senha && confirmarSenha) {
        if (senha.value !== confirmarSenha.value) {
            showMessage('Erro', 'As senhas não coincidem', 'error');
            return false;
        }
    }
    return true;
}

// Função para fazer login
async function login(email, senha) {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            // Salvar token no localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.data));
            
            showMessage('Sucesso', 'Login realizado com sucesso!');
            
            // Redirecionar para dashboard após 2 segundos
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            // Tratar conta pendente (403) como informação ao usuário, não como falha genérica
            if (response.status === 403 && (data.status === 'pendente' || /pendente/i.test(data.message || ''))) {
                showMessage('Aguardando aprovação', data.message || 'Sua conta está aguardando aprovação', 'warning');
                return;
            }

            // Mensagens mais específicas para erros comuns
            if (response.status === 401) {
                showMessage('Erro', data.message || 'Email ou senha incorretos', 'error');
                return;
            }

            if (response.status === 423) {
                showMessage('Conta bloqueada', data.message || 'Muitas tentativas de login. Tente mais tarde.', 'error');
                return;
            }

            showMessage('Erro', data.message || 'Erro ao fazer login', 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
    }
}

// Função para cadastrar operador
async function cadastrarOperador(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/cadastro/operador`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Sucesso', 'Operador cadastrado com sucesso! Aguarde aprovação da empresa.');
            
            // Redirecionar para login após 3 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            showMessage('Erro', data.message || 'Erro ao cadastrar operador', 'error');
        }
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
    }
}

// Função para solicitar recuperação de senha
async function solicitarRecuperacaoSenha(email) {
    try {
        const response = await fetch(`${API_BASE_URL}/esqueci-senha`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Sucesso', data.message || 'Se o email existir em nosso sistema, você receberá um link de recuperação', 'success');
            return true;
        } else {
            showMessage('Erro', data.message || 'Erro ao solicitar recuperação de senha', 'error');
            return false;
        }
    } catch (error) {
        console.error('Erro ao solicitar recuperação:', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
        return false;
    }
}

// Função para redefinir senha
async function redefinirSenha(token, novaSenha) {
    try {
        const response = await fetch(`${API_BASE_URL}/redefinir-senha`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, novaSenha })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Sucesso', data.message || 'Senha redefinida com sucesso!', 'success');
            
            // Redirecionar para login após 2 segundos
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return true;
        } else {
            showMessage('Erro', data.message || 'Erro ao redefinir senha', 'error');
            return false;
        }
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
        return false;
    }
}

// Função para cadastrar empresa
async function cadastrarEmpresa(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/cadastro/empresa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Salvar token no localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.data));
            
            showMessage('Sucesso', 'Empresa cadastrada com sucesso! Acesso liberado.');
            
            // Redirecionar para dashboard após 2 segundos
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            showMessage('Erro', data.message || 'Erro ao cadastrar empresa', 'error');
        }
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showMessage('Erro', 'Erro de conexão. Tente novamente.', 'error');
    }
}

// Event listeners para formulários
document.addEventListener('DOMContentLoaded', function() {
    // Formulário de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validatePasswords()) return;
            
            const formData = new FormData(loginForm);
            const email = formData.get('email');
            const senha = formData.get('senha');
            
            showLoading();
            await login(email, senha);
            hideLoading();
        });
    }

    // Formulário de operador
    const operadorForm = document.getElementById('operadorForm');
    if (operadorForm) {
        operadorForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validatePasswords()) return;
            
            const formData = new FormData(operadorForm);
            const data = {
                nome: formData.get('nome'),
                email: formData.get('email'),
                senha: formData.get('senha'),
                cargo: formData.get('cargo'),
                telefone: formData.get('telefone'),
                empresaVinculada: formData.get('empresaVinculada')
            };
            
            showLoading();
            await cadastrarOperador(data);
            hideLoading();
        });
    }

    // Formulário de empresa
    const empresaForm = document.getElementById('empresaForm');
    if (empresaForm) {
        empresaForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validatePasswords()) return;
            if (!validateMachines()) return;
            
            const formData = new FormData(empresaForm);
            
            // Coletar máquinas selecionadas
            const maquinasSelecionadas = Array.from(document.querySelectorAll('input[name="maquinas"]:checked'))
                .map(checkbox => checkbox.value);
            
            const data = {
                nome: formData.get('nome'),
                email: formData.get('email'),
                senha: formData.get('senha'),
                nomeEmpresa: formData.get('nomeEmpresa'),
                cnpj: formData.get('cnpj'),
                telefone: formData.get('telefone'),
                endereco: {
                    rua: formData.get('rua'),
                    numero: formData.get('numero'),
                    bairro: formData.get('bairro'),
                    cidade: formData.get('cidade'),
                    estado: formData.get('estado'),
                    cep: formData.get('cep')
                },
                linhaProducao: {
                    nome: formData.get('nomeLinha'),
                    descricao: formData.get('descricaoLinha'),
                    maquinas: maquinasSelecionadas
                }
            };
            
            showLoading();
            await cadastrarEmpresa(data);
            hideLoading();
        });
    }

    // Formulário de solicitação de reset
    const requestResetForm = document.getElementById('requestResetForm');
    if (requestResetForm) {
        requestResetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(requestResetForm);
            const email = formData.get('email');
            
            showLoading();
            await solicitarRecuperacaoSenha(email);
            hideLoading();
        });
    }

    // Formulário de redefinição de senha
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(resetPasswordForm);
            const novaSenha = formData.get('novaSenha');
            const confirmarSenha = formData.get('confirmarSenha');
            
            // Validar senhas
            if (novaSenha.length < 6) {
                showMessage('Erro', 'A senha deve ter pelo menos 6 caracteres', 'error');
                return;
            }
            
            if (novaSenha !== confirmarSenha) {
                showMessage('Erro', 'As senhas não coincidem', 'error');
                return;
            }
            
            // Obter token da URL
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            
            if (!token) {
                showMessage('Erro', 'Token de recuperação não encontrado', 'error');
                return;
            }
            
            showLoading();
            await redefinirSenha(token, novaSenha);
            hideLoading();
        });
    }

    // Verificar se há token na URL (página de recuperação)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && requestResetForm && resetPasswordForm) {
        // Mostrar formulário de redefinição e ocultar formulário de solicitação
        requestResetForm.style.display = 'none';
        resetPasswordForm.style.display = 'flex';
        
        // Atualizar subtítulo
        const subtitle = document.getElementById('subtitle');
        if (subtitle) {
            subtitle.textContent = 'Digite sua nova senha';
        }
    }
});

// Função para logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Verificar se usuário está logado
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// Verificar se usuário é empresa/supervisor
function checkSupervisor() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user || user.tipoUsuario !== 'empresa' || user.status !== 'ativo') {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}
