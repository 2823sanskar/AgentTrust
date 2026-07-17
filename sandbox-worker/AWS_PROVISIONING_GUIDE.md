# AWS EC2 Provisioning Blueprint for AgentTrust Sandbox

Follow these exact configurations within the AWS Console to launch a cloud compute instance compatible with our automation scripts.

---

## 1. Instance Hardware & OS Blueprint

* **Navigate to:** AWS Console -> EC2 -> Launch Instance
* **Name:** `agenttrust-sandbox-staging`
* **Application and OS Images (AMI):** `Ubuntu Server 24.04 LTS (HVM), SSD Volume Type` (Ensure 64-bit x86 architecture is selected)
* **Instance Type:** `t3.micro` (or `t2.micro` depending on region availability; Free Tier eligible)
* **Key Pair (login):** Click **Create new key pair**
  * **Key pair name:** `agenttrust-staging-key`
  * **Key pair type:** `RSA`
  * **Private key file format:** `.pem`
  * *Crucial:* Save this downloaded `.pem` file directly to a secure local folder on your computer.

---

## 2. Firewall Network Security Matrix

Under the **Network settings** panel, configure the following explicit inbound traffic rule mapping conditions:

| Rule Type | Port Range | Source | Purpose |
|---|---|---|---|
| **SSH** | `22` | `My IP` (Highly Recommended) or `Anywhere (0.0.0.0/0)` | Administrative terminal orchestration management via `launch-staging.sh` |
| **HTTP** | `80` | `Anywhere (0.0.0.0/0)` | Public ingress web traffic route to the protective Nginx proxy container gate |

---

## 3. Storage Allocation

* **Size:** Change default from 8GB to **20GB** or **30GB** (General Purpose SSD `gp3`).
* *Note:* Docker images and ephemeral execution containers consume significant workspace disk footprints.

Click **Launch Instance**.
