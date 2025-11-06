# Diagrama do Banco de Dados
## Sistema de Monitoramento OEE - MongoDB Collections e Relacionamentos

```mermaid
erDiagram
    users ||--o{ machines : "possui"
    users ||--|| empresasconfig : "configurado por"
    users ||--o{ produtos : "produz"
    users ||--o{ configuracaoproduto : "configura"
    users ||--o{ vinculoprodutomaquina : "vincula"
    users ||--o{ ordensproducao : "solicita"
    users ||--o{ paradasmaquina : "registra"
    users ||--o{ descartes : "registra"
    users ||--o{ motivosparada : "define"
    users ||--o{ motivosdescarte : "define"
    users ||--o{ turnos : "possui"
    users ||--o{ linhasproducao : "possui"
    users ||--o{ itemlogistica : "gerencia"
    users ||--o{ solicitacaocompra : "solicita"

    linhasproducao ||--o{ machines : "contém"

    machines ||--o{ produtos : "fabrica"
    machines ||--o{ vinculoprodutomaquina : "produz"
    machines ||--o{ ordensproducao : "executa"
    machines ||--o{ paradasmaquina : "tem paradas"

    produtos ||--|| configuracaoproduto : "tem configuração"
    produtos ||--o{ vinculoprodutomaquina : "vinculado"
    produtos ||--o{ ordensproducao : "produzido em"

    configuracaoproduto ||--o{ vinculoprodutomaquina : "usado em"

    vinculoprodutomaquina ||--o{ ordensproducao : "utilizado em"

    motivosparada ||--o{ paradasmaquina : "classifica"

    empresasconfig ||--o{ descartes : "recebe"

    itemlogistica ||--o{ solicitacaocompra : "solicitado"

    users {
        ObjectId _id PK
        String nome
        String email UK
        String senha
        String tipoUsuario "operador|empresa"
        String status "ativo|pendente|inativo"
        Object empresa
        Object operador
        Date ultimoLogin
        Number tentativasLogin
        Date bloqueadoAte
        Array permissoes
        Date createdAt
        Date updatedAt
    }

    machines {
        ObjectId _id PK
        String machineId UK
        String nome
        String tipo "simulador|real"
        String status "ativo|inativo|manutencao"
        ObjectId linhaProducao FK
        ObjectId empresa FK
        Date ultimaAtualizacao
        Object configuracoes
        Date createdAt
        Date updatedAt
    }

    empresasconfig {
        ObjectId _id PK
        String nome
        String cnpj
        String razaoSocial
        String moedaPadrao "BRL|USD|EUR"
        String endereco
        String telefone
        String email
        ObjectId empresaId FK "unique"
        Date ultimaAtualizacao
        ObjectId atualizadoPor FK
        Date createdAt
        Date updatedAt
    }

    linhasproducao {
        ObjectId _id PK
        String nome
        String descricao
        ObjectId empresa FK
        Array maquinas "ObjectId[]"
        String status "ativo|inativo"
        Object configuracoes
        Date createdAt
        Date updatedAt
    }

    produtos {
        ObjectId _id PK
        String codigoProduto
        String nomeProduto
        String categoria
        ObjectId maquina FK
        String unidadeMedida
        Number peso
        String dimensoes
        String cor
        String materialPrincipal
        String fornecedor
        Number precoUnitario
        Number estoqueMinimo
        String descricao
        String observacoes
        ObjectId empresa FK
        Boolean ativo
        Date createdAt
        Date updatedAt
    }

    configuracaoproduto {
        ObjectId _id PK
        ObjectId produto FK "unique"
        Number tempoCiclo
        Number tempoSetup
        Number producaoIdeal
        Number temperatura
        Number pressao
        Number velocidade
        String materiaisNecessarios
        String instrucoesFabricacao
        ObjectId empresa FK
        Boolean ativo
        Date createdAt
        Date updatedAt
    }

    vinculoprodutomaquina {
        ObjectId _id PK
        ObjectId configuracaoProduto FK
        ObjectId produto FK
        ObjectId maquina FK
        Number tempoCiclo
        Number tempoSetup
        Number producaoIdeal
        String observacoes
        ObjectId empresa FK
        Boolean ativo
        Date createdAt
        Date updatedAt
    }

    ordensproducao {
        ObjectId _id PK
        String numeroOrdem UK
        ObjectId produto FK
        ObjectId vinculoProdutoMaquina FK
        ObjectId maquina FK
        Number quantidade
        Number quantidadeProduzida
        Date dataFim
        String status "em-producao|finalizada|cancelada"
        String observacoes
        ObjectId empresa FK
        ObjectId criadoPor FK
        Date createdAt
        Date updatedAt
    }

    turnos {
        ObjectId _id PK
        String nome
        String horarioInicio "HH:MM"
        String horarioFim "HH:MM"
        Number duracaoHoras
        Array diasSemana "Number[]"
        ObjectId empresa FK
        String status "ativo|inativo"
        Date createdAt
        Date updatedAt
    }

    paradasmaquina {
        ObjectId _id PK
        String machineId
        String type
        String reason
        ObjectId motivoParada FK
        Number duration_seconds
        Number duration
        Boolean classified
        String operator
        ObjectId empresa FK
        Date timestamp
        String observacoes
        Date createdAt
        Date updatedAt
    }

    motivosparada {
        ObjectId _id PK
        String nome
        String classe "equipamento|processo|operacional|organizacional"
        String descricao
        ObjectId empresa FK
        Boolean ativo
        String cor
        Date createdAt
        Date updatedAt
    }

    descartes {
        ObjectId _id PK
        Date dataHora
        String maquina
        String categoria
        String motivo
        Number quantidade
        String severidade "baixa|media|alta|critica"
        ObjectId registradoPor FK
        String descricao
        ObjectId empresa FK
        Boolean ativo
        Date createdAt
        Date updatedAt
    }

    motivosdescarte {
        ObjectId _id PK
        String codigo UK
        String nome
        String classe
        String descricao
        String gravidade "baixa|media|alta|critica"
        ObjectId empresa FK
        Boolean ativo
        String cor
        Date createdAt
        Date updatedAt
    }

    itemlogistica {
        ObjectId _id PK
        String codigo
        String nome
        String categoria
        Number quantidadeAtual
        Number quantidadeMinima
        Number quantidadeMaxima
        String unidadeMedida
        String localizacao
        String fornecedor
        Number custoUnitario
        Number precoVenda
        Date dataUltimaCompra
        Date dataValidade
        String descricao
        String observacoes
        String status "ativo|inativo|esgotado|vencido"
        Boolean precisaAtencao
        String motivoAtencao
        ObjectId empresa FK
        Boolean ativo
        Date createdAt
        Date updatedAt
    }

    solicitacaocompra {
        ObjectId _id PK
        ObjectId itemLogistica FK
        Number quantidade
        String prioridade "baixa|media|alta|urgente"
        String motivo
        String status "pendente|aprovada|em_compra|recebida|cancelada"
        Date dataSolicitacao
        Date dataPrevisaoEntrega
        Date dataRecebimento
        ObjectId solicitante FK
        ObjectId empresa FK
        Date createdAt
        Date updatedAt
    }

    counters {
        String _id PK "formato: empresaId:ano"
        Number seq
        Date updatedAt
        Date createdAt
    }

    sensordata {
        ObjectId _id PK
        String machineId
        String timestamp
        Object networkMetrics
        String status
        String lastUpdate
    }
```

