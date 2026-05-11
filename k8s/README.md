# Echoes (拾忆) Kubernetes 完整部署指南

> **面向初学者的边部署边学习手册**
>
> 本文档假设你拥有三台全新的 Ubuntu 22.04 虚拟机，将手把手带你从零搭建一个 1 Master + 2 Worker 的 Kubernetes 集群，并将 Echoes 项目完整部署上去。

---

## 目录

- [一、前言与集群规划](#一前言与集群规划)
- [二、环境准备与前置配置](#二环境准备与前置配置)
- [三、集群搭建](#三集群搭建)
- [四、应用容器化说明](#四应用容器化说明)
- [五、K8s 资源清单详解](#五k8s-资源清单详解)
- [六、服务暴露与验证](#六服务暴露与验证)
- [七、进阶选学](#七进阶选学)
- [八、常见排错指南](#八常见排错指南)
- [九、配套面试题](#九配套面试题)

---

## 一、前言与集群规划

### 1.1 什么是 Echoes？

**Echoes（拾忆）** 是一个个人语义搜索引擎。你可以保存文本片段和网页链接，系统会自动进行向量化和语义分析，让你用自然语言搜索自己的知识库。

**技术架构概览：**

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                               │
│                  访问 echoes.local                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ Ingress (nginx)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Web   │◄──►│   Gateway   │◄──►│   User Service      │  │
│  │ Next.js │    │   Go/Gin    │    │   Go/GORM           │  │
│  │  :3000  │    │   :8080     │    │   :8001             │  │
│  └─────────┘    └──────┬──────┘    └─────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│              ┌─────────────────────┐                         │
│              │   Memory Service    │                         │
│              │   Go/GORM + pgvector│                         │
│              │   :8002             │                         │
│              └──────┬──────────────┘                         │
│                     │                                        │
│        ┌────────────┼────────────┐                          │
│        ▼            ▼            ▼                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │Processor │ │Vectorizer│ │  Redis   │                    │
│  │Python    │ │Python    │ │ Streams  │                    │
│  │:8003     │ │:8004     │ │ :6379    │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                     │                                       │
│                     ▼                                       │
│              ┌──────────┐                                   │
│              │PostgreSQL│  ← pgvector 扩展（向量搜索）       │
│              │  :5432   │                                   │
│              └──────────┘                                   │
│                     │                                       │
│                     ▼                                       │
│              ┌──────────┐                                   │
│              │  MinIO   │  ← 对象存储（文件/封面图）         │
│              │  :9000   │                                   │
│              └──────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 集群规划

| 节点 | IP 地址 | 角色 | 资源配置建议 |
|------|---------|------|-------------|
| `master` | `192.168.1.10` | Control Plane + etcd | 2 CPU / 4GB RAM / 20GB 磁盘 |
| `worker1` | `192.168.1.11` | 工作节点 | 2 CPU / 4GB RAM / 20GB 磁盘 |
| `worker2` | `192.168.1.12` | 工作节点 | 2 CPU / 4GB RAM / 20GB 磁盘 |

> **最低要求**：K8s 官方建议每个节点至少 2 CPU + 2GB RAM。Echoes 包含多个微服务，建议 4GB RAM 以上。

### 1.3 主机名与 hosts 配置

在三台机器上都执行：

```bash
# 修改主机名（分别在三台机器上执行对应的名字）
sudo hostnamectl set-hostname master    # 仅在 master 执行
sudo hostnamectl set-hostname worker1   # 仅在 worker1 执行
sudo hostnamectl set-hostname worker2   # 仅在 worker2 执行

# 配置 hosts，让所有节点可以通过名字互相访问
sudo tee -a /etc/hosts <<EOF
192.168.1.10 master
192.168.1.11 worker1
192.168.1.12 worker2
EOF
```

---

## 二、环境准备与前置配置

> **本节所有命令，除非特别说明，否则需要在三台机器上全部执行。**

### 2.1 系统初始化

> 本文档以 **Ubuntu 22.04** 为主进行演示，同时提供 **CentOS 8/RHEL 8** 的对应命令。请根据你的实际系统选择执行。

**Ubuntu：**

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release software-properties-common

# 关闭防火墙（ufw）
sudo ufw disable

# 关闭 SELinux（Ubuntu 默认未安装，以防万一）
sudo setenforce 0 2>/dev/null || true
```

**CentOS / RHEL：**

```bash
# 更新系统包
sudo dnf update -y

# 安装必要工具
sudo dnf install -y yum-utils device-mapper-persistent-data lvm2 curl

# 关闭防火墙（firewalld）
sudo systemctl stop firewalld
sudo systemctl disable firewalld

# 关闭 SELinux（CentOS 默认启用，必须关闭）
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=disabled/' /etc/selinux/config
```

**💡 学习重点&常见误区**

- **为什么关闭防火墙？** 学习环境为了简化，直接关闭防火墙。生产环境中应该开放 K8s 所需的特定端口（6443, 10250, 2379-2380, 10251, 10252 等），而不是完全关闭。
  - Ubuntu 使用 `ufw`，CentOS 使用 `firewalld`。两者的命令完全不同！
- **为什么关闭 SELinux？** SELinux 是强制访问控制安全模块，默认策略可能会阻止容器运行时访问某些资源。生产环境应该配置正确的 SELinux 策略，而不是直接关闭。
  - **CentOS 必须同时做两件事：** `setenforce 0` 临时关闭 + 修改 `/etc/selinux/config` 永久关闭。**只做其中一项，重启后 SELinux 会重新启用，导致 K8s 无法正常启动！**
- **常见坑：** CentOS 8 的默认软件仓库中 containerd 版本可能较旧，建议配置 Docker 官方 yum 源安装较新版本。

---

### 2.2 关闭 Swap

```bash
# 临时关闭
sudo swapoff -a

# 永久关闭（注释掉 swap 行）
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# 验证
free -h
# 确认 Swap 行显示 0
```

**💡 学习重点&常见误区**

- **为什么必须关闭 Swap？** Kubelet 默认会拒绝在启用了 Swap 的节点上启动 Pod。原因是为了保证资源调度的确定性——如果允许 Swap，一个请求了 1GB 内存的 Pod 可能实际使用了 500MB 内存 + 500MB Swap，这会导致性能抖动和 OOM（内存溢出）行为不可预测。
- **Kubelet v1.22+ 的变化：** 新版本的 K8s 支持有限度的 Swap 使用（`--fail-swap-on=false`），但需要额外配置。学习阶段建议直接关闭。
- **常见坑：** 修改 `/etc/fstab` 后如果不重启，Swap 只是临时关闭，重启后会自动重新挂载！

---

### 2.3 配置内核参数

K8s 和容器运行时需要一些特定的内核模块和参数：

```bash
# 加载必要的内核模块
sudo tee /etc/modules-load.d/k8s.conf <<EOF
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# 设置网络转发和桥接参数
sudo tee /etc/sysctl.d/k8s.conf <<EOF
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

# 应用参数
sudo sysctl --system

# 验证
lsmod | grep -E "overlay|br_netfilter"
sysctl net.ipv4.ip_forward
```

**💡 学习重点&常见误区**

- **`overlay` 是什么？** OverlayFS 是容器镜像分层存储的基础。Docker/containerd 使用 overlay2 存储驱动来高效地存储和共享镜像层。
- **`br_netfilter` 是什么？** 桥接网络过滤器。K8s 使用虚拟网桥（cni0）连接 Pod 网络，`br_netfilter` 确保 iptables 规则能正确处理桥接流量，这是 K8s 网络正常工作的关键。
- **`net.ipv4.ip_forward = 1`：** 开启 IP 转发，允许 Linux 内核将数据包从一个网络接口转发到另一个。这是容器跨主机通信的基础。
- **`net.bridge.bridge-nf-call-iptables`：** 让 iptables 能看到桥接流量。如果不设置，K8s 的 Service 负载均衡（kube-proxy 的 iptables 模式）将无法工作。

---

### 2.4 安装容器运行时（containerd）

K8s 1.24+ 版本移除了对 Docker 的直接支持（dockershim 被移除），推荐使用 **containerd** 作为容器运行时。

**Ubuntu：**

```bash
# 安装 containerd
sudo apt install -y containerd

# 生成默认配置
sudo mkdir -p /etc/containerd
sudo containerd config default | sudo tee /etc/containerd/config.toml

# 修改配置：使用 systemd 作为 cgroup 驱动（与 K8s 默认一致）
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# 重启 containerd
sudo systemctl restart containerd
sudo systemctl enable containerd

# 验证
sudo systemctl status containerd
# 应该显示 Active: active (running)
```

**CentOS / RHEL：**

```bash
# 添加 Docker 官方 yum 源（containerd 版本更新）
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 containerd
sudo dnf install -y containerd.io

# 生成默认配置
sudo mkdir -p /etc/containerd
sudo containerd config default | sudo tee /etc/containerd/config.toml

# 修改配置：使用 systemd 作为 cgroup 驱动
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# 重启 containerd
sudo systemctl restart containerd
sudo systemctl enable containerd

# 验证
sudo systemctl status containerd
# 应该显示 Active: active (running)
```

**💡 学习重点&常见误区**

- **containerd vs Docker 的关系：** Docker 其实是一个完整的容器平台，包含了 Docker Daemon、Docker CLI、containerd 等组件。K8s 直接使用 containerd（Docker 底层的运行时），跳过了 Docker Daemon 这一层，更加轻量高效。
- **为什么必须用 systemd cgroup 驱动？** K8s 默认使用 systemd 管理 cgroup。如果 containerd 使用 cgroupfs 而 K8s 使用 systemd，会导致 cgroup 层级不一致，可能引发资源限制失效、Pod 无法启动等问题。
  - **CentOS 特别注意：** 有些旧版本的 containerd 默认使用 `cgroupfs`，必须通过上述 `sed` 命令修改为 `systemd`！
- **验证容器运行时可以执行容器：** `sudo ctr run --rm docker.io/library/hello-world:latest hello` —— 注意 containerd 使用 `ctr` 命令，和 Docker 的 `docker` 命令不同。
- **常见坑（CentOS）：** 如果使用 `dnf install containerd`（不带 `.io`），安装的是 CentOS 官方仓库的版本，可能较旧。建议使用 Docker 官方仓库的 `containerd.io` 包。

---

### 2.5 安装 kubeadm、kubelet、kubectl

**Ubuntu：**

```bash
# 添加 K8s 官方 apt 仓库
# 注意：这里使用 1.29 版本，你可以根据需要调整
KUBERNETES_VERSION=1.29

# 添加 Google 公钥
curl -fsSL https://pkgs.k8s.io/core:/stable:/v${KUBERNETES_VERSION}/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# 添加仓库
sudo mkdir -p /etc/apt/keyrings
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v${KUBERNETES_VERSION}/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

# 更新并安装
sudo apt update
sudo apt install -y kubelet kubeadm kubectl

# 固定版本，防止自动升级导致集群不兼容
sudo apt-mark hold kubelet kubeadm kubectl

# 验证版本
kubeadm version
kubectl version --client
```

**CentOS / RHEL：**

```bash
# 添加 K8s 官方 yum 仓库
# 注意：这里使用 1.29 版本，你可以根据需要调整
KUBERNETES_VERSION=1.29

# 添加仓库（使用阿里云镜像加速，国内访问更快）
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v${KUBERNETES_VERSION}/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v${KUBERNETES_VERSION}/rpm/repodata/repomd.xml.key
EOF

# 也可以直接使用官方仓库（海外服务器）
# sudo dnf install -y 'dnf-command(config-manager)'
# sudo dnf config-manager --add-repo https://pkgs.k8s.io/core:/stable:/v${KUBERNETES_VERSION}/rpm/

# 安装
sudo dnf install -y kubelet kubeadm kubectl --disableexcludes=kubernetes

# 固定版本，防止自动升级
sudo dnf mark install kubelet kubeadm kubectl

# 启动 kubelet
sudo systemctl enable --now kubelet

# 验证版本
kubeadm version
kubectl version --client
```

**💡 学习重点&常见误区**

- **三个工具的分工：**
  - `kubeadm`：集群管理工具，负责初始化 Master、加入 Worker、升级集群。
  - `kubelet`：节点代理，运行在每个节点上，负责管理 Pod 生命周期（创建、销毁、监控）。
  - `kubectl`：集群 CLI，用于与 K8s API Server 交互，查看和管理资源。
- **为什么要固定版本？**
  - Ubuntu：`apt-mark hold` 阻止 apt 自动升级。
  - CentOS：`dnf mark install` 标记为手动安装，不会被 `dnf autoremove` 删除。但 CentOS 不会自动升级，除非显式执行 `dnf update`。
  - **K8s 对版本一致性要求非常严格。** 如果 Master 是 1.29.0，Worker 升级到 1.29.2 通常没问题，但如果 Master 是 1.29，Worker 升级到 1.30，可能导致 API 不兼容。升级时必须按照官方流程：先升级 Master，再逐个升级 Worker。
- **常见坑（Ubuntu）：** 如果之前安装过其他版本的 K8s，apt 源可能冲突。建议先 `sudo apt remove kubelet kubeadm kubectl` 再重新安装。
- **常见坑（CentOS）：** `kubelet` 安装后默认会不断重启（因为它还没有加入集群），这是正常的。`systemctl status kubelet` 看到 `activating` 或失败状态不必担心，等 `kubeadm init` 或 `kubeadm join` 后就会正常。

---

## 三、集群搭建

### 3.1 初始化 Master 节点

**仅在 `master` 节点（192.168.1.10）上执行：**

```bash
# 初始化集群
# --pod-network-cidr：Pod 网络的 IP 段，Calico 默认使用 192.168.0.0/16
# --apiserver-advertise-address：API Server 对外通告的地址（Master 的 IP）
sudo kubeadm init \
  --pod-network-cidr=192.168.0.0/16 \
  --apiserver-advertise-address=192.168.1.10 \
  --node-name=master
```

**预期输出（关键部分）：**

```
[init] Using Kubernetes version: v1.29.x
[preflight] Running pre-flight checks
[preflight] Pulling images required for setting up a Kubernetes cluster
[certs] Generating "ca" certificate and key
...
[control-plane] Creating static Pod manifest for "kube-apiserver"
[etcd] Creating static Pod manifest for local etcd
[wait-control-plane] Waiting for the kubelet to boot up the control plane
[apiclient] All control plane components are healthy
[upload-config] Storing the configuration used in ConfigMap "kubeadm-config"
...
Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Then, you can join any number of worker nodes by running:

kubeadm join 192.168.1.10:6443 --token <token> \
    --discovery-token-ca-cert-hash sha256:<hash>
```

**配置 kubectl 访问权限：**

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 验证
kubectl get nodes
# 输出类似：
# NAME     STATUS     ROLES           AGE   VERSION
# master   NotReady   control-plane   2m    v1.29.x
```

> **为什么是 `NotReady`？** 因为还没有安装网络插件（CNI），Pod 网络无法通信。这是正常的，下一步安装 Calico 后就会变为 `Ready`。

**💡 学习重点&常见误区**

- **`--pod-network-cidr` 的作用：** 这是 Pod 的 IP 地址池。每个 Pod 会被分配这个网段内的一个 IP。Calico 默认使用 `192.168.0.0/16`，如果你的局域网恰好也是 `192.168.x.x`，可能会冲突！可以改为 `10.244.0.0/16` 等不冲突的网段。
- **`kubeadm init` 做了什么？**
  1. 生成 CA 证书和各类组件证书
  2. 将 kubeconfig 写入 `/etc/kubernetes/admin.conf`
  3. 创建静态 Pod 清单（kube-apiserver, kube-controller-manager, kube-scheduler, etcd）
  4. 等待 Control Plane 组件启动
  5. 安装 CoreDNS 和 kube-proxy
- **常见坑：** 如果之前初始化失败过，需要清理：`sudo kubeadm reset -f && sudo rm -rf /etc/cni/net.d && sudo iptables -F && sudo iptables -t nat -F`
- **Token 有效期：** 默认 Token 24 小时过期。如果 Worker 加入失败需要重新生成：`kubeadm token create --print-join-command`

---

### 3.2 安装网络插件（Calico）

**仅在 `master` 上执行：**

```bash
# 安装 Tigera Calico operator
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/tigera-operator.yaml

# 安装 Calico 自定义资源
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/custom-resources.yaml

# 等待所有 Pod 就绪（可能需要 1-3 分钟）
watch kubectl get pods -n calico-system

# 当看到所有 Pod 都是 Running 时，按 Ctrl+C 退出
# 验证节点状态
kubectl get nodes
# 现在 master 应该显示 Ready
```

**💡 学习重点&常见误区**

- **CNI 是什么？** CNI（Container Network Interface）是 K8s 的容器网络标准。K8s 本身不实现网络，而是调用 CNI 插件。常见的 CNI 插件有 Calico、Flannel、Cilium、Weave 等。
- **为什么必须安装 CNI？** K8s 要求每个 Pod 必须有独立的 IP，且所有 Pod 之间可以直接通信（无需 NAT）。CNI 插件负责：1) 为每个 Pod 分配 IP；2) 设置 Pod 间的路由；3) 实现 NetworkPolicy（网络策略）。
- **Calico vs Flannel：**
  - **Flannel**：简单、易用，使用 VXLAN  overlay 网络。适合小型集群和学习环境。
  - **Calico**：功能强大，支持 BGP 路由（高性能）、NetworkPolicy（网络安全策略）、WireGuard 加密。适合生产环境。
  - **选择建议**：学习环境两者都可以。如果你想学 NetworkPolicy，必须用 Calico。
- **常见坑：** Calico 的 `custom-resources.yaml` 默认使用 `192.168.0.0/16`，必须和 `kubeadm init --pod-network-cidr` 一致！如果不一致，Pod 网络会出问题。

---

### 3.3 Worker 节点加入集群

**在 `master` 上获取加入命令：**

```bash
kubeadm token create --print-join-command
```

**输出示例：**

```bash
kubeadm join 192.168.1.10:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234abcd...
```

**在 `worker1` 和 `worker2` 上分别执行上述命令：**

```bash
# worker1
sudo kubeadm join 192.168.1.10:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234abcd...

# worker2（同样的命令）
sudo kubeadm join 192.168.1.10:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234abcd...
```

**预期输出：**

```
[preflight] Running pre-flight checks
[warn] ...
[kubelet-start] ...
[control-plane] ...
This node has joined the cluster
```

**在 master 上验证：**

```bash
kubectl get nodes
# 预期输出：
# NAME      STATUS   ROLES           AGE    VERSION
# master    Ready    control-plane   10m    v1.29.x
# worker1   Ready    <none>          2m     v1.29.x
# worker2   Ready    <none>          1m     v1.29.x

# 查看所有系统 Pod
kubectl get pods -n kube-system
```

**💡 学习重点&常见误区**

- **Token 和 CA Hash 的作用：**
  - **Token**：临时凭证，证明你有权加入集群。
  - **CA Hash**：防止中间人攻击。Worker 用这个 Hash 验证 Master 的 CA 证书，确保它在和真正的 Master 通信。
- **如果 Token 过期了怎么办？** 在 Master 上执行 `kubeadm token create --print-join-command` 重新生成。
- **Worker 加入失败常见原因：**
  1. 防火墙阻止了 6443 端口 — 检查 `sudo ufw status` 或 `sudo iptables -L`
  2. Token 过期 — 重新生成
  3. 主机名解析失败 — 检查 `/etc/hosts` 配置
  4. Swap 没关闭 — 执行 `sudo swapoff -a`
- **常见坑：** Worker 加入后如果一直 `NotReady`，检查 `journalctl -u kubelet -f` 查看日志。

---

## 四、应用容器化说明

### 4.1 Echoes 项目结构

Echoes 采用微服务架构，包含以下服务：

| 服务 | 语言/框架 | 功能 | Dockerfile |
|------|----------|------|-----------|
| **Gateway** | Go + Gin | API 网关、路由、JWT 验证 | `services/gateway/Dockerfile` |
| **User Service** | Go + GORM | 用户注册/登录/管理 | `services/user-service/Dockerfile` |
| **Memory Service** | Go + GORM | 记忆 CRUD、向量搜索 | `services/memory-service/Dockerfile` |
| **Processor Service** | Python + FastAPI | 链接抓取、AI 标签生成 | `services/processor-service/Dockerfile` |
| **Vectorizer Service** | Python + FastAPI + BGE-M3 | 文本向量化 | `services/vectorizer-service/Dockerfile` |
| **Web** | Next.js 14 | 前端界面 | `web/Dockerfile` |

**基础设施组件：**

| 组件 | 镜像 | 用途 |
|------|------|------|
| PostgreSQL | `ankane/pgvector:v0.5.1` | 关系数据库 + 向量扩展 |
| Redis | `redis:7-alpine` | 缓存 + 消息队列 |
| MinIO | `minio/minio:latest` | 对象存储（S3 兼容）|

### 4.2 Dockerfile 要点解析

**Go 服务（以 Gateway 为例）—— 多阶段构建：**

```dockerfile
# === Stage 1: Builder ===
FROM golang:alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy
# CGO_ENABLED=0：静态编译，不依赖 glibc
# GOOS=linux：交叉编译为 Linux 可执行文件
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o gateway cmd/main.go

# === Stage 2: Production ===
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/gateway .   # 只复制编译后的二进制文件
EXPOSE 8080
CMD ["./gateway"]
```

**💡 学习重点：**
- **多阶段构建的好处：** 第一阶段使用 `golang:alpine`（~300MB）编译，第二阶段使用 `alpine:latest`（~5MB）运行。最终镜像只有编译后的二进制文件（~10MB），大幅减小了攻击面和传输时间。
- **`CGO_ENABLED=0`：** 禁用 CGo，静态链接所有依赖。这样二进制文件可以在任何 Linux 发行版上运行，不依赖宿主机的 glibc 版本。
- **ca-certificates：** Alpine 默认没有 CA 证书，如果不安装，HTTPS 请求会失败。

**Python 服务—— 多阶段构建：**

```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
```

**Next.js 前端—— Standalone 输出：**

```dockerfile
FROM node:20-alpine AS deps
COPY package.json ./
RUN npm install

FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js 14 standalone 模式只输出必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**💡 学习重点：**
- **`output: 'standalone'`：** 在 `next.config.js` 中配置后，Next.js 只会打包运行所需的最小文件集（~50MB），而不是整个 `node_modules`（~500MB）。
- **`server.js`：** standalone 模式会生成一个自包含的 Node.js 服务器，不需要 Next.js CLI。

### 4.3 构建和推送镜像

```bash
# 设置镜像仓库前缀（使用你自己的 Docker Hub 用户名或私有仓库）
export REGISTRY="your-dockerhub-username"
# 或者使用私有仓库
# export REGISTRY="192.168.1.10:5000"

# ========== 构建所有服务镜像 ==========

# 1. Gateway
docker build -t ${REGISTRY}/echoes-gateway:latest ./services/gateway

# 2. User Service
docker build -t ${REGISTRY}/echoes-user-service:latest ./services/user-service

# 3. Memory Service
docker build -t ${REGISTRY}/echoes-memory-service:latest ./services/memory-service

# 4. Processor Service
docker build -t ${REGISTRY}/echoes-processor-service:latest ./services/processor-service

# 5. Vectorizer Service
docker build -t ${REGISTRY}/echoes-vectorizer-service:latest ./services/vectorizer-service

# 6. Web Frontend
docker build -t ${REGISTRY}/echoes-web:latest ./web

# ========== 推送到镜像仓库 ==========
# 如果 registry 是 Docker Hub，先登录：
# docker login

# 推送所有镜像
for img in gateway user-service memory-service processor-service vectorizer-service web; do
  docker push ${REGISTRY}/echoes-${img}:latest
done
```

**💡 学习重点&常见误区**

- **私有镜像仓库方案：**
  - **方案 A（推荐学习）：** 在 Master 节点上部署一个 [Docker Registry](https://docs.docker.com/registry/deploying/)：`docker run -d -p 5000:5000 --name registry registry:2`
  - **方案 B：** 使用阿里云、腾讯云等云厂商的容器镜像服务。
  - **方案 C：** 如果三台机器在同一个局域网，可以用 `scp` 直接传输镜像文件：`docker save > img.tar` → `scp` → `docker load < img.tar`。
- **K8s 使用本地镜像：** 如果镜像只在本地构建（没有推送仓库），需要设置 `imagePullPolicy: Never` 或 `IfNotPresent`，并且确保每个 Worker 节点上都有该镜像（手动 `docker load`）。
- **常见坑：** Vectorizer Service 的镜像很大（~2GB，因为包含 BGE-M3 模型和 PyTorch），构建和推送需要较长时间。

---

## 五、K8s 资源清单详解

> **本节将逐字段解释每个 YAML 文件的设计意图，帮助你理解 "为什么这样写"。**
>
> 所有清单文件位于 `k8s/manifests/` 目录。

### 5.1 命名空间（Namespace）

**文件：** `00-namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: echoes           # 命名空间名称
  labels:
    app: echoes
    env: production
```

**字段解释：**

| 字段 | 作用 |
|------|------|
| `apiVersion: v1` | K8s API 版本。Namespace 属于核心 API 组。 |
| `kind: Namespace` | 资源类型。Namespace 用于资源隔离。 |
| `metadata.name` | 命名空间的唯一标识符。 |
| `metadata.labels` | 标签，用于资源分类和选择。 |

**设计意图：**

- **为什么要用 Namespace？** 将 Echoes 的所有资源放在一个独立的命名空间中，避免与集群中的其他应用冲突。相当于 "虚拟集群"，可以在同一个物理集群上运行多个项目。
- **命名空间隔离了什么？** 资源名称、RBAC 权限、NetworkPolicy、ResourceQuota。不隔离的是：节点资源、存储类。

---

### 5.2 配置信息（ConfigMap）

**文件：** `01-configmap.yaml`

ConfigMap 存放**非敏感**的配置信息——URL、端口、环境标识等。密码和密钥必须放在 Secret 中！

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: echoes-config
  namespace: echoes
data:
  POSTGRES_HOST: "postgres.echoes.svc.cluster.local"
  REDIS_HOST: "redis.echoes.svc.cluster.local"
  # ... 更多配置
```

**关键设计点：**

**1. K8s 内部 DNS 名称格式**

```
<service-name>.<namespace>.svc.cluster.local
```

- `postgres.echoes.svc.cluster.local` → 访问 `echoes` 命名空间中的 `postgres` Service
- 如果服务和调用者在**同一个命名空间**，可以简写为 `postgres`
- 这就是 K8s 的**服务发现**机制——不需要硬编码 IP，通过 DNS 自动解析

**2. 环境变量注入方式**

Pod 中的容器可以通过两种方式使用 ConfigMap：

- **方式 A（本文使用）：** `env.valueFrom.configMapKeyRef` —— 将单个 key 注入为环境变量
- **方式 B：** `envFrom.configMapRef` —— 将 ConfigMap 的所有 key-value 批量注入为环境变量

方式 A 的优点是**精确控制**每个环境变量的名称；方式 B 适合大量配置且变量名和 key 名一致的场景。

**💡 学习重点&常见误区**

- **ConfigMap 大小限制：** 单个 ConfigMap 最大 1MB（etcd 的限制）。如果配置很大，考虑使用 Volume 挂载。
- **ConfigMap 更新后不会自动生效：** 修改 ConfigMap 后，正在运行的 Pod **不会**自动获取新值。需要滚动重启 Deployment：`kubectl rollout restart deployment/xxx`。
- **不要把密码放 ConfigMap！** ConfigMap 以明文存储在 etcd 中，任何人有 etcd 访问权限都能看到。敏感信息务必使用 Secret。

---

### 5.3 敏感信息（Secret）

**文件：** `02-secret.yaml`

Secret 存放密码、密钥、Token 等敏感信息。数据使用 **base64 编码**存储。

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: echoes-secrets
  namespace: echoes
type: Opaque              # 通用类型，可存放任意键值对
data:
  POSTGRES_PASSWORD: ""
  REDIS_PASSWORD: ""
  JWT_SECRET: ""
```

**生成 base64：**

```bash
echo -n '你的密码' | base64
# 输出示例：RWNo...（填入上面的引号中）
```

**字段解释：**

| 字段 | 作用 |
|------|------|
| `type: Opaque` | 通用 Secret 类型。其他类型还有 `kubernetes.io/tls`（证书）、`kubernetes.io/dockerconfigjson`（镜像仓库凭证）等。 |
| `data` | base64 编码的键值对。注意是 `data` 不是 `stringData`。 |
| `stringData`（替代方案）| 可以直接写明文，K8s 会自动 base64 编码。适合手动编写，但 base64 编码更常见于自动化流程。 |

**💡 学习重点&常见误区**

- **base64 不是加密！** 它只是编码，任何人都能解码：`echo 'RWNo...' | base64 -d`。真正的保护来自：
  1. etcd 的访问控制（只有 Master 能访问 etcd）
  2. 启用 etcd 加密（K8s 1.13+ 支持 `EncryptionConfiguration`）
  3. 使用外部密钥管理系统（如 HashiCorp Vault、AWS KMS）
- **生产环境推荐：** [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) 或 [External Secrets Operator](https://external-secrets.io/) —— 将加密后的 Secret 提交到 Git，只有集群能解密。

---

### 5.4 数据库（PostgreSQL + pgvector）

**文件：** `10-postgres.yaml`

PostgreSQL 使用 **StatefulSet** 而不是 Deployment，因为数据库需要：
1. **稳定的网络标识**（固定的 DNS 名）
2. **稳定的存储**（Pod 重建后数据不丢失）

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  type: ClusterIP
  clusterIP: None           # Headless Service！
  ports:
    - port: 5432
  selector:
    app: postgres
```

**为什么用 `clusterIP: None`（Headless Service）？**

- 普通 Service 提供**负载均衡**：访问 Service IP，流量被分发到多个后端 Pod。
- Headless Service **不做负载均衡**：DNS 直接返回 Pod 的 IP。StatefulSet 配合 Headless Service，每个 Pod 都有稳定的 DNS 名：`postgres-0.postgres.echoes.svc.cluster.local`。
- 数据库需要点对点连接，不需要负载均衡，所以用 Headless。

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres     # 关联上面的 Headless Service
  replicas: 1
  volumeClaimTemplates:     # 为每个 Pod 创建独立的 PVC
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

**VolumeClaimTemplate 是什么？**

- Deployment 使用 `volumes` + `PersistentVolumeClaim`（先创建 PVC，再挂载）。
- StatefulSet 使用 `volumeClaimTemplates` —— 模板自动生成 PVC。如果 StatefulSet 有 3 个副本，会自动创建 3 个 PVC：`postgres-data-postgres-0`、`postgres-data-postgres-1`、`postgres-data-postgres-2`。
- 这意味着**每个 Pod 有独立的存储**，互不影响。

**探针（Probe）设计：**

```yaml
livenessProbe:
  exec:
    command: ["pg_isready", "-U", "echoes_user"]
  initialDelaySeconds: 30   # 给数据库启动时间
  periodSeconds: 10
readinessProbe:
  exec:
    command: ["pg_isready", "-U", "echoes_user"]
  initialDelaySeconds: 5
  periodSeconds: 5
```

| 探针 | 作用 | 失败时行为 |
|------|------|-----------|
| **Liveness** | Pod 是否还活着 | 重启容器 |
| **Readiness** | Pod 是否准备好接收流量 | 从 Service 端点列表中移除 |

- 数据库启动较慢（需要加载数据、建立连接），所以 `initialDelaySeconds` 设得比较长。
- `pg_isready` 是 PostgreSQL 官方工具，比简单的 TCP 端口检查更可靠。

**💡 学习重点&常见误区**

- **为什么数据库用 StatefulSet 而不用 Deployment？**
  - Deployment 的 Pod 名称是随机的（如 `postgres-7d9f4b8c5-x2abc`），重建后名字会变。
  - StatefulSet 的 Pod 名称是固定的（`postgres-0`、`postgres-1`），配合 Headless Service 有稳定 DNS。
  - Deployment 的 Volume 是所有副本共享（如果用 `ReadWriteMany`），StatefulSet 是每个副本独立 Volume。
- **pgvector 扩展：** `ankane/pgvector` 镜像是 PostgreSQL 官方镜像 + pgvector 扩展预装。K8s 中需要确保扩展在数据库初始化时创建（可以通过初始化脚本或应用层首次启动时 `CREATE EXTENSION IF NOT EXISTS vector;`）。
- **常见坑：** PostgreSQL 的数据目录 `/var/lib/postgresql/data` 初始化后不能随意更改。如果 PVC 中有旧数据但环境变量（如用户名、密码）变了，会导致启动失败。

---

### 5.5 微服务 Deployment 通用模式

以 **User Service** 为例（`20-user-service.yaml`），所有 Go/Python 微服务遵循相同的模式：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  type: ClusterIP           # 仅集群内部访问
  ports:
    - port: 8001            # Service 端口
      targetPort: 8001      # 容器端口
  selector:
    app: user-service       # 选择带有这个标签的 Pod
```

**Service 字段解释：**

| 字段 | 解释 |
|------|------|
| `type: ClusterIP` | 默认类型，分配一个集群内部 IP，只有集群内可以访问。 |
| `port` | Service 对外暴露的端口。 |
| `targetPort` | 容器实际监听的端口。port 和 targetPort 可以不同（如 Service:80 → Container:8001）。 |
| `selector` | 标签选择器，决定哪些 Pod 属于这个 Service。 |

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 2               # 运行 2 个副本
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1           # 更新时最多多 1 个 Pod
      maxUnavailable: 0     # 不允许有不可用的 Pod
```

**滚动更新策略解释：**

- `maxSurge: 1`：新版本先启动 1 个 Pod，总 Pod 数暂时变为 3。
- `maxUnavailable: 0`：旧版本 Pod 在新版本就绪后才被删除。
- 这样实现了**零停机部署**！任何时候至少 2 个 Pod 在运行。

**环境变量注入的完整链条：**

```yaml
env:
  # 方式 1：直接从 ConfigMap 读取
  - name: PORT
    valueFrom:
      configMapKeyRef:
        name: echoes-config
        key: USER_SERVICE_PORT

  # 方式 2：从 Secret 读取
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: echoes-secrets
        key: POSTGRES_PASSWORD

  # 方式 3：引用其他环境变量（组合成连接字符串）
  - name: DATABASE_URL
    value: "postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)"
```

**设计意图：**
- 连接字符串由多个组件拼接而成，每个组件来自 ConfigMap 或 Secret。
- 这样如果数据库地址变了，只需修改 ConfigMap，不需要修改 Deployment。

**资源限制：**

```yaml
resources:
  requests:
    memory: "64Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "250m"
```

| 字段 | 含义 |
|------|------|
| `requests` | 调度请求。K8s 调度器根据这个值决定 Pod 放到哪个节点。节点上所有 Pod 的 requests 之和不能超过节点容量。 |
| `limits` | 硬限制。容器实际使用的资源不能超过这个值。超过 CPU limit 会被节流（throttle），超过内存 limit 会被 OOM Kill。 |

**💡 学习重点&常见误区**

- **为什么不设置 limits = requests？** 如果设置相等（Guaranteed QoS），Pod 会被优先驱逐。但这样资源利用率较低。对于关键服务可以设相等，对于非关键服务可以留一些弹性。
- **OOM Kill 是什么意思？** 当容器内存使用超过 `limits.memory` 时，Linux 内核的 OOM Killer 会杀死该进程。在 K8s 中表现为 Pod 状态变为 `OOMKilled`，然后被重启。
- **QoS 等级（Quality of Service）：**
  - **Guaranteed：** limits = requests，且只设置了 limits（两者自动相等）。最高优先级，最后被驱逐。
  - **Burstable：** limits ≠ requests。中等优先级。
  - **BestEffort：** 没有设置 requests/limits。最低优先级，最先被驱逐。
- **常见坑：** Java 应用需要特别注意内存设置。JVM 默认会占用容器内存的大部分，如果 limits 设得太低，JVM 的堆内存 + 元空间 + 线程栈可能超出 limit 导致 OOM。

---

### 5.6 Vectorizer Service 的特殊配置

**文件：** `23-vectorizer-service.yaml`

Vectorizer 服务需要加载 BGE-M3 模型（~1GB），启动时间较长：

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"           # 模型加载后峰值内存
    cpu: "1000m"
livenessProbe:
  httpGet:
    path: /health
    port: 8004
  initialDelaySeconds: 60   # 给模型下载/加载足够的时间
  periodSeconds: 15
```

**为什么 `initialDelaySeconds: 60`？**

- BGE-M3 模型首次启动时会从 HuggingFace 下载（或从缓存加载）。
- 如果 `initialDelaySeconds` 太短，探针在模型还没加载完就开始检查，导致 Pod 被反复重启。
- 如果镜像已经将模型打包进去（推荐），加载时间约 10-20 秒；如果从网络下载，可能需要 1-2 分钟。

**💡 优化建议：**
- **模型预下载：** 在 Dockerfile 构建时下载模型并打包到镜像中，避免运行时下载。
- **Init Container：** 可以用 Init Container 预先下载模型到共享 Volume，主容器从 Volume 加载。

---

## 六、服务暴露与验证

### 6.1 安装 Ingress Controller

Ingress 是 K8s 的 HTTP/HTTPS 路由规则，但 Ingress 本身只是一个配置，需要 **Ingress Controller** 来实际执行路由。

```bash
# 安装 nginx-ingress-controller（Bare Metal 版本）
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/baremetal/deploy.yaml

# 等待启动
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# 查看 Ingress Controller 的 NodePort
kubectl get svc -n ingress-nginx
# 输出示例：
# NAME                                 TYPE       CLUSTER-IP      PORT(S)
# ingress-nginx-controller             NodePort   10.96.123.45    80:30080/TCP,443:30443/TCP
```

**💡 学习重点：**

- **NodePort vs LoadBalancer vs Ingress：**
  - **NodePort：** 在每个节点上开放一个端口（如 30080），访问 `http://节点IP:30080`。适合测试。
  - **LoadBalancer：** 在云厂商环境中自动创建云负载均衡器。裸机环境需要 [MetalLB](https://metallb.universe.tf/)。
  - **Ingress：** 基于 HTTP Host 和 Path 的路由，一个 Ingress 可以代理多个 Service。必须在 Ingress Controller 之上工作。
- **Bare Metal 环境的 Ingress：** 裸机环境中，Ingress Controller 默认使用 NodePort 暴露。生产环境建议配合 MetalLB 使用 LoadBalancer 模式。

### 6.2 Ingress 配置

**文件：** `30-ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echoes-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  ingressClassName: nginx
  rules:
    - host: echoes.local
      http:
        paths:
          - path: /api/v1
            pathType: Prefix
            backend:
              service:
                name: gateway
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 3000
```

**路由规则解析：**

| 访问地址 | 路由到 |
|----------|--------|
| `echoes.local/` | Web 前端（Next.js）|
| `echoes.local/api/v1/...` | Gateway → 后端 API |

**注解（Annotations）解释：**

| 注解 | 作用 |
|------|------|
| `rewrite-target: /` | 去掉路径前缀后转发。如 `/api/v1/auth/login` 转发给 Gateway 时变成 `/auth/login`。 |
| `proxy-body-size: 50m` | 允许上传最大 50MB 的文件（默认 1MB）。 |

### 6.3 本地 hosts 配置

在你的**本地电脑**（不是虚拟机）上配置 hosts：

```bash
# Linux/macOS
sudo tee -a /etc/hosts <<EOF
192.168.1.10 echoes.local
EOF

# Windows（以管理员身份运行 PowerShell）
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "192.168.1.10 echoes.local"
```

> **为什么是 Master IP？** 因为 Ingress Controller 的 NodePort 在所有节点上都开放，访问任意节点 IP + NodePort 都可以。这里使用 Master IP 是因为它有固定的 IP。

### 6.4 部署所有资源

```bash
# 进入项目目录
cd k8s/manifests

# 按顺序应用（基础设施先，业务服务后）
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-configmap.yaml

# 先填写 Secret 中的密码！
# vim 02-secret.yaml  # 用 base64 编码填入密码
kubectl apply -f 02-secret.yaml

# 基础设施
kubectl apply -f 10-postgres.yaml
kubectl apply -f 11-redis.yaml
kubectl apply -f 12-minio.yaml

# 等待基础设施就绪
kubectl wait --for=condition=ready pod -l app=postgres -n echoes --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n echoes --timeout=120s
kubectl wait --for=condition=ready pod -l app=minio -n echoes --timeout=120s

# 业务服务
kubectl apply -f 20-user-service.yaml
kubectl apply -f 21-memory-service.yaml
kubectl apply -f 22-processor-service.yaml
kubectl apply -f 23-vectorizer-service.yaml
kubectl apply -f 24-gateway.yaml
kubectl apply -f 25-web.yaml

# Ingress
kubectl apply -f 30-ingress.yaml
```

### 6.5 验证部署

```bash
# 查看所有 Pod
kubectl get pods -n echoes

# 预期输出（所有 Pod 状态为 Running）：
# NAME                                READY   STATUS    RESTARTS   AGE
# gateway-xxx                         1/1     Running   0          2m
# memory-service-xxx                  1/1     Running   0          2m
# minio-xxx                           1/1     Running   0          5m
# postgres-0                          1/1     Running   0          5m
# processor-service-xxx               1/1     Running   0          2m
# redis-xxx                           1/1     Running   0          5m
# user-service-xxx                    1/1     Running   0          2m
# vectorizer-service-xxx              1/1     Running   0          2m
# web-xxx                             1/1     Running   0          2m

# 查看 Service
kubectl get svc -n echoes

# 查看 Ingress
kubectl get ingress -n echoes

# 测试 API
# 先获取 Ingress Controller 的 NodePort
NODE_PORT=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.spec.ports[0].nodePort}')
curl http://192.168.1.10:${NODE_PORT}/api/v1/health

# 或者在配置了 hosts 后
curl http://echoes.local/api/v1/health
```

**💡 学习重点&常见误区**

- **Pod 状态诊断：**
  - `Pending`：正在调度或拉取镜像。用 `kubectl describe pod` 查看原因。
  - `CrashLoopBackOff`：容器反复崩溃。用 `kubectl logs` 查看错误。
  - `ImagePullBackOff`：镜像拉取失败。检查镜像名称、仓库权限、网络连接。
  - `OOMKilled`：内存超限。增大 `limits.memory`。
- **kubectl 常用排错命令：**
  ```bash
  kubectl logs <pod-name> -n echoes              # 查看日志
  kubectl logs <pod-name> -n echoes --tail=50   # 查看最后 50 行
  kubectl logs <pod-name> -n echoes -f          # 实时跟踪日志
  kubectl describe pod <pod-name> -n echoes     # 查看 Pod 事件和详细信息
  kubectl exec -it <pod-name> -n echoes -- sh  # 进入容器调试
  ```

---

## 七、进阶选学

> 本节内容非必需，但强烈建议学习。这些是生产环境的标配能力。

### 7.1 持久化存储（PersistentVolumeClaim）

在之前的清单中，PostgreSQL、Redis、MinIO 都使用了 PVC。这里深入理解其工作原理。

**PVC vs PV vs StorageClass：**

| 概念 | 类比 | 作用 |
|------|------|------|
| **PersistentVolume (PV)** | 硬盘 | 集群中的一块实际存储（NFS、云盘、本地磁盘）。由管理员预先创建或由 StorageClass 动态供给。 |
| **PersistentVolumeClaim (PVC)** | 购买硬盘的申请单 | 用户（Pod）向集群申请存储。指定大小和访问模式。 |
| **StorageClass** | 硬盘品牌/型号 | 定义存储的"类型"。比如 "fast-ssd"、"standard-hdd"。支持动态供给（按需创建 PV）。 |

**动态供给流程：**

```
用户创建 PVC ("我要 10GB")
    ↓
StorageClass 发现有 PVC 未绑定
    ↓
自动创建 PV (实际分配 10GB 存储)
    ↓
PVC 与 PV 绑定
    ↓
Pod 挂载 PVC → 正常使用
```

**示例：使用默认 StorageClass 动态供给：**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: echoes-storage
  namespace: echoes
spec:
  accessModes:
    - ReadWriteOnce        # 单节点读写
  resources:
    requests:
      storage: 10Gi
  # storageClassName: ""   # 留空使用默认 StorageClass
```

**访问模式：**

| 模式 | 缩写 | 说明 |
|------|------|------|
| ReadWriteOnce | RWO | 只能被一个节点以读写方式挂载。 |
| ReadOnlyMany | ROX | 可以被多个节点以只读方式挂载。 |
| ReadWriteMany | RWX | 可以被多个节点以读写方式挂载。 |
| ReadWriteOncePod | RWOP | 只能被一个 Pod 以读写方式挂载（K8s 1.27+）。 |

**💡 学习重点：**
- **为什么数据库用 RWO？** PostgreSQL 不支持多节点同时写入同一个数据目录。如果用 RWX 挂载到多个 Pod，会导致数据损坏。
- **StatefulSet 的 volumeClaimTemplates：** 每个副本自动创建独立的 PVC。StatefulSet 扩容时，新副本自动获得新的 PVC；缩容时，PVC **不会**自动删除（防止数据丢失）。

---

### 7.2 多副本扩缩容

```bash
# 手动扩容 User Service 到 5 个副本
kubectl scale deployment user-service --replicas=5 -n echoes

# 验证
kubectl get pods -n echoes -l app=user-service

# 手动缩容回 2 个
kubectl scale deployment user-service --replicas=2 -n echoes
```

**HPA（Horizontal Pod Autoscaler）自动扩缩容：**

**文件：** `40-hpa.yaml`

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**工作原理：**

1. **metrics-server** 定期采集每个 Pod 的 CPU/内存使用率。
2. HPA 控制器计算当前使用率与目标使用率的比例。
3. 如果当前使用率 > 70%，增加副本数；如果 < 70%，减少副本数。
4. 扩缩容公式：`desiredReplicas = ceil[currentReplicas * (currentMetricValue / desiredMetricValue)]`

**安装 metrics-server：**

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 验证
kubectl top nodes
kubectl top pods -n echoes
```

**💡 学习重点：**
- **为什么需要 metrics-server？** K8s 默认不采集资源使用指标。metrics-server 是一个轻量级的指标聚合器，为 HPA、kubectl top 等提供数据。
- **HPA 的局限：**
  - 基于历史数据反应，有一定延迟（默认 15 秒采集一次）。
  - 不适合突发流量（需要配合 VPA 或预扩容）。
  - 缩容比扩容慢（默认 5 分钟稳定窗口，防止抖动）。
- **VPA（Vertical Pod Autoscaler）：** 调整 Pod 的 requests/limits（垂直扩容），而不是副本数。适合有状态服务。

---

### 7.3 滚动更新

当你修改了 Deployment（如更新镜像版本），K8s 会自动执行滚动更新：

```bash
# 更新 Gateway 镜像版本
kubectl set image deployment/gateway gateway=echoes/gateway:v1.2.0 -n echoes

# 观察更新过程
kubectl rollout status deployment/gateway -n echoes

# 查看更新历史
kubectl rollout history deployment/gateway -n echoes

# 回滚到上一个版本
kubectl rollout undo deployment/gateway -n echoes

# 回滚到指定版本
kubectl rollout undo deployment/gateway --to-revision=2 -n echoes
```

**滚动更新的控制参数：**

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 更新时最多多出 25% 的副本
      maxUnavailable: 0    # 不允许有不可用的副本
```

| 参数 | 说明 |
|------|------|
| `maxSurge` | 更新过程中允许超过期望副本数的最大数量。可以是具体数字或百分比。 |
| `maxUnavailable` | 更新过程中允许不可用的最大副本数。设为 0 表示零停机。 |

**💡 学习重点：**
- **蓝绿部署 vs 金丝雀发布 vs 滚动更新：**
  - **滚动更新（RollingUpdate）：** 逐步替换旧版本，最简单。K8s Deployment 默认支持。
  - **蓝绿部署（Blue/Green）：** 同时运行两套环境，一键切换流量。需要双倍资源。
  - **金丝雀发布（Canary）：** 先让 5% 流量访问新版本，观察没问题后再全量切换。需要 Service Mesh（如 Istio）或 Ingress 权重支持。
- ** readinessProbe 的重要性：** 滚动更新时，新 Pod 必须通过 readinessProbe 才会接收流量。如果 readinessProbe 配置不当，新版本可能在未就绪时就接收请求，导致错误。

---

### 7.4 资源限制最佳实践

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

**设置原则：**

1. **requests = 实际平均使用量的 80%**
2. **limits = 实际峰值使用量的 120%**
3. **ratio（limits/requests）不要超过 4:1**，否则调度器无法准确预估资源需求

**Echoes 各服务推荐配置：**

| 服务 | requests.memory | limits.memory | requests.cpu | limits.cpu |
|------|-----------------|---------------|--------------|------------|
| Gateway | 32Mi | 128Mi | 50m | 200m |
| User Service | 64Mi | 256Mi | 100m | 250m |
| Memory Service | 64Mi | 256Mi | 100m | 250m |
| Processor | 128Mi | 512Mi | 100m | 500m |
| Vectorizer | 512Mi | 2Gi | 250m | 1000m |
| Web | 128Mi | 512Mi | 100m | 500m |
| PostgreSQL | 256Mi | 512Mi | 250m | 500m |
| Redis | 128Mi | 256Mi | 100m | 250m |
| MinIO | 256Mi | 512Mi | 100m | 250m |

---

## 八、常见排错指南

### 8.1 Pod 一直处于 Pending

```bash
kubectl describe pod <pod-name> -n echoes
```

**常见原因：**

| 现象 | 原因 | 解决 |
|------|------|------|
| `0/3 nodes are available: 3 Insufficient memory` | 节点内存不足 | 减少 requests 或增加节点内存 |
| `0/3 nodes are available: 1 node(s) had taint ...` | 节点有污点，Pod 无法调度 | 删除污点或添加 toleration |
| `Failed to pull image` | 镜像拉取失败 | 检查镜像名称、仓库权限、网络 |
| `unbound immediate PersistentVolumeClaims` | PVC 未绑定 | 检查 StorageClass 或手动创建 PV |

### 8.2 Pod 处于 CrashLoopBackOff

```bash
kubectl logs <pod-name> -n echoes --previous    # 查看上一次崩溃的日志
kubectl describe pod <pod-name> -n echoes         # 查看事件
```

**常见原因：**

| 现象 | 原因 | 解决 |
|------|------|------|
| `OOMKilled` | 内存超限 | 增大 limits.memory |
| `Error: database connection refused` | 数据库未就绪 | 添加 initContainer 等待依赖就绪 |
| `panic: config error` | 配置错误 | 检查 ConfigMap/Secret 中的值 |
| `exit code 1` | 应用代码错误 | 查看应用日志定位问题 |

### 8.3 Service 无法访问

```bash
# 测试 Service 是否正常工作
kubectl run debug --rm -it --image=busybox -- /bin/sh
wget -qO- http://gateway.echoes.svc.cluster.local:8080/health

# 查看 Service 端点
kubectl get endpoints -n echoes
# 如果 endpoints 为空，说明没有 Pod 匹配 selector 或 Pod 未就绪
```

**常见原因：**

| 现象 | 原因 | 解决 |
|------|------|------|
| Endpoints 为空 | Label selector 不匹配 | 检查 Service selector 和 Pod labels |
| 连接超时 | 网络策略阻止 | 检查 NetworkPolicy |
| DNS 解析失败 | CoreDNS 异常 | 检查 `kubectl get pods -n kube-system` |

### 8.4 Ingress 无法访问

```bash
# 查看 Ingress 事件
kubectl describe ingress echoes-ingress -n echoes

# 查看 Ingress Controller 日志
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# 测试直接访问 Service（绕过 Ingress）
kubectl port-forward svc/web 3000:3000 -n echoes
# 然后在本地访问 http://localhost:3000
```

**常见原因：**

| 现象 | 原因 | 解决 |
|------|------|------|
| `404 Not Found` | 路径配置错误 | 检查 Ingress path 和 backend service |
| `502 Bad Gateway` | 后端 Pod 未就绪 | 检查 Pod 状态和 readinessProbe |
| `连接被拒绝` | Ingress Controller 未运行 | 检查 `kubectl get pods -n ingress-nginx` |
| hosts 未配置 | DNS 无法解析 | 在本地配置 `/etc/hosts` |

---

## 九、配套面试题

> **以下题目覆盖 K8s 核心概念和本次部署的实践经验，每题都附带详细解答思路。**

### 题目 1：Pod 的生命周期有哪些状态？分别代表什么含义？

**答案：**

| 状态 | 含义 |
|------|------|
| **Pending** | Pod 已创建，但尚未被调度到节点，或镜像正在拉取中。 |
| **Running** | Pod 已绑定到节点，所有容器已创建，至少一个容器正在运行。 |
| **Succeeded** | Pod 中的所有容器已成功终止（退出码为 0），且不会重启。 |
| **Failed** | Pod 中的所有容器已终止，但至少有一个容器以失败状态终止（非 0 退出码）。 |
| **Unknown** | 由于某种原因无法获取 Pod 的状态（通常是节点通信故障）。 |
| **CrashLoopBackOff** | 容器反复崩溃并被重启（是 Running 的一种子状态）。 |
| **ImagePullBackOff** | 镜像拉取失败，Kubelet 正在按指数退避策略重试。 |
| **OOMKilled** | 容器使用的内存超过了 limits，被 Linux OOM Killer 杀死。 |

**延伸：** Pod 的 `status.conditions` 中还会显示 `PodScheduled`、`ContainersReady`、`Initialized`、`Ready` 等条件。

---

### 题目 2：Deployment、ReplicaSet 和 Pod 之间的关系是什么？

**答案：**

```
Deployment (管理发布策略)
    ↓ 创建/管理
ReplicaSet (管理副本数量)
    ↓ 创建/管理
Pod (实际运行的容器)
```

- **Deployment：** 提供声明式更新能力。你定义期望状态（如 replicas=3, image=nginx:v2），Deployment 负责将实际状态调整为期望状态。支持滚动更新、回滚、暂停/恢复。
- **ReplicaSet：** 确保指定数量的 Pod 副本始终运行。如果 Pod 被删除，ReplicaSet 会自动创建新的。Deployment 通过管理 ReplicaSet 来实现滚动更新（新版本创建新 ReplicaSet，旧版本缩容旧 ReplicaSet）。
- **Pod：** 最小调度单元，包含一个或多个容器。

**为什么用 Deployment 而不是直接用 ReplicaSet？** ReplicaSet 只保证副本数，不支持滚动更新。Deployment 在 ReplicaSet 之上增加了发布管理能力。

---

### 题目 3：K8s 的 Service 有哪些类型？各自的使用场景？

**答案：**

| 类型 | 访问方式 | 使用场景 |
|------|---------|---------|
| **ClusterIP** | 仅集群内部访问 | 微服务间内部调用（默认类型） |
| **NodePort** | `节点IP:端口` | 开发测试、小型集群、无云负载均衡器的环境 |
| **LoadBalancer** | 云厂商提供的公网 IP | 云环境生产部署（AWS ELB、阿里云 SLB） |
| **ExternalName** | DNS CNAME 记录 | 将集群内部 DNS 指向外部服务（如 `db.example.com`） |
| **Headless** | DNS 返回 Pod IP | StatefulSet 场景，需要直接访问特定 Pod |

**延伸：** Ingress 不是 Service 类型，而是在 Service 之上的一层 HTTP 路由抽象。

---

### 题目 4：K8s 的网络模型是什么？为什么 Pod 之间可以直接通信？

**答案：**

K8s 的网络模型要求满足三个核心原则：

1. **每个 Pod 有独立的 IP 地址**（Pod IP）
2. **所有 Pod 可以在没有 NAT 的情况下互相通信**
3. **节点和 Pod 可以在没有 NAT 的情况下互相通信**

**实现方式（以 Calico 为例）：**

- 每个节点上运行一个 Calico 代理（Felix）。
- 每个 Pod 分配一个来自 `pod-network-cidr`（如 `192.168.0.0/16`）的 IP。
- 同一节点上的 Pod 通过 Linux 网桥（cni0）直接通信。
- 跨节点的 Pod 通过 BGP 路由或 VXLAN 隧道通信。Calico 会在每个节点上维护到其他节点 Pod IP 的路由表。
- Service 的 ClusterIP 通过 kube-proxy（iptables/ipvs 模式）实现负载均衡。

**延伸：** 这就是 "IP-per-Pod" 模型，每个 Pod 就像一台独立的虚拟机，有自己的网络栈。

---

### 题目 5：ConfigMap 和 Secret 有什么区别？Secret 真的安全吗？

**答案：**

| 特性 | ConfigMap | Secret |
|------|-----------|--------|
| 用途 | 非敏感配置 | 敏感信息（密码、Token、密钥） |
| 存储 | etcd 明文 | etcd 中 base64 编码（**不是加密**） |
| 大小限制 | 1MB | 1MB |
| 挂载方式 | 环境变量 / Volume | 环境变量 / Volume（建议用 Volume，避免 env 暴露） |

**Secret 不够安全，因为：**
- base64 只是编码，任何人都能解码。
- etcd 中的数据如果没有启用加密，拥有 etcd 访问权限的人可以看到所有 Secret。
- 使用环境变量注入 Secret 时，容器的 `env` 命令可以查看所有环境变量。

**更安全的方案：**
- 启用 etcd 加密：`EncryptionConfiguration`（K8s 1.13+）
- 使用外部密钥管理：HashiCorp Vault、AWS KMS、阿里云 KMS
- 使用 Sealed Secrets：将加密后的 Secret 提交到 Git，只有集群能解密

---

### 题目 6：什么是存活探针（Liveness）和就绪探针（Readiness）？有什么区别？

**答案：**

| 探针 | 目的 | 失败时的行为 | 典型配置 |
|------|------|-------------|---------|
| **Liveness** | 检查容器是否还活着 | 重启容器 | `initialDelaySeconds: 30, periodSeconds: 10` |
| **Readiness** | 检查容器是否准备好接收流量 | 从 Service Endpoints 中移除 | `initialDelaySeconds: 5, periodSeconds: 5` |
| **Startup**（1.16+） | 检查应用是否启动完成 | 禁用 Liveness/Readiness 直到成功 | 用于启动极慢的应用 |

**使用场景：**
- **Liveness：** 应用陷入死锁或无限循环，但进程还在运行。Liveness 探测不到响应，就会重启容器。
- **Readiness：** 应用正在启动中（如加载缓存、建立数据库连接），还不能处理请求。Readiness 失败，Service 不会把流量转发给它。

**常见误区：**
- Liveness 配置太激进（如 `periodSeconds: 1`），导致正常响应稍慢就被重启。
- Readiness 配置太宽松，未就绪的 Pod 就开始接收流量，导致请求失败。

---

### 题目 7：为什么数据库要用 StatefulSet 而不是 Deployment？

**答案：**

**StatefulSet 为每个 Pod 提供：**

1. **稳定的唯一网络标识：** Pod 名称固定（`postgres-0`、`postgres-1`），配合 Headless Service 有稳定的 DNS。
2. **稳定的存储：** 每个副本有独立的 PVC，Pod 重建后仍然挂载同一个 PVC。
3. **有序的部署和扩缩容：** 按顺序创建/删除（0 → 1 → 2），支持有序滚动更新。

**Deployment 的问题：**
- Pod 名称随机（如 `postgres-7d9f4b8c5-abc12`），重建后名称变化。
- 所有副本共享同一个 Volume（如果用 PVC），数据库不能多节点同时写入同一个数据目录。
- 无序创建/删除，不适合主从复制等需要顺序的场景。

**StatefulSet 的适用场景：** 数据库（MySQL、PostgreSQL、MongoDB）、消息队列（Kafka、RabbitMQ）、分布式存储（etcd、ZooKeeper）。

---

### 题目 8：K8s 的调度策略是怎样的？如何影响 Pod 的调度位置？

**答案：**

**默认调度流程：**

1. **过滤（Filtering）：** 筛选出满足 Pod 需求的节点。
   - 资源是否充足（CPU、内存、GPU）
   - 是否匹配 nodeSelector/nodeAffinity
   - 是否容忍节点的 taint
   - PVC 的拓扑约束

2. **打分（Scoring）：** 对剩余节点打分，选出最优节点。
   - 资源均衡度（优先选择资源使用较少的节点）
   - 亲和性/反亲和性权重

**影响调度的方式：**

| 机制 | 用途 | 示例 |
|------|------|------|
| **nodeSelector** | 将 Pod 调度到特定标签的节点 | `disktype: ssd` |
| **nodeAffinity** | 更灵活的节点选择（支持软硬约束）| 优先调度到 `zone=a` |
| **podAffinity** | 将 Pod 调度到某 Pod 附近 | 缓存服务和 Web 服务同节点 |
| **podAntiAffinity** | 将 Pod 分散到不同节点 | 2 个 Gateway 副本不在同一节点 |
| **Taint/Toleration** | 排斥/允许 Pod 调度到特定节点 | Master 节点默认有 `NoSchedule` taint |

**示例：确保 Gateway 副本分布在不同节点：**

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - gateway
          topologyKey: kubernetes.io/hostname
```

---

### 题目 9：什么是 Helm？它和直接写 YAML 有什么区别？

**答案：**

**Helm 是 K8s 的包管理工具**，类比：
- Helm ≈ apt/yum（Linux 包管理器）
- Chart ≈ deb/rpm（安装包）
- Release ≈ 已安装的软件实例

**直接写 YAML 的问题：**
- 配置分散在多个文件中，管理困难
- 不同环境（dev/staging/prod）需要复制修改多份 YAML
- 没有版本管理和回滚能力
- 依赖管理复杂（如安装应用前需要先安装数据库）

**Helm Chart 的优势：**
- **模板化：** 使用 Go template 语法，一份模板 + values 文件生成不同环境的配置
- **版本管理：** `helm install`、`helm upgrade`、`helm rollback`
- **依赖管理：** Chart 可以声明依赖其他 Chart
- **仓库：** 可以从 Helm Hub 或私有仓库安装应用

**示例：** 用 Helm 安装 PostgreSQL：

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-postgres bitnami/postgresql \
  --set auth.username=echoes_user \
  --set auth.password=secret123 \
  --set auth.database=echoes
```

---

### 题目 10：Pod 频繁重启，如何排查？

**答案（排查步骤）：**

```bash
# 1. 查看 Pod 状态和重启次数
kubectl get pods -n echoes

# 2. 查看 Pod 事件（关键！）
kubectl describe pod <pod-name> -n echoes
# 关注 Events 部分，查看 Last State、Reason

# 3. 查看当前日志
kubectl logs <pod-name> -n echoes

# 4. 查看上一次崩溃的日志（如果 Pod 已重启）
kubectl logs <pod-name> -n echoes --previous

# 5. 进入容器内部检查
kubectl exec -it <pod-name> -n echoes -- sh
# 检查：环境变量是否正确、配置文件是否存在、网络是否通
```

**根据原因分类处理：**

| 原因 | 特征 | 解决 |
|------|------|------|
| OOMKilled | Last State: Terminated, Reason: OOMKilled | 增大 limits.memory |
| Liveness 失败 | 应用响应慢但进程没死 | 调大 initialDelaySeconds 或 periodSeconds |
| 镜像拉取失败 | ImagePullBackOff | 检查镜像名称、仓库权限 |
| 配置错误 | 启动时报错后退出 | 检查 ConfigMap/Secret 的值 |
| 依赖未就绪 | 连接数据库超时 | 添加 initContainer 等待依赖 |

---

### 题目 11：K8s 中如何实现零停机部署？

**答案：**

**Deployment 的 RollingUpdate 策略：**

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

**零停机的关键：**

1. **`maxUnavailable: 0`** — 更新过程中始终保持全部副本可用。
2. **Readiness Probe** — 新 Pod 必须通过 readiness 检查才会接收流量。
3. **优雅关闭（Graceful Shutdown）** — Pod 收到 SIGTERM 信号后，应用应该：
   - 停止接收新请求
   - 等待正在处理的请求完成
   - 关闭数据库连接
   - 退出进程

```yaml
# 优雅关闭配置
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30   # 等待 30 秒让应用优雅关闭
      containers:
        - name: app
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]  # 给负载均衡器时间更新端点
```

**延伸：** 对于需要更高可靠性的场景，可以使用 **蓝绿部署** 或 **金丝雀发布**。

---

### 题目 12：什么是 Init Container？在 Echoes 中如何使用？

**答案：**

**Init Container** 是在主容器启动之前运行的容器，用于执行初始化任务：

- 等待依赖服务就绪（如数据库、Redis）
- 生成配置文件
- 从外部下载数据
- 执行数据库迁移

**特点：**
- 按顺序执行，上一个成功后下一个才开始
- 如果失败，Pod 会按 restartPolicy 重试
- 不支持 readiness/liveness probe

**在 Echoes 中的使用场景：**

```yaml
initContainers:
  # 1. 等待数据库就绪
  - name: wait-for-postgres
    image: busybox:1.36
    command:
      - sh
      - -c
      - |
        until nc -z postgres.echoes.svc.cluster.local 5432; do
          echo "Waiting for PostgreSQL..."
          sleep 2
        done
  # 2. 等待 Redis 就绪
  - name: wait-for-redis
    image: busybox:1.36
    command:
      - sh
      - -c
      - |
        until nc -z redis.echoes.svc.cluster.local 6379; do
          echo "Waiting for Redis..."
          sleep 2
        done
  # 3. 执行数据库迁移（User Service）
  - name: run-migrations
    image: echoes/user-service:latest
    command: ["./user-service", "migrate"]
    env:
      - name: DATABASE_URL
        value: "postgres://..."
```

**为什么需要 Init Container？**
- 如果业务容器启动时数据库还没准备好，会导致连接失败和 CrashLoopBackOff。
- Init Container 确保所有依赖就绪后，主容器才启动。
- 比在主容器启动脚本中写 `sleep` 或轮询更优雅、更可靠。

---

### 题目 13：K8s 中的 RBAC 是什么？如何给 Service Account 授权？

**答案：**

**RBAC（Role-Based Access Control）** 是 K8s 的权限控制机制，通过四个资源实现：

| 资源 | 作用范围 | 用途 |
|------|---------|------|
| **Role** | 单个 Namespace | 定义一组权限（如 get/list pods） |
| **ClusterRole** | 整个集群 | 定义跨 Namespace 的权限（如 get nodes） |
| **RoleBinding** | 单个 Namespace | 将 Role 绑定到用户/ServiceAccount |
| **ClusterRoleBinding** | 整个集群 | 将 ClusterRole 绑定到用户/ServiceAccount |

**给 Echoes 的 Service Account 授权示例：**

```yaml
# 创建 ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: echoes-sa
  namespace: echoes
---
# 定义权限（允许读取 ConfigMap）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: echoes-config-reader
  namespace: echoes
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
---
# 绑定权限
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: echoes-config-binding
  namespace: echoes
subjects:
  - kind: ServiceAccount
    name: echoes-sa
    namespace: echoes
roleRef:
  kind: Role
  name: echoes-config-reader
  apiGroup: rbac.authorization.k8s.io
```

**Pod 中使用 ServiceAccount：**

```yaml
spec:
  serviceAccountName: echoes-sa    # 不使用默认的 default SA
  containers:
    - name: app
      image: echoes/app:latest
```

**💡 为什么需要 RBAC？**
- 默认的 `default` ServiceAccount 几乎没有权限。
- 遵循最小权限原则：只给 Pod 真正需要的权限。
- 防止 compromised Pod 滥用 K8s API（如删除其他 Pod、读取所有 Secret）。

---

### 题目 14：如何监控 K8s 集群和应用的运行状态？

**答案：**

**监控分层：**

| 层级 | 工具 | 监控内容 |
|------|------|---------|
| **集群层** | metrics-server + Prometheus | 节点 CPU/内存/磁盘、Pod 资源使用 |
| **应用层** | Prometheus + Grafana | HTTP 请求 QPS/延迟/错误率、业务指标 |
| **日志层** | ELK / Loki + Grafana | 应用日志、系统日志、审计日志 |
| **告警层** | Prometheus Alertmanager | 资源不足、Pod 崩溃、服务不可用 |

**Prometheus 监控 K8s 的架构：**

```
Prometheus Server
    ├─ kubelet (cAdvisor): 容器指标
    ├─ kube-apiserver: API Server 指标
    ├─ node-exporter: 节点系统指标
    ├─ Pod annotations: 应用暴露的 /metrics 端点
    └─ Alertmanager → 钉钉/企业微信/邮件告警
```

**在 Echoes 中暴露监控指标：**

Go 服务可以使用 `github.com/prometheus/client_golang` 在 `/metrics` 端点暴露指标：

```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

http.Handle("/metrics", promhttp.Handler())
```

**快速查看资源使用：**

```bash
kubectl top nodes          # 节点资源使用
kubectl top pods -n echoes # Pod 资源使用
kubectl top pods -n echoes --containers # 按容器查看
```

---

*本文档由 Echoes 团队编写，持续更新中。*
*最后更新：2026-04-27*


