# DevOps Technical Assignment — AWS Deployment Guide

Sample Node.js/Express API deployed on AWS EC2 (Free Tier) with CI/CD, monitoring, and load testing.

## Architecture

```
GitHub (push to main)
      |
      v
GitHub Actions (build + test)
      |
      v (SSH deploy)
EC2 Instance (t2.micro, Ubuntu 22.04)
  ├── Nginx (port 80/443, reverse proxy)
  ├── Node.js app via PM2 (port 3000)
  ├── CloudWatch Agent (logs + metrics)
  └── Security Group (22, 80, 443 only)
      |
      v
CloudWatch (Dashboards, Alarms, Logs)

S3 Bucket -> static assets / backups
IAM Role  -> EC2 instance role (least privilege, S3 read/write only)
```

## Step 1: AWS Infrastructure Setup

1. **IAM**: Create a non-root IAM user with `AdministratorAccess` only for initial setup (or scoped policies: EC2FullAccess, S3FullAccess, CloudWatchFullAccess for setup). Never use root for daily work.
2. **VPC**: Use default VPC (Free Tier friendly).
3. **Security Group** (`devops-app-sg`):
   - Inbound: SSH (22) from your IP only, HTTP (80) from 0.0.0.0/0, HTTPS (443) from 0.0.0.0/0
   - Outbound: All traffic allowed
4. **EC2 Instance**:
   - AMI: Ubuntu Server 22.04 LTS
   - Type: t2.micro (Free Tier eligible)
   - Key pair: create new, download `.pem`, keep safe
   - Attach the security group above
   - Attach an IAM Role with S3 access (least privilege — only the bucket you create)
5. **S3 Bucket**: Create `devops-assignment-<yourname>-<random>` for backups/static assets.

## Step 2: Configure EC2

SSH into the instance:
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

Copy `scripts/ec2-setup.sh` to the instance and run it:
```bash
scp -i your-key.pem scripts/ec2-setup.sh ubuntu@<EC2_PUBLIC_IP>:~
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
chmod +x ec2-setup.sh
sudo ./ec2-setup.sh
```

This installs Node.js, PM2, Nginx (reverse proxy 80 → 3000), CloudWatch Agent, and Certbot.

## Step 3: Deploy the App (manual first run)

```bash
scp -i your-key.pem -r app ubuntu@<EC2_PUBLIC_IP>:~
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd app
npm install --production
pm2 start server.js --name devops-app
pm2 save
pm2 startup   # run the printed command to enable on-boot start
```

Verify: `curl http://localhost:3000/health` and `http://<EC2_PUBLIC_IP>/health` from your browser.

## Step 4: CI/CD with GitHub Actions

1. Push this repo to GitHub.
2. In repo **Settings → Secrets and variables → Actions**, add:
   - `EC2_HOST` = your EC2 public IP
   - `EC2_USER` = `ubuntu`
   - `EC2_SSH_KEY` = contents of your `.pem` file
3. Every push to `main` will now: install deps → run tests → SCP the build to EC2 → restart via PM2.
   Workflow file: `.github/workflows/deploy.yml`

## Step 5: HTTPS (optional but recommended for marks)

If you have a domain pointed to the EC2 IP:
```bash
sudo certbot --nginx -d yourdomain.com
```
Without a domain, note in your security summary that HTTPS was configured via Nginx/Certbot and would be enabled with a domain, or use an Application Load Balancer + ACM certificate as an alternative (mention both options in the report).

## Step 6: CloudWatch Monitoring

1. Attach IAM role `CloudWatchAgentServerRole` to the EC2 instance.
2. Configure the agent:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config -m ec2 -s \
     -c file:scripts/cloudwatch-agent-config.json
   ```
3. In AWS Console → CloudWatch:
   - Create a **Dashboard** with widgets: CPU Utilization, Memory, Network In/Out, Disk.
   - Create **Alarms**: CPU > 80% for 5 min → notify via SNS email.
   - Check **Log groups**: `/devops-assignment/app-out`, `/devops-assignment/nginx-access`.

## Step 7: Load Testing

Install k6: https://k6.io/docs/get-started/installation/

```bash
k6 run load-test/loadtest.js --env BASE_URL=http://<EC2_PUBLIC_IP>
```

This ramps from 10 → 50 → 100 concurrent users. Capture:
- **Latency** (avg, p95) — from k6 summary `http_req_duration`
- **Throughput** — `http_reqs` (requests/sec)
- **Error rate** — `http_req_failed`
- **CPU/Memory** — cross-reference with CloudWatch dashboard at the same timestamp

Export results for graphing:
```bash
k6 run --out json=results.json load-test/loadtest.js
```

## Step 8: Security Summary (for report)

- IAM: least-privilege instance role, no root usage, MFA enabled on root/IAM users
- Security Group: only 22 (restricted to your IP), 80, 443 open
- SSH key-based auth only, no password login
- HTTPS via Certbot/Nginx (or ALB+ACM)
- Secrets (SSH key, EC2 host) stored in GitHub Actions encrypted secrets, never in code
- OS packages kept updated (`apt update && upgrade` in setup script)

## Deliverables Checklist

- [ ] Git repository (this repo)
- [ ] Deployment guide (this README)
- [ ] Architecture diagram (`architecture-diagram.svg`)
- [ ] Pipeline config (`.github/workflows/deploy.yml`)
- [ ] Monitoring screenshots (CloudWatch dashboard, alarms, logs — take from console)
- [ ] Load testing report with graphs (k6 output + CloudWatch graphs)
- [ ] Security summary (section above, expand in final report)
- [ ] Demo video (5–10 min screen recording)
- [ ] Final report (PDF/DOCX)
test