## Índices Principais

### Collection: users
- `email` (unique)
- `tipoUsuario`
- `status`
- `empresa.cnpj` (unique, partial)

### Collection: machines
- `machineId` (unique)
- `empresa`
- `linhaProducao`
- `status`

### Collection: produtos
- `codigoProduto`
- `empresa`
- `maquina`
- `categoria`
- `ativo`
- `empresa, createdAt` (composto)

### Collection: ordensproducao
- `numeroOrdem` (unique, sparse)
- `empresa`
- `maquina`
- `status`
- `createdAt`
- `empresa, maquina, status, createdAt` (composto)

### Collection: paradasmaquina
- `machineId`
- `empresa`
- `timestamp`
- `classified`
- `reason`
- `empresa, timestamp` (composto)

### Collection: descartes
- `dataHora`
- `maquina`
- `categoria`
- `severidade`
- `empresa`
- `ativo`
- `empresa, dataHora` (composto)

### Collection: vinculoprodutomaquina
- `produto, maquina, empresa` (unique, composto)
- `empresa`
- `ativo`
- `empresa, ativo` (composto)

### Collection: turnos
- `empresa, status`
- `nome`
- `empresa`

### Collection: itemlogistica
- `codigo, empresa` (composto)
- `empresa`
- `status`
- `precisaAtencao`
- `dataValidade`
- `empresa, status, precisaAtencao` (composto)

### Collection: sensordata
- `machineId`
- `timestamp`
- `machineId, timestamp` (composto)

## Observações Importantes

1. **Relacionamentos**:
   - Todos os modelos principais referenciam `users` através do campo `empresa` (ObjectId)
   - `EmpresaConfig` tem relação 1:1 com `User` através de `empresaId`
   - `Produto` → `Machine` é obrigatório
   - `ConfiguracaoProduto` → `Produto` é único (1:1)
   - `VinculoProdutoMaquina` combina Produto + Máquina + Empresa de forma única

2. **Coleções Adicionais**:
   - `sensordata`: Dados de sensores de rede das máquinas (não modelado com Mongoose)
   - `counters`: Utilizada para geração sequencial de números de ordem

3. **Campos de Timestamp**:
   - Todas as coleções principais têm `createdAt` e `updatedAt` (timestamps automáticos)
   - Alguns modelos têm campos de timestamp específicos (`dataHora`, `timestamp`, `ultimaAtualizacao`)

4. **Soft Delete**:
   - Várias coleções usam campo `ativo` para soft delete em vez de remoção física

5. **Enums**:
   - Status, tipos e enums são validados no nível do schema Mongoose
   - Valores permitidos são documentados nos comentários dos diagramas

