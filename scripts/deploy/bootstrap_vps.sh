#!/usr/bin/env bash
# Khởi tạo VPS Ubuntu 24.04 mới cho ProCV. Chạy MỘT LẦN bằng root:
#   scp scripts/deploy/bootstrap_vps.sh root@<ip-vps>:
#   ssh root@<ip-vps> bash bootstrap_vps.sh
#
# Việc làm: cập nhật hệ thống, Docker Engine + Compose plugin, user `deploy`
# (đăng nhập bằng SSH key), tường lửa ufw 22/80/443, fail2ban, tự cập nhật bảo
# mật, swap 4 GB, múi giờ Việt Nam, thư mục /srv/procv. Chạy lại an toàn.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/srv/procv}"
SWAP_SIZE="${SWAP_SIZE:-4G}"

[[ $EUID -eq 0 ]] || { echo "Chạy bằng root (sudo)." >&2; exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu ]] || echo "Cảnh báo: script viết cho Ubuntu, đang chạy trên $ID." >&2

echo "==> Gói hệ thống"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades rsync rclone

echo "==> Docker Engine"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Xoay log mặc định cho mọi container (compose cũng đặt riêng từng service).
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
JSON
systemctl enable --now docker
systemctl restart docker

echo "==> User $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [[ -s /root/.ssh/authorized_keys && ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo "==> SSH"
# Chỉ tắt đăng nhập mật khẩu khi đã có key, tránh tự khóa mình ngoài VPS.
if [[ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]]; then
  cat > /etc/ssh/sshd_config.d/60-procv.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSHD
  systemctl reload ssh
else
  echo "Cảnh báo: chưa có SSH key cho $DEPLOY_USER — GIỮ đăng nhập mật khẩu." >&2
  echo "Thêm key vào /home/$DEPLOY_USER/.ssh/authorized_keys rồi chạy lại script." >&2
fi

echo "==> Tường lửa"
# Docker tự mở cổng đã publish qua iptables, bỏ qua ufw; compose prod chỉ
# publish 80/443 nên db/redis không lộ ra ngoài.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Swap $SWAP_SIZE"
if ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
cat > /etc/sysctl.d/60-procv.conf <<'SYSCTL'
vm.swappiness = 10
# Redis khuyến nghị để BGSAVE/AOF rewrite không lỗi khi thiếu bộ nhớ ảo.
vm.overcommit_memory = 1
SYSCTL
sysctl --system >/dev/null

timedatectl set-timezone Asia/Ho_Chi_Minh

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

echo
echo "Xong. Bước tiếp theo (đăng nhập bằng $DEPLOY_USER):"
echo "  git clone <repo> $APP_DIR && cd $APP_DIR"
echo "  rồi làm theo docs/06-deployment/huong-dan-deployment.md"
