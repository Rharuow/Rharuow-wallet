# GitHub Actions Self-Hosted Runner Setup

Guia passo a passo para instalar e registrar os runners de CI/CD.

## ⚙️ Informações do Repositório

- **Repositório**: rharuow/rharuowallet
- **Runners necessários**:
  - `prod-migrations`: executa migrações do Prisma (sua máquina)
  - `ec2-deploy`: faz deploy na EC2 (na própria EC2)

---

## 1️⃣ Instalar Runner `prod-migrations` (Sua Máquina)

### Pré-requisitos

```bash
# Verificar Node.js 22+
node --version  # deve retornar v22.x.x ou maior

# Verificar Git
git --version
```

Se faltar Node.js, instale:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@22
```

### Passos de Instalação

**Passo 1: Acessar GitHub repo → Settings → Actions → Runners**

1. Acesse: https://github.com/rharuow/rharuowallet/settings/actions/runners
2. Clique: "New self-hosted runner"
3. Selecione: Linux (ou seu SO)
4. Selecione: x64 (ou ARM se aplicável)

**Passo 2: Criar diretório e baixar runner**

```bash
# Criar diretório para o runner
mkdir -p ~/github-runners/prod-migrations
cd ~/github-runners/prod-migrations

# GitHub fornecerá um URL. Use:
# (Substitua pelo URL/token exato que GitHub mostrar na interface)
curl -o actions-runner-linux-x64-2.321.0.tar.gz \
  -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz

# Extrair
tar xzf actions-runner-linux-x64-2.321.0.tar.gz
```

**Passo 3: Registrar runner com label**

```bash
# Execute o script de configuração
./config.sh --url https://github.com/rharuow/rharuowallet \
  --token AAAAAAAAAAAAAAAAAAAAAA \
  --name prod-migrations-$(hostname) \
  --labels self-hosted,linux,x64,prod-migrations \
  --work _work \
  --replace
```

⚠️ **Substituir:**
- `AAAAAAAAAAAAAAAAAAAAAA`: token fornecido pelo GitHub na interface
- Responder às perguntas interativas (padrões são OK)

**Passo 4: Verificar registro bem-sucedido**

```bash
# Deve retornar informações do runner
./run.sh

# Output esperado:
# Runner registration complete
# Current runner version: 2.321.0
# Listening for Jobs
```

**Passo 5: Instalar como serviço (para rodar em background)**

```bash
# Parar o runner (Ctrl+C no terminal anterior)

# Instalar como serviço do systemd
sudo ./svc.sh install

# Iniciar serviço
sudo ./svc.sh start

# Verificar status
sudo ./svc.sh status
# Esperado: "active (running)"

# (Opcional) ver logs em tempo real
sudo journalctl -u actions.runner.rharuow-rharuowallet.prod-migrations-$(hostname).service -f
```

---

## 2️⃣ Instalar Runner `ec2-deploy` (Na EC2)

### Pré-requisitos na EC2

```bash
# SSH na EC2
ssh -i /caminho/para/sua/key.pem ec2-user@seu-ec2-ip

# Ou use conexão SSH configurada
ssh seu-alias-ec2

# Após conectado, verificar pré-requisitos:
node --version        # Node 22+
git --version         # Git
docker --version      # Docker
docker-compose --version  # Docker Compose
```

Se faltar alguma coisa na EC2:

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Node 22 (se não tiver)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Docker e Docker Compose já devem estar instalados (verifice com docker --version)
# Se faltar:
sudo apt install -y docker.io docker-compose

# Adicionar ubuntu user ao grupo docker
sudo usermod -aG docker ubuntu

# Aplicar permissões (logout/login necessário ou):
newgrp docker
```

### Passos de Instalação

**Passo 1: Criar diretório no /opt**

```bash
# SSH na EC2
cd /opt

# Criar diretório para runner
sudo mkdir -p github-runners/ec2-deploy
cd /opt/github-runners/ec2-deploy

# Dar permissão ao seu usuário
sudo chown -R ubuntu:ubuntu /opt/github-runners
```

**Passo 2: Baixar runner**

```bash
cd /opt/github-runners/ec2-deploy

# Baixar (mesmo download da máquina de migrações)
curl -o actions-runner-linux-x64-2.321.0.tar.gz \
  -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz

# Extrair
tar xzf actions-runner-linux-x64-2.321.0.tar.gz
```

**Passo 3: Registrar runner com label**

```bash
# Ir na interface GitHub Settings → Actions → Runners (nova aba)
# Clique "New self-hosted runner" novamente
# Copie o token fornecido

# Execute na EC2:
./config.sh --url https://github.com/rharuow/rharuowallet \
  --token BBBBBBBBBBBBBBBBBBBBBBB \
  --name ec2-deploy \
  --labels self-hosted,linux,x64,ec2-deploy \
  --work _work \
  --replace
```

