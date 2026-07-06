#!/bin/bash
# Run this once on a fresh EC2 instance (Ubuntu 22.04/24.04, Free Tier t2.micro/t3.micro)
# Usage: chmod +x ec2-setup.sh && sudo ./ec2-setup.sh

set -e

echo ">>> Updating system..."
sudo apt update -y && sudo apt upgrade -y

echo ">>> Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

echo ">>> Installing PM2 (process manager)..."
sudo npm install -g pm2

echo ">>> Installing Nginx (reverse proxy for port 80 -> 3000)..."
sudo apt install -y nginx

echo ">>> Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/devops-app > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/devops-app /etc/nginx/sites-enabled/devops-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ">>> Installing CloudWatch Agent..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

echo ">>> Installing Certbot (for HTTPS later, needs a domain name)..."
sudo apt install -y certbot python3-certbot-nginx

echo ">>> Setup complete!"
echo "Next steps:"
echo "1. Copy your app code to this instance (or let GitHub Actions do it)"
echo "2. cd app && npm install && pm2 start server.js --name devops-app && pm2 save"
echo "3. sudo pm2 startup   (then run the command it prints)"
echo "4. Configure CloudWatch agent with cloudwatch-agent-config.json"
echo "5. If you have a domain: sudo certbot --nginx -d yourdomain.com"
