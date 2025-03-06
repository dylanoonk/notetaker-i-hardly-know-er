#!/bin/bash

npm init -y
npm install express ejs multer adm-zip marked path fs cookie-parser

PASSWORD=$(openssl rand -base64 12)
USERNAME="notetaker"

cat > config.json <<EOF
{
  "username": "$USERNAME",
  "password": "$PASSWORD",
  "port": 3000,
  "https": false 
}
EOF

echo "Username and Password saved in config.json"