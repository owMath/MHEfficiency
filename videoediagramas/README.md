# Diagramas do Sistema OEE

Este diretório contém três diagramas principais do sistema de monitoramento OEE:

## 📋 Diagramas Disponíveis

### 1. **Diagrama de Arquitetura** (`diagrama-arquitetura.md`)
Visualiza a arquitetura completa do sistema, incluindo:
- Frontend (HTML/CSS/JavaScript)
- Backend (Node.js/Express)
- Banco de Dados (MongoDB)
- **VPN para acesso remoto às máquinas**
- Sensores das máquinas
- Serviços externos

### 2. **Diagrama de Classes** (`diagrama-classes.md`)
Mostra todas as classes/modelos do sistema e seus relacionamentos:
- User, Machine, Produto
- Configuracoes, Ordens, Turnos
- Paradas, Descartes, Logística
- E todas as outras entidades do sistema

### 3. **Diagrama do Banco de Dados** (`diagrama-banco-dados.md`)
Diagrama ER completo do MongoDB com:
- Todas as 14 coleções principais
- Relacionamentos entre coleções
- Índices principais
- Campos e tipos de dados
- Constraints e validações

## 🚀 Como Visualizar

Os diagramas estão em formato **Mermaid**, que pode ser visualizado em:

1. **GitHub/GitLab**: Renderiza automaticamente arquivos `.md` com diagramas Mermaid
2. **Editores de código**: 
   - VS Code (com extensão "Markdown Preview Mermaid Support")
   - IntelliJ IDEA (suporte nativo)
3. **Ferramentas online**:
   - [Mermaid Live Editor](https://mermaid.live/)
   - [Draw.io](https://app.diagrams.net/) (importar código Mermaid)
4. **Extensões do navegador**:
   - Mermaid Diagrams (Chrome/Edge)
   - Markdown Viewer (Firefox)

## 🔐 VPN - Acesso Remoto às Máquinas

A **VPN** está incluída no **Diagrama de Arquitetura** e permite:
- Ligar/desligar máquinas remotamente
- Editar configurações das máquinas
- Acesso seguro e criptografado
- Conexão entre o Backend e as Máquinas Físicas

## 📊 Estrutura dos Diagramas

### Diagrama de Arquitetura
```
Cliente → Frontend → Backend → Banco de Dados
                ↓
             Serviços Externos
                ↓
    Backend → VPN → Máquinas Físicas
```

### Diagrama de Classes
Mostra todos os modelos Mongoose e suas relações usando UML Class Diagram.

### Diagrama do Banco de Dados
Diagrama ER mostrando:
- Entidades (Collections)
- Relacionamentos (References)
- Atributos principais
- Índices e constraints

## 📝 Notas

- Todos os diagramas foram gerados com base no código fonte atual do sistema
- Os relacionamentos refletem as referências ObjectId entre coleções MongoDB
- Os índices listados são os principais para performance
- A VPN foi incluída no diagrama de arquitetura conforme solicitado

---

**Última atualização**: Baseado no código fonte do projeto OEE Monitoring System

