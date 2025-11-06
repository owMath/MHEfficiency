const nodemailer = require('nodemailer');

// Criar transporter reutilizável
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Envia e-mail de solicitação de compra
 * @param {Object} dados - Dados da solicitação
 * @param {String} dados.para - Email do destinatário
 * @param {String} dados.itemNome - Nome do item
 * @param {String} dados.itemCodigo - Código do item
 * @param {Number} dados.quantidade - Quantidade solicitada
 * @param {String} dados.unidadeMedida - Unidade de medida
 * @param {String} dados.mensagem - Mensagem adicional
 * @param {String} dados.solicitanteNome - Nome de quem está solicitando
 * @returns {Promise}
 */
const enviarEmailSolicitacaoCompra = async (dados) => {
    try {
        const transporter = createTransporter();

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Solicitação de Compra</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        text-align: center;
                    }
                    .content {
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        border: 1px solid #e5e7eb;
                    }
                    .item-info {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #3b82f6;
                    }
                    .item-info h3 {
                        margin-top: 0;
                        color: #1f2937;
                    }
                    .detail {
                        margin: 10px 0;
                        padding: 8px 0;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .detail:last-child {
                        border-bottom: none;
                    }
                    .detail-label {
                        font-weight: 600;
                        color: #374151;
                    }
                    .detail-value {
                        color: #6b7280;
                        margin-left: 10px;
                    }
                    .message-box {
                        background: #eff6ff;
                        border-left: 4px solid #3b82f6;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        color: #6b7280;
                        font-size: 0.875rem;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Solicitação de Compra</h1>
                    <p>Sistema OEE - Gestão de Logística</p>
                </div>
                <div class="content">
                    <p>Prezado(a),</p>
                    <p>Foi realizada uma solicitação de compra através do sistema:</p>
                    
                    <div class="item-info">
                        <h3>Detalhes do Item</h3>
                        <div class="detail">
                            <span class="detail-label">Item:</span>
                            <span class="detail-value">${dados.itemNome}</span>
                        </div>
                        <div class="detail">
                            <span class="detail-label">Código:</span>
                            <span class="detail-value">${dados.itemCodigo}</span>
                        </div>
                        <div class="detail">
                            <span class="detail-label">Quantidade Solicitada:</span>
                            <span class="detail-value">${dados.quantidade} ${dados.unidadeMedida || 'un'}</span>
                        </div>
                        <div class="detail">
                            <span class="detail-label">Solicitante:</span>
                            <span class="detail-value">${dados.solicitanteNome}</span>
                        </div>
                    </div>

                    ${dados.mensagem ? `
                        <div class="message-box">
                            <strong>Mensagem Adicional:</strong>
                            <p>${dados.mensagem.replace(/\n/g, '<br>')}</p>
                        </div>
                    ` : ''}

                    <p>Atenciosamente,<br><strong>${dados.solicitanteNome}</strong></p>
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático do Sistema OEE. Por favor, não responda.</p>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Sistema OEE <sistema@oee.com>',
            to: dados.para,
            subject: `Solicitação de Compra - ${dados.itemNome}`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error);
        throw error;
    }
};

/**
 * Envia e-mail de recuperação de senha
 * @param {Object} dados - Dados da recuperação
 * @param {String} dados.para - Email do destinatário
 * @param {String} dados.nome - Nome do usuário
 * @param {String} dados.token - Token de recuperação
 * @returns {Promise}
 */
const enviarEmailRecuperacaoSenha = async (dados) => {
    try {
        const transporter = createTransporter();
        
        // URL base do frontend (ajustar conforme necessário)
        // Se não definido, usar localhost - em produção, definir FRONTEND_URL no config.env
        const baseUrl = process.env.FRONTEND_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000');
        const resetUrl = `${baseUrl}/recuperar-senha.html?token=${dados.token}`;

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recuperação de Senha</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px 8px 0 0;
                        text-align: center;
                    }
                    .content {
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                        border: 1px solid #e5e7eb;
                    }
                    .button {
                        display: inline-block;
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 8px;
                        margin: 20px 0;
                        font-weight: 600;
                    }
                    .button:hover {
                        opacity: 0.9;
                    }
                    .warning-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        color: #6b7280;
                        font-size: 0.875rem;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Recuperação de Senha</h1>
                    <p>Sistema OEE - MH Efficiency</p>
                </div>
                <div class="content">
                    <p>Olá, <strong>${dados.nome}</strong>!</p>
                    <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
                    <p>Clique no botão abaixo para criar uma nova senha:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetUrl}" class="button">Redefinir Senha</a>
                    </div>
                    
                    <p>Ou copie e cole o link abaixo no seu navegador:</p>
                    <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
                    
                    <div class="warning-box">
                        <strong>⚠️ Importante:</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Este link é válido por apenas <strong>1 hora</strong></li>
                            <li>Se você não solicitou esta recuperação, ignore este e-mail</li>
                            <li>Não compartilhe este link com ninguém</li>
                        </ul>
                    </div>
                    
                    <p>Atenciosamente,<br><strong>Equipe MH Efficiency</strong></p>
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático do Sistema OEE. Por favor, não responda.</p>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Sistema OEE <sistema@oee.com>',
            to: dados.para,
            subject: 'Recuperação de Senha - Sistema OEE',
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail de recuperação:', error);
        throw error;
    }
};

module.exports = {
    enviarEmailSolicitacaoCompra,
    enviarEmailRecuperacaoSenha
};