⚠️ **Substituir:**
- `BBBBBBBBBBBBBBBBBBBBBBB`: novo token GitHub (é diferente do anterior)

**Passo 4: Testar runner**

```bash
# Executar em foreground para validar
./run.sh

# Esperado:
# Runner registration complete
# Current runner version: 2.321.0
# Listening for Jobs
```

**Passo 5: Instalar como serviço systemd na EC2**

```bash
# Parar runner (Ctrl+C)

# Instalar serviço
sudo ./svc.sh install

# Iniciar
sudo ./svc.sh start

# Verificar
sudo ./svc.sh status
# Esperado: "active (running)"

# Logs (opcional)
sudo journalctl -u actions.runner.rharuow-rharuowallet.ec2-deploy.service -f
```

---

## ✅ Validação: Verificar que Ambos Runners Estão Online

### No GitHub (Web UI)

1. Acesse: https://github.com/rharuow/rharuowallet/settings/actions/runners
2. Procure pelos runners:
   - `prod-migrations-[seu-hostname]`: deve estar **online** (ponto verde) com labels `self-hosted, linux, x64, prod-migrations`
   - `ec2-deploy`: deve estar **online** (ponto verde) com labels `self-hosted, linux, x64, ec2-deploy`

### Via Terminal

**Verificar runner da máquina local:**
```bash
# Na sua máquina
cd ~/github-runners/prod-migrations
sudo ./svc.sh status
# Esperado: "active (running)" e no GitHub interface: ponto verde
```

**Verificar runner da EC2:**
```bash
# SSH na EC2
cd /opt/github-runners/ec2-deploy
sudo ./svc.sh status
# Esperado: "active (running)" e no GitHub interface: ponto verde
```

---

## 🚀 Testar Workflows

### Testar migração (prod-migrations)

1. Acesse: https://github.com/rharuow/rharuowallet/actions/workflows/api-migrate.yml
2. Clique: "Run workflow" → dropdown "main" → "Run workflow"
3. Aguarde job executar no runner `prod-migrations`
4. Verifique logs para garantir que Prisma migrou corretamente

### Testar deploy (ec2-deploy)

1. Acesse: https://github.com/rharuow/rharuowallet/actions/workflows/api-release.yml
2. Clique: "Run workflow" → dropdown "main" → "Run workflow"
3. Aguarde job executar no runner `ec2-deploy`
4. Verifique logs para garantir que Docker Compose subiu corretamente
5. Validar manualmente: `curl https://15-228-21-109.sslip.io/health`

---

## 🛠️ Troubleshooting

### Runner não aparece como online

```bash
# Verificar serviço (sua máquina)
sudo systemctl status actions.runner.rharuow-rharuowallet.prod-migrations-*.service

# Verificar serviço (EC2)
sudo systemctl status actions.runner.rharuow-rharuowallet.ec2-deploy.service

# Logs detalhados
sudo journalctl -u actions.runner* -n 50 --no-pager
```

### Job falha com "Runner not found"

- Verificar labels exatas: deve incluir `prod-migrations` ou `ec2-deploy`
- Verificar que runner está online (ponto verde) no GitHub UI
- Verificar que job tem `runs-on` com labels corretos no YAML

### Migração falha com erro de conexão

- Verificar `DIRECT_URL` secret no GitHub (deve ser a URL direta de conexão)
- Testar conexão manual na máquina:
  ```bash
  psql "postgresql://postgres:PASSWORD@db.mgjxlmplolvlwacieixc.supabase.co:5432/postgres"
  ```

### Deploy falha na EC2

- Verificar Docker está rodando: `sudo systemctl status docker`
- Verificar permissões: `ls -la /opt/rharuowallet` (ubuntu deve ter acesso)
- Verificar arquivo `.env.api` existe: `cat /opt/rharuowallet/infra/aws/ec2/.env.api`

---

## 📝 Referência Rápida

| Tarefa | Comando |
|--------|---------|
| Ver status runner (local) | `sudo systemctl status actions.runner.rharuow-rharuowallet.prod-migrations-*.service` |
| Ver status runner (EC2) | `sudo systemctl status actions.runner.rharuow-rharuowallet.ec2-deploy.service` |
| Parar runner (lado direito) | `sudo ./svc.sh stop` |
| Iniciar runner | `sudo ./svc.sh start` |
| Reiniciar runner | `sudo ./svc.sh restart` |
| Ver logs (local/EC2) | `sudo journalctl -u actions.runner.rharuow* -f` |
| Remover runner | `./config.sh remove --token XXXXXX` |

---

## ⚡ Próximos Passos Após Sucesso

1. ✅ Ambos runners online no GitHub UI
2. ✅ Testar workflows com `workflow_dispatch`
3. ✅ Fazer commit/push pequeno na `main` para disparar workflows
4. ✅ Validar que migração + deploy executam em sequência
5. ✅ Monitorar logs da EC2 para garantir saúde do container

