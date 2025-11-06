# Diagrama de Arquitetura
## Sistema de Monitoramento OEE (Overall Equipment Effectiveness)

```mermaid
flowchart TB
    subgraph "Cliente/Usuario"
        Browser["Navegador Web<br/>HTML/CSS/JavaScript"]
    end

    subgraph "Frontend"
        HTML["Páginas HTML<br/>index.html, dashboard, etc."]
        JS["JavaScript<br/>API calls, Charts, etc."]
        CSS["CSS<br/>Estilos e temas"]
    end

    subgraph "Backend - Node.js/Express"
        Server["Servidor Express<br/>server.js<br/>Port: 3000"]
        
        subgraph "Rotas API"
            AuthRoutes["Auth Routes<br/>/api/auth"]
            ConfigRoutes["Config Routes<br/>/api/configuracoes"]
            ProducaoRoutes["Producao Routes<br/>/api/producao"]
            MaquinaRoutes["Maquina Routes<br/>/api/paradas-maquina"]
            ProdutoRoutes["Produto Routes<br/>/api/produtos"]
            SensorRoutes["Sensor Routes<br/>/api/sensor-data"]
            LogisticaRoutes["Logistica Routes<br/>/api/logistica"]
        end
        
        subgraph "Middleware"
            AuthMiddleware["Auth Middleware<br/>JWT Token"]
            CORS["CORS"]
            Helmet["Helmet<br/>Security"]
        end
        
        subgraph "Modelos/Mongoose"
            Models["Models<br/>User, Machine, Produto, etc."]
        end
    end

    subgraph "Banco de Dados"
        MongoDB["MongoDB<br/>sistema_oee"]
        Collections["Collections<br/>users, machines, produtos, etc."]
    end

    subgraph "Infraestrutura de Rede"
        VPN["VPN<br/>Conexao Segura"]
    end

    subgraph "Maquinas Industriais"
        Machine1["Maquina 1<br/>MachineId: M1"]
        Machine2["Maquina 2<br/>MachineId: M2"]
        Machine3["Maquina 3<br/>MachineId: M3"]
        MachineN["Maquina N<br/>MachineId: MN"]
        
        subgraph "Sensores"
            Sensor1["Sensor M1<br/>RSSI, SNR, Latency"]
            Sensor2["Sensor M2<br/>RSSI, SNR, Latency"]
            Sensor3["Sensor M3<br/>RSSI, SNR, Latency"]
        end
    end

    subgraph "Servicos Externos"
        EmailService["Email Service<br/>Nodemailer"]
    end

    %% Conexões Frontend -> Backend
    Browser -->|HTTP/HTTPS| Server
    HTML --> Browser
    JS --> Browser
    CSS --> Browser

    %% Conexões Backend Internas
    Server --> AuthRoutes
    Server --> ConfigRoutes
    Server --> ProducaoRoutes
    Server --> MaquinaRoutes
    Server --> ProdutoRoutes
    Server --> SensorRoutes
    Server --> LogisticaRoutes
    
    AuthRoutes --> AuthMiddleware
    AuthMiddleware --> Models
    ConfigRoutes --> Models
    ProducaoRoutes --> Models
    MaquinaRoutes --> Models
    ProdutoRoutes --> Models
    SensorRoutes --> Models
    LogisticaRoutes --> Models
    
    Server --> CORS
    Server --> Helmet
    Server --> AuthMiddleware

    %% Conexões Backend -> Banco de Dados
    Models -->|Mongoose ODM| MongoDB
    MongoDB --> Collections

    %% Conexões VPN -> Máquinas
    Server -->|VPN| VPN
    VPN -->|Controle Remoto| Machine1
    VPN -->|Controle Remoto| Machine2
    VPN -->|Controle Remoto| Machine3
    VPN -->|Controle Remoto| MachineN
    
    %% Conexões Sensores -> Backend
    Sensor1 -->|Dados de Rede| SensorRoutes
    Sensor2 -->|Dados de Rede| SensorRoutes
    Sensor3 -->|Dados de Rede| SensorRoutes
    
    Machine1 --> Sensor1
    Machine2 --> Sensor2
    Machine3 --> Sensor3

    %% Conexões Serviços Externos
    Server --> EmailService

    %% Estilos
    classDef frontend fill:#e1f5ff,stroke:#01579b,stroke-width:2px,color:#000000
    classDef backend fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
    classDef database fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef network fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px,color:#000000
    classDef machine fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000000
    classDef service fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000000

    class Browser,HTML,JS,CSS frontend
    class Server,AuthRoutes,ConfigRoutes,ProducaoRoutes,MaquinaRoutes,ProdutoRoutes,SensorRoutes,LogisticaRoutes,AuthMiddleware,CORS,Helmet,Models backend
    class MongoDB,Collections database
    class VPN network
    class Machine1,Machine2,Machine3,MachineN,Sensor1,Sensor2,Sensor3 machine
    class EmailService service
```

## Descrição dos Componentes

### Frontend
- **Navegador Web**: Interface do usuário
- **Páginas HTML**: Telas do sistema (dashboard, cadastros, relatórios)
- **JavaScript**: Lógica do cliente, chamadas à API, gráficos
- **CSS**: Estilização e temas

### Backend
- **Servidor Express**: Servidor HTTP principal na porta 3000
- **Rotas API**: Endpoints RESTful para autenticação, configurações, produção, etc.
- **Middleware**: Autenticação JWT, CORS, segurança (Helmet)
- **Modelos**: Schemas Mongoose para validação e manipulação de dados

### Banco de Dados
- **MongoDB**: Banco de dados NoSQL
- **Collections**: Coleções de documentos (users, machines, produtos, etc.)

### Infraestrutura de Rede
- **VPN**: Conexão segura para acesso remoto às máquinas
  - Permite ligar/desligar máquinas remotamente
  - Permite editar configurações das máquinas
  - Conexão criptografada para segurança

### Máquinas Industriais
- **Máquinas Físicas**: Equipamentos de produção
- **Sensores**: Coletam dados de rede (RSSI, SNR, Latência, Throughput)
  - Enviam dados periodicamente para o backend
  - Monitoramento em tempo real

### Serviços Externos
- **Email Service**: Envio de notificações e emails (via Nodemailer)

