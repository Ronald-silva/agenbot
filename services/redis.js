// services/redis.js
const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

    this.client.on('error', (err) => {
      console.error('❌ Erro Redis:', err.message);
    });

    this.client.on('connect', () => {
      console.log('✅ Conexão Redis estabelecida');
    });

    this.client.on('close', () => {
      if (process.env.NODE_ENV === 'test') return; // Evita log durante testes
      console.log('⚠️ Conexão Redis fechada');
    });
  }

  async connect() {
    try {
      if (!this.client.status || this.client.status === 'end') {
        await this.client.connect();
      }
    } catch (err) {
      console.error('❌ Erro ao conectar ao Redis:', err.message);
    }
  }

  async close() {
    try {
      await this.client.quit();
      if (process.env.NODE_ENV !== 'test') { // Evita log durante testes
        console.log('✅ Conexão Redis fechada');
      }
    } catch (err) {
      console.error('❌ Erro ao fechar Redis:', err.message);
    }
  }

  async get(key) {
    try {
      await this.connect();
      const value = await this.client.get(key);
      return value;
    } catch (err) {
      console.error('❌ Erro ao ler do Redis:', err.message);
      return null;
    }
  }

  async set(key, value, options = {}) {
    try {
      await this.connect();
      
      const args = [key, value];
      
      if (options.ttl && Number.isInteger(options.ttl)) {
        args.push('EX', options.ttl);
      }
      
      await this.client.set(...args);
      return true;
    } catch (err) {
      console.error('❌ Erro ao salvar no Redis:', err.message);
      return false;
    }
  }

  async flushAll() {
    try {
      await this.connect();
      await this.client.flushall();
      return true;
    } catch (err) {
      console.error('❌ Erro ao limpar Redis:', err.message);
      return false;
    }
  }
}

module.exports = new RedisService();