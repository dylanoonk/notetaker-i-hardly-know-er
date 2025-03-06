#!/bin/bash

npm init -y
npm install express ejs multer adm-zip marked path fs cookie-parser

password=$(openssl rand -base64 12)
username="notetaker"

cat > config.json <<EOF
{
  "username": "$username",
  "password": "$password",
  "port": 3000,
  "secureCookie": false 
}
EOF

echo "Username and Password saved in config.json"