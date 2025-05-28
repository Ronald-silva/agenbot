#!/bin/bash
# restart.sh - Script para reiniciar o serviço do bot

echo "🔄 Reiniciando o serviço do Felipe Bot..."

# Variáveis
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Garantir que a pasta temp existe
mkdir -p "$APP_DIR/temp"
mkdir -p "$APP_DIR/logs"

# Limpar arquivos temporários antigos
echo "🧹 Limpando arquivos temporários..."
find "$APP_DIR/temp" -type f -mtime +1 -delete

# Verificar se o serviço está rodando com PM2
if command -v pm2 &> /dev/null; then
    echo "🔍 Verificando status com PM2..."
    pm2 describe felipe-bot > /dev/null
    
    if [ $? -eq 0 ]; then
        # O serviço existe, reinicia
        echo "🔄 Reiniciando serviço existente..."
        pm2 restart felipe-bot
    else
        # O serviço não existe, inicia
        echo "🚀 Iniciando novo serviço..."
        pm2 start server.js --name felipe-bot
    fi
    
    echo "📊 Status atual do serviço:"
    pm2 status felipe-bot
    
    echo "📝 Mostrando últimas linhas do log:"
    pm2 logs felipe-bot --lines 10
else
    # PM2 não está instalado, usa Node diretamente
    echo "⚠️ PM2 não encontrado. Iniciando com Node..."
    
    # Mata qualquer processo antigo rodando na porta 8080
    pid=$(lsof -t -i:8080)
    if [ -n "$pid" ]; then
        echo "🛑 Finalizando processo anterior (PID: $pid)..."
        kill -9 $pid
    fi
    
    echo "🚀 Iniciando servidor..."
    node server.js &
    
    echo "✅ Servidor iniciado!"
fi
