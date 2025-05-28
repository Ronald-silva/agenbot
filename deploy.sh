#!/bin/bash
# deploy.sh - Script para deploy do bot

echo "🚀 Iniciando deploy do Felipe Bot..."

# Variáveis
APP_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="$APP_DIR/backups"

# Cria diretório de backups se não existir
mkdir -p "$BACKUP_DIR"

# Backup dos arquivos importantes
echo "📦 Criando backup de segurança..."
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="temp" \
    --exclude="backups" \
    -C "$APP_DIR" .

# Instalando/atualizando dependências
echo "📚 Atualizando dependências..."
cd "$APP_DIR"
npm ci --production

# Garantindo diretórios necessários
echo "📁 Verificando diretórios..."
mkdir -p "$APP_DIR/temp"

# Permissões
chmod +x "$APP_DIR/scripts/"*.js

# Reiniciando o serviço (assumindo PM2)
if command -v pm2 &> /dev/null; then
    echo "🔄 Reiniciando o serviço via PM2..."
    pm2 restart felipe-bot || pm2 start server.js --name felipe-bot
else
    echo "⚠️ PM2 não encontrado. Use 'npm start' para iniciar o servidor manualmente."
fi

echo "✅ Deploy concluído com sucesso!"
