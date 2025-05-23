// services/cache.js
const redisClient = require('./redis');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.memoryCacheTTL = new Map();
  }

  async get(key, options = { useMemory: true }) {
    try {
      // Verifica cache em memória primeiro
      if (options.useMemory) {
        const memValue = this.memoryCache.get(key);
        const ttl = this.memoryCacheTTL.get(key);
        
        if (memValue && (!ttl || ttl > Date.now())) {
          return memValue;
        }
      }

      // Se não encontrou em memória, busca no Redis
      const cached = await redisClient.get(`cache:${key}`);
      if (cached) {
        const value = JSON.parse(cached);
        
        // Atualiza cache em memória
        if (options.useMemory) {
          this.memoryCache.set(key, value);
          this.memoryCacheTTL.set(key, Date.now() + (options.ttl || 3600) * 1000);
        }
        
        return value;
      }

      return null;
    } catch (err) {
      console.error('❌ Erro ao buscar cache:', err);
      return null;
    }
  }

  async set(key, value, options = { ttl: 3600, useMemory: true }) {
    try {
      // Salva no Redis
      await redisClient.set(`cache:${key}`, JSON.stringify(value), options.ttl);

      // Salva em memória se necessário
      if (options.useMemory) {
        this.memoryCache.set(key, value);
        this.memoryCacheTTL.set(key, Date.now() + (options.ttl || 3600) * 1000);
      }

      return true;
    } catch (err) {
      console.error('❌ Erro ao salvar cache:', err);
      return false;
    }
  }

  async invalidate(key) {
    try {
      // Remove do Redis
      await redisClient.client.del(`cache:${key}`);
      
      // Remove da memória
      this.memoryCache.delete(key);
      this.memoryCacheTTL.delete(key);
      
      return true;
    } catch (err) {
      console.error('❌ Erro ao invalidar cache:', err);
      return false;
    }
  }

  async clear() {
    try {
      // Limpa Redis
      await redisClient.flushAll();
      
      // Limpa memória
      this.memoryCache.clear();
      this.memoryCacheTTL.clear();
      
      return true;
    } catch (err) {
      console.error('❌ Erro ao limpar cache:', err);
      return false;
    }
  }
}

module.exports = new CacheService();