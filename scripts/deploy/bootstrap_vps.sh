#!/usr/bin/env bash
# Khởi tạo VPS Ubuntu 24.04 mới cho ProCV. Lần đầu chạy bằng root:
#   scp scripts/deploy/bootstrap_vps.sh root@<ip-vps>:
#   ssh root@<ip-vps> bash bootstrap_vps.sh
# Sau lần đầu root không SSH được nữa; chạy lại (an toàn, idempotent) bằng:
#   ssh deploy@<ip-vps> sudo bash bootstrap_vps.sh
#
# Việc làm: cập nhật hệ thống, Docker Engine + Compose plugin (live-restore),
# user `deploy` (SSH key, sudo), SSH chỉ cho `deploy` bằng key, ufw chỉ mở 22,
# chỉ dải IP Cloudflare vào 80/443 (chain DOCKER-USER, áp lại mỗi khi Docker
# khởi động), fail2ban, tự cập nhật bảo mật + tự khởi động lại 04:30, swap 4 GB,
# múi giờ Việt Nam, thư mục /srv/procv.
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
# age: mã hóa bản backup (scripts/deploy/backup_*.sh); flock có sẵn trong util-linux.
apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades rsync rclone age util-linux

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
# live-restore: container tiếp tục chạy khi dockerd khởi động lại/nâng cấp.
# Chỉ restart Docker khi file thật sự đổi (chạy lại script không làm rớt site).
daemon_json="$(mktemp)"
cat > "$daemon_json" <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
JSON
systemctl enable --now docker
if ! cmp -s "$daemon_json" /etc/docker/daemon.json; then
  install -m 0644 "$daemon_json" /etc/docker/daemon.json
  systemctl restart docker
fi
rm -f "$daemon_json"

echo "==> User $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
# Root không SSH được nữa nên `deploy` cần sudo để quản trị máy. Nhóm docker vốn
# đã tương đương root, sudo không mở thêm quyền thực chất; user không có mật khẩu
# nên dùng NOPASSWD.
sudoers_file="/etc/sudoers.d/90-procv-$DEPLOY_USER"
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "$sudoers_file.tmp"
chmod 440 "$sudoers_file.tmp"
visudo -cf "$sudoers_file.tmp" >/dev/null
mv "$sudoers_file.tmp" "$sudoers_file"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [[ -s /root/.ssh/authorized_keys && ! -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo "==> SSH"
# Chỉ khóa SSH khi `deploy` đã có key, tránh tự khóa mình ngoài VPS. Phiên root
# đang chạy script không bị ngắt; từ lần sau dùng `deploy` + sudo.
if [[ -s "/home/$DEPLOY_USER/.ssh/authorized_keys" ]]; then
  cat > /etc/ssh/sshd_config.d/60-procv.conf <<SSHD
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers $DEPLOY_USER
SSHD
  sshd -t
  systemctl reload ssh
else
  echo "Cảnh báo: chưa có SSH key cho $DEPLOY_USER — GIỮ đăng nhập mật khẩu." >&2
  echo "Thêm key vào /home/$DEPLOY_USER/.ssh/authorized_keys rồi chạy lại script." >&2
fi

echo "==> Tường lửa"
# ufw chỉ giữ SSH. Cổng 80/443 do Docker publish đi qua NAT/FORWARD nên ufw
# không thấy (rule ufw cho 80/443 vô tác dụng); compose prod chỉ publish 80/443
# trên IPv4 nên db/redis không lộ ra ngoài.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw delete allow 80/tcp >/dev/null 2>&1 || true
ufw delete allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable
systemctl enable --now fail2ban

# Chỉ Cloudflare vào 80/443: chain DOCKER-USER là chỗ Docker dành cho rule của
# người dùng, chạy trước rule NAT của Docker. Khớp theo cổng gốc trước DNAT
# (--ctorigdstport) và chỉ trên card mạng ngoài, không đụng traffic giữa các
# container. iptables mất khi reboot và ufw xung đột iptables-persistent, nên
# một unit systemd áp lại rule mỗi lần Docker khởi động.
# Dải IPv4 giống frontend/docker/nginx/snippets/cloudflare-realip.conf
# (https://www.cloudflare.com/ips-v4) — đổi một nơi thì đổi cả hai.
cat > /usr/local/sbin/procv-cloudflare-firewall <<'FIREWALL'
#!/usr/bin/env bash
# Sinh bởi scripts/deploy/bootstrap_vps.sh — sửa ở đó rồi chạy lại script.
set -euo pipefail
CHAIN=PROCV-CLOUDFLARE
EXT_IF="$(ip -4 route show default | awk '{print $5; exit}')"
[[ -n "$EXT_IF" ]] || { echo "Không tìm thấy card mạng mặc định." >&2; exit 1; }
iptables -N "$CHAIN" 2>/dev/null || iptables -F "$CHAIN"
for cidr in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 \
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 \
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 \
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
  iptables -A "$CHAIN" -s "$cidr" -j RETURN
done
iptables -A "$CHAIN" -j DROP
for port in 80 443; do
  rule=(-i "$EXT_IF" -p tcp -m conntrack --ctorigdstport "$port" --ctdir ORIGINAL -j "$CHAIN")
  iptables -C DOCKER-USER "${rule[@]}" 2>/dev/null || iptables -I DOCKER-USER "${rule[@]}"
done
FIREWALL
chmod 755 /usr/local/sbin/procv-cloudflare-firewall
cat > /etc/systemd/system/procv-cloudflare-firewall.service <<'UNIT'
[Unit]
Description=ProCV: chỉ dải IP Cloudflare vào cổng 80/443 của Docker
After=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/procv-cloudflare-firewall

[Install]
WantedBy=docker.service
UNIT
systemctl daemon-reload
systemctl enable procv-cloudflare-firewall.service
systemctl restart procv-cloudflare-firewall.service

echo "==> Tự cập nhật bảo mật"
# Gói bảo mật của Ubuntu cài hằng ngày; cần khởi động lại (kernel, libc) thì tự
# reboot lúc 04:30 — sau backup 03:00, trước giờ cao điểm. Container có
# restart: unless-stopped nên tự lên lại.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
cat > /etc/apt/apt.conf.d/52procv-unattended-upgrades <<'APT'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
APT

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
