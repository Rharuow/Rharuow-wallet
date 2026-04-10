#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute este script como root: sudo bash infra/aws/ec2/bootstrap-ubuntu-docker.sh"
  exit 1
fi

TARGET_USER="${SUDO_USER:-ubuntu}"
APP_ROOT="/opt/rharuowallet"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg git unzip jq awscli

install -m 0755 -d /etc/apt/keyrings

if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

. /etc/os-release
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

if id -nG "${TARGET_USER}" | grep -qw docker; then
  true
else
  usermod -aG docker "${TARGET_USER}"
fi

install -d -m 0755 -o "${TARGET_USER}" -g "${TARGET_USER}" "${APP_ROOT}"

cat <<EOF

Bootstrap concluido.

Proximos passos:
1. Reabra a sessao do usuario ${TARGET_USER} para aplicar o grupo docker.
2. Clone o repositorio em ${APP_ROOT}.
3. Copie infra/aws/ec2/.env.api.example para infra/aws/ec2/.env.api e preencha as variaveis.
4. Rode: docker compose -f infra/aws/ec2/docker-compose.api.yml up --build -d
5. Teste localmente na EC2: curl http://127.0.0.1:8080/health

Pacotes instalados:
- Docker Engine
- Docker Compose plugin
- Git
- AWS CLI
- jq

EOF