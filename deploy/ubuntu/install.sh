#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-minecraft-ai-bot}"
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
APP_USER="${APP_USER:-minecraftbot}"
SERVICE_NAME="${SERVICE_NAME:-minecraft-ai-bot}"
NODE_MAJOR="${NODE_MAJOR:-24}"
NODE_INSTALL_DIR="${NODE_INSTALL_DIR:-/opt/node-v${NODE_MAJOR}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVICE_TEMPLATE="${PROJECT_ROOT}/deploy/ubuntu/systemd/minecraft-ai-bot.service"
SERVICE_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

log() {
  echo "[install] $*"
}

warn() {
  echo "[install][warn] $*" >&2
}

fail() {
  echo "[install][error] $*" >&2
  exit 1
}

rerun_with_sudo_if_needed() {
  if [[ "${EUID}" -eq 0 ]]; then
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    fail "sudo is required to install packages and create the systemd service"
  fi

  log "Requesting sudo to continue installation"
  exec sudo -E bash "$0" "$@"
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    fail "Cannot detect operating system"
  fi

  # shellcheck disable=SC1091
  . /etc/os-release

  if [[ "${ID:-}" != "ubuntu" ]]; then
    fail "This install script is intended for Ubuntu"
  fi

  if [[ "${VERSION_ID:-}" != "24.04" ]]; then
    warn "Expected Ubuntu 24.04, detected Ubuntu ${VERSION_ID:-unknown}. Continuing anyway."
  fi
}

install_packages() {
  log "Installing system packages"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    git \
    ca-certificates \
    build-essential \
    xz-utils \
    rsync
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    current_version="$(node -v || true)"
    if [[ "${current_version}" == v${NODE_MAJOR}.* ]]; then
      log "Node.js ${current_version} is already installed"
      return
    fi
  fi

  log "Installing Node.js ${NODE_MAJOR} from the official distribution"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' RETURN

  pushd "${tmp_dir}" >/dev/null

  local shasums
  shasums="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt")"

  local tarball
  tarball="$(awk '/linux-x64\.tar\.xz$/ { print $2; exit }' <<<"${shasums}")"
  [[ -n "${tarball}" ]] || fail "Could not determine the Node.js tarball name"

  curl -fsSLO "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/${tarball}"
  grep " ${tarball}$" <<<"${shasums}" | sha256sum -c -

  rm -rf "${NODE_INSTALL_DIR}"
  tar -xJf "${tarball}"
  mv "${tarball%.tar.xz}" "${NODE_INSTALL_DIR}"

  ln -sf "${NODE_INSTALL_DIR}/bin/node" /usr/local/bin/node
  ln -sf "${NODE_INSTALL_DIR}/bin/npm" /usr/local/bin/npm
  ln -sf "${NODE_INSTALL_DIR}/bin/npx" /usr/local/bin/npx

  popd >/dev/null
  rm -rf "${tmp_dir}"
  trap - RETURN

  log "Installed $(node -v)"
}

ensure_app_user() {
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    log "User ${APP_USER} already exists"
    return
  fi

  log "Creating system user ${APP_USER}"
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /usr/sbin/nologin "${APP_USER}"
}

sync_project() {
  mkdir -p "${APP_DIR}"

  if [[ "${PROJECT_ROOT}" != "${APP_DIR}" ]]; then
    log "Syncing project files to ${APP_DIR}"
    rsync -a --delete \
      --exclude '.git/' \
      --exclude 'node_modules/' \
      --exclude 'logs/' \
      --exclude 'data/' \
      --exclude '.env' \
      "${PROJECT_ROOT}/" "${APP_DIR}/"
  else
    log "Project already located at ${APP_DIR}, skipping file sync"
  fi

  mkdir -p "${APP_DIR}/logs" "${APP_DIR}/data"

  if [[ -f "${APP_DIR}/.env" ]]; then
    log "Keeping existing ${APP_DIR}/.env"
  elif [[ -f "${PROJECT_ROOT}/.env" && "${PROJECT_ROOT}" != "${APP_DIR}" ]]; then
    log "Copying .env from source project"
    install -m 600 "${PROJECT_ROOT}/.env" "${APP_DIR}/.env"
  elif [[ -f "${APP_DIR}/.env.example" ]]; then
    warn "No .env found. Copying .env.example to ${APP_DIR}/.env"
    install -m 600 "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  else
    fail "Neither .env nor .env.example were found"
  fi

  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
}

run_as_app_user() {
  local command="$1"
  runuser -u "${APP_USER}" -- bash -lc "${command}"
}

install_dependencies() {
  log "Installing npm dependencies"
  run_as_app_user "cd '${APP_DIR}' && npm install --omit=dev"
}

run_checks() {
  log "Running project checks"
  run_as_app_user "cd '${APP_DIR}' && npm run check"
}

install_systemd_service() {
  [[ -f "${SERVICE_TEMPLATE}" ]] || fail "Missing service template at ${SERVICE_TEMPLATE}"

  log "Installing systemd service ${SERVICE_NAME}"
  sed \
    -e "s|^User=.*|User=${APP_USER}|" \
    -e "s|^WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|" \
    -e "s|^ExecStart=.*|ExecStart=/usr/local/bin/node ${APP_DIR}/src/index.js|" \
    "${SERVICE_TEMPLATE}" > "${SERVICE_TARGET}"

  chmod 0644 "${SERVICE_TARGET}"
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
}

env_is_ready() {
  local env_file="${APP_DIR}/.env"
  [[ -f "${env_file}" ]] || return 1

  local api_key
  api_key="$(grep -E '^LLM_API_KEY=' "${env_file}" | tail -n 1 | cut -d'=' -f2- || true)"

  case "${api_key}" in
    ""|"replace-with-your-api-key"|"your-real-key"|"replace-with-your-openrouter-key")
      return 1
      ;;
  esac

  return 0
}

start_service_if_configured() {
  if env_is_ready; then
    log "Starting ${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"
    systemctl --no-pager --full status "${SERVICE_NAME}" || true
    return
  fi

  warn "Service was installed but not started because ${APP_DIR}/.env still contains a placeholder or empty LLM_API_KEY"
  warn "Edit ${APP_DIR}/.env and then run: sudo systemctl start ${SERVICE_NAME}"
}

print_summary() {
  cat <<EOF

[install] Done.
[install] App directory: ${APP_DIR}
[install] Service name: ${SERVICE_NAME}
[install] Service user: ${APP_USER}

[install] Useful commands:
  sudo systemctl status ${SERVICE_NAME}
  sudo systemctl restart ${SERVICE_NAME}
  journalctl -u ${SERVICE_NAME} -f
  nano ${APP_DIR}/.env
EOF
}

main() {
  rerun_with_sudo_if_needed "$@"
  check_os
  install_packages
  install_node
  ensure_app_user
  sync_project
  install_dependencies
  run_checks
  install_systemd_service
  start_service_if_configured
  print_summary
}

main "$@"
