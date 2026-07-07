# 📱 Pac-Man Retrô — Deploy na Google Play Store

Guia completo para empacotar e publicar o Pac-Man Retrô como um aplicativo Android nativo na Google Play Store utilizando **Trusted Web Activity (TWA)** com **Bubblewrap**.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Pré-requisitos](#pré-requisitos)
- [Passo 1: Preparar o Servidor](#passo-1-preparar-o-servidor)
- [Passo 2: Verificar o PWA](#passo-2-verificar-o-pwa)
- [Passo 3: Configurar Digital Asset Links](#passo-3-configurar-digital-asset-links)
- [Passo 4: Instalar e Configurar Bubblewrap](#passo-4-instalar-e-configurar-bubblewrap)
- [Passo 5: Gerar o App Bundle (AAB)](#passo-5-gerar-o-app-bundle-aab)
- [Passo 6: Configurar a Google Play Console](#passo-6-configurar-a-google-play-console)
- [Passo 7: Publicar](#passo-7-publicar)
- [Manutenção e Atualizações](#manutenção-e-atualizações)
- [Solução de Problemas](#solução-de-problemas)
- [Checklist Final](#checklist-final)

---

## Visão Geral

O Pac-Man Retrô v3.0 é uma **Progressive Web App (PWA)** com:
- `manifest.json` configurado com `display: standalone` e ícones 192×512
- `sw.js` (Service Worker) com estratégia Network First + cache de assets estáticos
- Backend Python/FastAPI opcional para scores online (não requerido para gameplay básico)

Para publicar na Play Store, utilizaremos o **Bubblewrap** (ferramenta oficial do Google) que cria um **Trusted Web Activity (TWA)** — um wrapper Android nativo que renderiza o PWA em tela cheia, sem barras de navegador.

```
┌─────────────────────────────────────────────┐
│            Google Play Store                │
│  ┌───────────────────────────────────────┐  │
│  │         TWA Android App               │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   WebView (Chrome)              │  │  │
│  │  │   ┌───────────────────────────┐ │  │  │
│  │  │   │    Pac-Man Retrô PWA      │ │  │  │
│  │  │   │    (index.html + game.js) │ │  │  │
│  │  │   └───────────────────────────┘ │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Pré-requisitos

### Contas e Ferramentas

- [ ] **Conta Google Play Developer** — taxa única de ~$25 USD (play.google.com/console)
- [ ] **Node.js 18+** — para executar Bubblewrap e PWABuilder CLI
- [ ] **Java JDK 17+** — necessário para o Android build tools
- [ ] **Android SDK** — command-line tools (ou Android Studio)
- [ ] **Servidor HTTPS público** — seu PWA precisa estar acessível via HTTPS
- [ ] **Domínio verificado** — para configurar Digital Asset Links

### Projeto

- [ ] PWA instalável (verificado via Lighthouse)
- [ ] `manifest.json` com ícones 192×192 e 512×512 ✅ *(já configurado)*
- [ ] `sw.js` registrado e funcional ✅ *(já configurado)*
- [ ] Servidor rodando em produção com HTTPS

---

## Passo 1: Preparar o Servidor

O PWA precisa estar acessível publicamente via **HTTPS**. Opções de hospedagem:

### Opção A — Docker em VPS (Recomendado)

```bash
# 1. Faça build da imagem
docker build -t pacman-retro .

# 2. Execute no servidor (substitua DOMAIN pelo seu domínio)
docker run -d \
  --name pacman-retro \
  -p 8000:8000 \
  -v /caminho/pacman-data:/opt/pacman-data \
  pacman-retro
```

Configure um **reverse proxy** (nginx/Caddy) com certificado SSL (Let's Encrypt):

```nginx
# /etc/nginx/sites-available/pacman.conf
server {
    listen 443 ssl;
    server_name pacman.seudominio.com;

    ssl_certificate /etc/letsencrypt/live/pacman.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pacman.seudominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Headers necessários para o Service Worker
        add_header Service-Worker-Allowed /;
    }

    # ⚠️ CRUCIAL: Digital Asset Links
    location /.well-known/assetlinks.json {
        alias /var/www/pacman/.well-known/assetlinks.json;
        add_header Content-Type application/json;
    }
}
```

### Opção B — Vercel / Netlify (Frontend estático)

Como o backend FastAPI é necessário apenas para scores online, você pode optar por:

1. **Hospedar o frontend (pasta `public/`) em um serviço estático** (Vercel, Netlify, GitHub Pages)
2. **Hospedar o backend separadamente** (Render, Railway, Fly.io)

No Vercel:
```bash
# vercel.json na raiz do projeto
{
  "builds": [
    { "src": "public/**", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/public/index.html" }
  ]
}
```

### Opção C — Google App Engine

```bash
# app.yaml
runtime: python313
entrypoint: uvicorn backend.main:app --host 0.0.0.0 --port $PORT

handlers:
- url: /api/.*
  script: auto
- url: /(.*\.(js|png|json|css))
  static_files: public/\1
  upload: public/.*
- url: /.*
  static_files: public/index.html
  upload: public/index.html
```

```bash
gcloud app deploy
```

---

## Passo 2: Verificar o PWA

Antes de empacotar, verifique se o PWA atende a todos os critérios de instalabilidade.

### Lighthouse Audit

No Chrome, abra DevTools → Lighthouse → Categoria **PWA**:

```
✅ Registra service worker
✅ Responde em HTTPS
✅ Manifest.json válido
✅ Ícones nos tamanhos corretos (192, 512)
✅ Configuração de start_url
✅ Redirect HTTP → HTTPS
✅ Configuração de tema e cor de fundo
✅ Exibe splash screen adequadamente
✅ Define display: standalone
✅ Define orientation: portrait
```

### Verificar Service Worker

```javascript
// No console do navegador:
navigator.serviceWorker.ready.then(reg => {
  console.log('Service Worker pronto:', reg.active.state);
});

// Verificar cache:
caches.keys().then(keys => console.log('Caches:', keys));
```

---

## Passo 3: Configurar Digital Asset Links

O **Digital Asset Links** é o mecanismo que prova ao Google que você é o proprietário tanto do site quanto do app Android. Sem ele, o TWA mostrará uma barra de endereço.

### 3.1 Obter a impressão digital do certificado

Após criar sua conta na Play Console, vá para **Setup → App Integrity** e copie o **SHA-256 fingerprint** do certificado de upload.

**Alternativa:** gere uma keystore localmente:

```bash
# Gerar keystore de upload
keytool -genkey -v -keystore pacman-upload.keystore \
  -alias pacman -keyalg RSA -keysize 2048 \
  -validity 10000

# Extrair SHA-256
keytool -list -v -keystore pacman-upload.keystore \
  -alias pacman | grep "SHA256"
```

### 3.2 Criar o assetlinks.json

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.prontacorp.pacmanretro",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

> Substitua `package_name` pelo package name que você definirá no Bubblewrap.
> Substitua `sha256_cert_fingerprints` pelo fingerprint obtido no passo anterior.

### 3.3 Publicar o assetlinks.json

Faça o arquivo acessível em:

```
https://pacman.seudominio.com/.well-known/assetlinks.json
```

**Verificação:**

```bash
curl -s https://pacman.seudominio.com/.well-known/assetlinks.json | python3 -m json.tool
```

A resposta deve ser o JSON acima. O Content-Type deve ser `application/json`.

---

## Passo 4: Instalar e Configurar Bubblewrap

### 4.1 Instalar Bubblewrap

```bash
# Instalação global via npm
npm install -g @bubblewrap/cli

# Verificar instalação
bubblewrap --version
```

### 4.2 Inicializar o projeto TWA

```bash
# Crie uma pasta para o projeto Android
mkdir pacman-android
cd pacman-android

# Inicialize com base no manifest do PWA
bubblewrap init --manifest=https://pacman.seudominio.com/manifest.json
```

O comando `init` fará perguntas interativas:

```
✔ Package name: com.prontacorp.pacmanretro
✔ App name: Pac-Man Retrô
✔ Launcher name: Pac-Man
✔ URL to load: https://pacman.seudominio.com/
✔ Orientation: portrait
✔ Display mode: standalone
✔ Signing key: (caminho para sua keystore)
✔ Signing key alias: pacman
```

**Arquivos gerados:**

```
pacman-android/
├── app/
│   ├── build.gradle
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/.../MainActivity.java
│   │   └── res/
│   │       ├── mipmap-*/ic_launcher.png
│   │       └── values/
│   │           ├── strings.xml
│   │           └── themes.xml
├── build/
├── gradle/
├── build.gradle
├── gradle.properties
├── settings.gradle
├── twa-manifest.json
└── signing.keystore
```

### 4.3 Configurar o AndroidManifest.xml

Verifique se o `AndroidManifest.xml` gerado inclui:

```xml
<activity android:name="com.google.androidbrowserhelper.trusted.TwaActivity"
    android:configChanges="orientation|screenSize|keyboardHidden"
    android:launchMode="singleTask"
    android:theme="@style/Theme.TwaSplash">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- Deep links para o PWA -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https"
              android:host="pacman.seudominio.com" />
    </intent-filter>
</activity>

<!-- Internet + suporte a notificações -->
<uses-permission android:name="android.permission.INTERNET" />
```

### 4.4 Configurar a Splash Screen (Opcional)

Edite `res/values/themes.xml`:

```xml
<style name="Theme.TwaSplash" parent="Theme.AppCompat.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <!-- Splash azul escuro como o tema do jogo -->
    <item name="colorPrimary">#0a0a0a</item>
    <item name="colorPrimaryDark">#0a0a0a</item>
</style>
```

Crie `res/drawable/splash.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashBg" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@mipmap/ic_launcher"
            android:scaleType="centerInside" />
    </item>
</layer-list>
```

---

## Passo 5: Gerar o App Bundle (AAB)

### 5.1 Build de Produção

```bash
cd pacman-android

# Limpar builds anteriores
bubblewrap clear

# Build do AAB
bubblewrap build

# O arquivo será gerado em:
# app/build/outputs/bundle/release/app-release.aab
```

### 5.2 Verificar o AAB

```bash
# Usar bundletool para inspecionar
bundletool dump manifest --bundle app/build/outputs/bundle/release/app-release.aab
```

### 5.3 Testar Localmente (Opcional)

```bash
# Instalar em dispositivo Android conectado
bubblewrap install

# OU usando bundletool com device conectado
bundletool build-apks \
  --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=pacman.apks \
  --ks=signing.keystore \
  --ks-pass=pass:SUA_SENHA

bundletool install-apks --apks=pacman.apks
```

---

## Passo 6: Configurar a Google Play Console

### 6.1 Criar App

1. Acesse [play.google.com/console](https://play.google.com/console)
2. Clique em **Create app**
3. Preencha:
   - **Name:** Pac-Man Retrô
   - **Default language:** Português (Brasil)
   - **App or game:** Game
   - **Free or paid:** Free
4. Defina o **Package name:** `com.prontacorp.pacmanretro` (mesmo do Bubblewrap)

### 6.2 Preencher Store Listing

| Campo | Conteúdo Sugerido |
|-------|--------------------|
| **Título** | Pac-Man Retrô |
| **Descrição curta** | O clássico Pac-Man repaginado com visual retrô e controles touch suaves |
| **Descrição completa** | Reviva a nostalgia do arcade clássico! Pac-Man Retrô traz a experiência original com gráficos pixelados, 4 fantasmas com IA progressiva, sistema de combos, power-ups e muito mais. • Labirinto 21x21 • 4 fantasmas com IAs distintas • Joystick virtual suave • Power-ups: Speed e Shield • Frutas especiais • Modo escuro com visual retrô • Ranking online • Sem anúncios • Sem compras internas |
| **Categoria** | Game → Arcade |
| **Tags** | Pac-Man, retro, arcade, classic, maze |
| **Ícone** | `public/icon-512.png` (redimensionar para 512×512) |
| **Feature Graphic** | Imagem 1024×500 com o logo do jogo |
| **Screenshots** | Mínimo 2 screenshots (telefone): gameplay, pause, settings |

### 6.3 Política de Privacidade

Crie uma política de privacidade simples (pode ser hospedada no GitHub Pages):

```markdown
# Política de Privacidade — Pac-Man Retrô

Última atualização: Julho de 2026

## Dados Coletados

- **Email:** utilizado exclusivamente como identificador único para registro de pontuações no ranking global
- **Pontuações:** scores são armazenados vinculados ao email informado

## Dados Não Coletados

- Senhas (o jogo utiliza login sem senha — passwordless)
- Localização geográfica
- Dados biométricos
- Conteúdo de dispositivos
- Dados de navegação

## Compartilhamento

Nenhum dado é compartilhado com terceiros.

## Armazenamento

Os dados são armazenados em servidor próprio com SQLite. 
O usuário pode solicitar exclusão dos seus dados entrando em contato.

## Contato

ProntaCorp S.A. — tecnologia@prontacorp.com
```

> URL pública: `https://pacman.seudominio.com/privacy.html`

### 6.4 App Integrity

Na Play Console, vá para **Setup → App Integrity**:

1. Faça upload do AAB gerado pelo Bubblewrap
2. A Google Play gerará as chaves de assinatura do app
3. Copie o **SHA-256 fingerprint** gerado
4. Atualize o `assetlinks.json` com este fingerprint
5. Refaça o deploy do `assetlinks.json` no servidor

### 6.5 Testes Internos (Obrigatório)

Para contas criadas após Novembro de 2023:

1. Vá para **Testing → Internal testing**
2. Crie uma nova versão:
   - Faça upload do AAB
   - Preencha o release notes (ex: "Versão inicial v3.0.0")
3. **Requisito:** Mínimo de **20 testers** por **14 dias consecutivos**
   - Adicione emails de testers (podem ser emails pessoais)
   - Compartilhe o link de opt-in

---

## Passo 7: Publicar

### 7.1 Promover para Produção

Após o período de testes internos:

1. **Testing → Closed testing** (opcional, mas recomendado)
2. **Testing → Production**
3. Crie nova release:
   - Faça upload do AAB final
   - Preencha release notes
   - Revise e inicie o rollout

### 7.2 Rollout

- Comece com **rollout gradual** (20% dos usuários)
- Monitore crash reports por 24-48h
- Aumente gradualmente para 100%
- O app fica disponível na Play Store em algumas horas

---

## Manutenção e Atualizações

### Atualizar o PWA

```bash
# 1. Faça as alterações no código
# 2. Faça deploy no servidor
git pull
docker compose up -d --build

# 3. Incremente a versão no manifest.json
# 4. Atualize o sw.js para forçar novo cache
```

### Atualizar o App Android

```bash
# 1. Incremente versionCode e versionName no twa-manifest.json
# 2. Rebuild
bubblewrap build

# 3. Faça upload do novo AAB na Play Console
# 4. Submeta para revisão
```

> ℹ️ **Importante:** O Service Worker cacheia assets estáticos. Após atualizar o frontend, incremente a versão no `sw.js` para forçar o download dos novos assets nos dispositivos dos usuários.

---

## Solução de Problemas

### ❌ App mostra barra de endereço

**Causa:** Digital Asset Links não configurado corretamente.

**Solução:**
1. Verifique se `assetlinks.json` está acessível em `/.well-known/assetlinks.json`
2. Verifique se o `sha256_cert_fingerprints` corresponde exatamente ao da Play Console
3. Verifique se o `package_name` corresponde ao package name no Bubblewrap
4. Teste com a ferramenta [Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator)

### ❌ App não carrega (tela branca)

**Causas possíveis:**
- HTTPS não configurado corretamente
- Service Worker com erro
- CORS bloqueando requisições

**Solução:**
```bash
# Verificar HTTPS
curl -vI https://pacman.seudominio.com/

# Verificar Service Worker no Chrome DevTools
Application → Service Workers → Check "Update on reload"
```

### ❌ Erro de assinatura

**Causa:** Keystore perdida ou fingerprint incorreto.

**Solução:**
- Se perdeu a keystore de upload, solicite redefinição na Play Console
- Play App Signing permite reset da chave de upload mediante verificação de identidade

### ❌ AAB muito grande

**Otimizações:**
- Remova arquivos desnecessários do TWA
- Compacte ícones (PNGQuant, WebP)
- Considere gerar APK via bundletool apenas com a densidade de tela necessária

---

## Checklist Final

### Pré-deploy

- [ ] PWA auditado com Lighthouse (100% PWA)
- [ ] Service Worker registrado e funcional
- [ ] `manifest.json` com ícones 192×512
- [ ] Servidor HTTPS configurado
- [ ] `assetlinks.json` publicado em `/.well-known/`
- [ ] Bubblewrap inicializado com package name correto
- [ ] AAB gerado sem erros
- [ ] AAB testado localmente em dispositivo Android

### Play Console

- [ ] Conta Google Play Developer ativa
- [ ] Store listing completo (descrição, screenshots, feature graphic)
- [ ] Política de privacidade publicada
- [ ] App Integrity configurado com SHA-256 correto
- [ ] Release notes preenchidas
- [ ] Categorização correta (Game → Arcade)
- [ ] Conteúdo classificado (IARC questionnaire)

### Pós-deploy

- [ ] Teste interno com 20+ testers por 14+ dias
- [ ] Closed testing opcional
- [ ] Produção com rollout gradual
- [ ] Monitoramento de crashes (Google Play Console)
- [ ] Feedback dos primeiros usuários

---

## Variáveis de Ambiente do Servidor

### Lista Completa

| Variável            | Padrão     | Obrigatório | Descrição                                                     |
|---------------------|------------|-------------|---------------------------------------------------------------|
| `PORT`              | `8000`     | Não         | Porta do servidor                                             |
| `DB_PATH`           | `./data/pacman.db` | Não | Caminho do arquivo SQLite                                     |
| `ALLOWED_ORIGINS`   | `*`        | Não         | Origens CORS permitidas (separadas por vírgula)               |
| `RESET_SCORE_TOKEN` | —          | **Sim** 🔥  | Token secreto para o endpoint `/api/reset-score` (admin)      |

---

### 🔒 CORS — `ALLOWED_ORIGINS`

Controla quais domínios podem acessar a API via CORS. Como o frontend e o backend são servidos juntos (FastAPI serve os arquivos estáticos), o padrão `*` funciona para a maioria dos casos.

**Em produção, recomenda-se restringir:**
```bash
# Apenas seu domínio (mais seguro)
ALLOWED_ORIGINS=https://pacman.seudominio.com

# Múltiplos domínios (separados por vírgula, sem espaços)
ALLOWED_ORIGINS=https://pacman.seudominio.com,https://preview.seudominio.com

# Apenas mesma origem (sem CORS para origens externas)
ALLOWED_ORIGINS=
```

**Configuração no Docker Compose (via `.env`):**
```bash
# .env na raiz do projeto
ALLOWED_ORIGINS=https://pacman.seudominio.com
```

> ⚠️ Se você estiver usando hospedagem separada (frontend no Vercel + backend no Render), precisará definir `ALLOWED_ORIGINS` com a URL do frontend para que as requisições funcionem.

---

### 🔑 Reset do Ranking — `RESET_SCORE_TOKEN`

Token secreto para o endpoint administrativo `/api/reset-score`, que **zera o ranking e desloga todos os jogadores ativos**.

#### ⚠️ OBRIGATÓRIO: Definir antes do primeiro deploy!

```bash
# Gere um token seguro (256 bits)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Exemplo: SmB5kvfBkh4yxZhTwkyF1k1w2A1BzaA3YNEi-Yky3hw
```

**Configuração via `.env` (recomendado para Docker Compose):**
```bash
# .env na raiz do projeto
RESET_SCORE_TOKEN=SEU-TOKEN-SEGURO-AQUI
```

**Configuração local (sem Docker):**
```bash
export RESET_SCORE_TOKEN=SEU-TOKEN-SEGURO-AQUI
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

> ⚠️ **NUNCA** coloque o token real no `docker-compose.yml` (que é versionado). Sempre use o arquivo `.env` (protegido pelo `.gitignore`).

#### Como Usar

```bash
curl -X POST https://pacman.seudominio.com/api/reset-score \
  -H "Content-Type: application/json" \
  -d '{ "token": "SEU-TOKEN-SEGURO-AQUI" }'
```

**Respostas:**

| Situação               | Status  | Resposta                                                     |
|------------------------|---------|--------------------------------------------------------------|
| ✅ Sucesso             | 200     | `{"ok":true, "message":"Ranking zerado..."}`              |
| ❌ Token não configurado | 200   | `{"ok":false, "message":"...token não configurado..."}`    |
| ❌ Token inválido      | 403     | `{"detail":"Token de reset inválido"}`                     |
| ❌ Token vazio         | 422     | `{"detail":..."String should have at least 1 character"...}` |
| ❌ Campo ausente       | 422     | `{"detail":..."Field required"...}`                        |

---

## Comandos Rápidos

```bash
# Verificar assetlinks
curl -s https://pacman.seudominio.com/.well-known/assetlinks.json

# Build do AAB
cd pacman-android && bubblewrap build

# Testar localmente
bubblewrap install

# Verificar manifesto do AAB
bundletool dump manifest --bundle app/build/outputs/bundle/release/app-release.aab

# Extrair APK do AAB para teste
bundletool build-apks --bundle=app-release.aab --output=pacman.apks --ks=signing.keystore
bundletool install-apks --apks=pacman.apks

# Resetar ranking (admin)
curl -X POST https://pacman.seudominio.com/api/reset-score \
  -H "Content-Type: application/json" \
  -d '{ "token": "seu-token-aqui" }'
```

---

*ProntaCorp S.A. — tecnologia com propósito humano*
