# Felipe Relógios - Bot de WhatsApp

Bot para WhatsApp da loja Felipe Relógios, localizada no Beco da Poeira em Fortaleza.

## Funcionalidades

- ✅ **Catálogo de Produtos**: Informações detalhadas de 9 modelos de relógios
- ✅ **Informações da Loja**: Endereço, horário e políticas de pagamento
- ✅ **Reserva de Produtos**: Fluxo estruturado para reserva de produtos
- ✅ **Sugestões de Produtos Similares**: Recomendações baseadas em categoria
- ✅ **Processamento de Áudio**: 
  - Recebimento e transcrição de mensagens de voz 
  - Respostas em formato de áudio

## Tecnologias

- Node.js + Express
- OpenAI API (GPT-4o, Whisper, TTS-1)
- Z-API (API para WhatsApp)
- Retrieval Augmented Generation (RAG)

## Configuração

1. Clone o repositório
2. Instale as dependências:
   ```
   npm install
   ```
3. Configure as variáveis de ambiente no arquivo `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ZAPI_INSTANCE_ID=...
   ZAPI_INSTANCE_TOKEN=...
   ZAPI_CLIENT_TOKEN=...
   PORT=3000
   ```

## Funcionamento

### Fluxo de Processamento

```
Mensagem do Cliente → Webhook → Processamento (Texto ou Áudio) → Resposta (Texto + Áudio)
```

1. **Recebimento de Mensagem**:
   - Z-API envia webhook quando uma nova mensagem é recebida
   - O sistema identifica se é texto ou áudio

2. **Processamento de Áudio**:
   - Áudios são transcritos usando OpenAI Whisper

3. **Processamento de Contexto**:
   - Sistema RAG extrai contexto relevante da base de conhecimento

4. **Geração de Resposta**:
   - GPT-4o gera resposta usando o contexto, catálogo e regras da loja

5. **Resposta em Áudio**:
   - A resposta é convertida em áudio usando TTS-1 da OpenAI
   - Cliente recebe texto e áudio simultaneamente

### Processamento de Voz

O sistema implementa:

- **Speech-to-Text**: Transcrição de áudio usando Whisper
- **Text-to-Speech**: Síntese de voz usando TTS-1
- **Segmentação de Texto**: Divide mensagens longas para garantir processamento de áudio adequado

## Testes

### Testar TTS (Síntese de Voz)

Execute o script de teste TTS:
```
node test/tts_test.js
```

Este script gera vários arquivos de áudio para testar:
- Mensagens curtas, médias e longas
- Diferentes vozes
- Segmentação de texto longo

### Testar Webhook

Execute o script de teste do webhook:
```
node test/webhook_test.js
```

Este script simula:
- Processamento de mensagens de texto
- Fluxo de confirmação de reserva
- (Simulação de mensagens de áudio requer URL de áudio real)

## Estrutura do Projeto

```
├── controllers/
│   └── webhook.js      # Controlador principal (processamento de mensagens)
├── data/
│   ├── catalog.json    # Catálogo de produtos
│   ├── states.json     # Estados da conversa (histórico)
│   └── store_info.json # Informações da loja
├── services/
│   ├── openai.js       # Integração com OpenAI (RAG, GPT)
│   ├── tts.js          # Serviço de Text-to-Speech
│   └── zapi.js         # Integração com Z-API (WhatsApp)
├── test/
│   ├── bot.test.js     # Testes unitários
│   ├── tts_test.js     # Testes de síntese de voz
│   └── webhook_test.js # Testes do webhook
├── contexts.json       # Base de conhecimento para RAG
├── generate_embeddings.js  # Gera embeddings para o RAG
├── package.json
├── Procfile            # Configuração para deploy
└── server.js           # Arquivo principal do servidor
```

## Manutenção

### Adicionar Novos Produtos

Edite o arquivo `data/catalog.json` e atualize o prompt no `controllers/webhook.js`.

### Atualizar Informações da Loja

Edite o arquivo `data/store_info.json` e atualize o prompt no controlador.

### Regenerar Embeddings

Após alterar a base de conhecimento, regenere os embeddings:
```
node generate_embeddings.js
```
