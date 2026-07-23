#!/usr/bin/env bash
set -euo pipefail

DISPLAY="${DISPLAY:-:1}"
VNC_PORT="${VNC_PORT:-5901}"
NO_VNC_PORT="${NO_VNC_PORT:-6080}"
SCREEN_GEOMETRY="${SCREEN_GEOMETRY:-1920x1080x24}"
SESSION_LOG="${SESSION_LOG:-/var/log/agenttrust/desktop-session.log}"
VNC_PASSWORD="${VNC_PASSWORD:-${SESSION_AUTH_TOKEN:-${AGENTTRUST_DESKTOP_TOKEN:-}}}"
VNC_PASSWORD_FILE="${VNC_PASSWORD_FILE:-/home/agentuser/.vnc/passwd}"

mkdir -p "$(dirname "$SESSION_LOG")" /tmp/.X11-unix /home/agentuser/.vnc
touch "$SESSION_LOG"
chown -R agentuser:agentuser /home/agentuser /var/log/agenttrust

log() {
  printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$SESSION_LOG"
}

emit_startup_secret() {
  printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

generate_session_token() {
  python3 -c 'import secrets,string; alphabet=string.ascii_letters+string.digits; print("".join(secrets.choice(alphabet) for _ in range(16)))'
}

cleanup_display() {
  rm -f /tmp/.X1-lock /tmp/.X11-unix/X1
}

configure_vnc_password() {
  if [[ -z "$VNC_PASSWORD" ]]; then
    VNC_PASSWORD="$(generate_session_token)"
    export VNC_PASSWORD
    emit_startup_secret "Generated VNC session token: ${VNC_PASSWORD}"
  else
    log "Using provided VNC session credential"
  fi

  rm -f "$VNC_PASSWORD_FILE"
  x11vnc -storepasswd "$VNC_PASSWORD" "$VNC_PASSWORD_FILE" >>"$SESSION_LOG" 2>&1
  chown agentuser:agentuser "$VNC_PASSWORD_FILE"
  chmod 0600 "$VNC_PASSWORD_FILE"
}

start_xvfb() {
  log "Starting Xvfb on ${DISPLAY} with geometry ${SCREEN_GEOMETRY}"
  Xvfb "$DISPLAY" -screen 0 "$SCREEN_GEOMETRY" -ac +extension GLX +render -noreset >>"$SESSION_LOG" 2>&1 &
}

disable_display_sleep() {
  log "Disabling X11 screen blanking and display power management"
  xset -display "$DISPLAY" s off -dpms s noblank >>"$SESSION_LOG" 2>&1 || true
}

start_xfce() {
  log "Starting XFCE session"
  sudo -E -u agentuser env DISPLAY="$DISPLAY" \
    dbus-launch --exit-with-session xfce4-session >>"$SESSION_LOG" 2>&1 &
}

start_vnc() {
  log "Starting x11vnc with password authentication on localhost:${VNC_PORT}"

  x11vnc -display "$DISPLAY" -forever -shared -localhost \
    -rfbport "$VNC_PORT" -rfbauth "$VNC_PASSWORD_FILE" >>"$SESSION_LOG" 2>&1 &
}

start_websockify() {
  local web_root="/usr/share/novnc"

  if [[ ! -d "$web_root" ]]; then
    web_root="/usr/share/doc/novnc"
  fi

  log "Starting websockify on 0.0.0.0:${NO_VNC_PORT} to localhost:${VNC_PORT}"
  websockify --web="$web_root" "0.0.0.0:${NO_VNC_PORT}" "localhost:${VNC_PORT}" >>"$SESSION_LOG" 2>&1 &
}

cleanup_display
configure_vnc_password
start_xvfb
sleep 1
disable_display_sleep
start_xfce
sleep 2
start_vnc
start_websockify

log "AgentTrust desktop environment is ready"
tail -F "$SESSION_LOG"
