const mongoose = require('mongoose');
// Carregar variáveis de ambiente - Railway usa variáveis de ambiente diretamente
// Em desenvolvimento local, tenta carregar do config.env
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: './config.env' });
} else {
    require('dotenv').config();
}

class DatabaseConnection {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    async connect() {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema_oee';
            
            console.log('🔄 Tentando conectar ao MongoDB...');
            console.log(`📍 URI: ${mongoUri}`);

            this.connection = await mongoose.connect(mongoUri, {
                maxPoolSize: 10, // Manter até 10 conexões no pool
                serverSelectionTimeoutMS: 5000, // Timeout após 5 segundos
                socketTimeoutMS: 45000, // Fechar sockets após 45 segundos de inatividade
                dbName: process.env.MONGODB_DB_NAME || 'sistema_oee' // Forçar nome do banco
            });

            this.isConnected = true;
            
            console.log('✅ Conectado ao MongoDB com sucesso!');
            console.log(`📊 Database: ${this.connection.connection.db.databaseName}`);
            console.log(`🔗 Host: ${this.connection.connection.host}`);
            console.log(`🔌 Port: ${this.connection.connection.port}`);

            // Event listeners para monitorar a conexão
            mongoose.connection.on('error', (error) => {
                console.error('❌ Erro na conexão MongoDB:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB desconectado');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconectado');
                this.isConnected = true;
            });

            return this.connection;

        } catch (error) {
            console.error('❌ Erro ao conectar ao MongoDB:', error.message);
            this.isConnected = false;
            
            // Tentar reconectar após 5 segundos
            setTimeout(() => {
                console.log('🔄 Tentando reconectar ao MongoDB...');
                this.connect();
            }, 5000);
            
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.isConnected && this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                console.log('🔌 Desconectado do MongoDB');
            }
        } catch (error) {
            console.error('❌ Erro ao desconectar do MongoDB:', error.message);
        }
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    // Método para verificar se a conexão está saudável
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: 'Não conectado ao MongoDB' };
            }

            // Ping no banco para verificar se está respondendo
            await mongoose.connection.db.admin().ping();
            
            return { 
                status: 'healthy', 
                message: 'Conexão MongoDB saudável',
                database: mongoose.connection.db.databaseName,
                collections: await mongoose.connection.db.listCollections().toArray()
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                message: 'Erro na conexão MongoDB: ' + error.message 
            };
        }
    }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;
