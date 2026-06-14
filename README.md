# Installation

## install node

# Download and install nvm:

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

# in lieu of restarting the shell

\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:

nvm install 24

# Verify the Node.js version:

node -v # Should print "v24.16.0".

# Verify npm version:

npm -v # Should print "11.13.0".

1. Download
2. create .env

```
DATABASE_URL="file:./election.db"
VOTE_ENCRYPTION_SECRET="12345678901234567890123456789012"
ADMIN_PASSWORD_SHA256="a020df4781afe008947d8390b74d0c84a4757ebf7548c078e942436433c32afb"
ADMIN_SESSION_SECRET="d718c16108328a234511f93f9a01633a0bb96c5fd90e620defa3b43ad8698190"
```

Default passswords:
admin123
pwd1
pwd2

3. `npm i`
4. `npm run prisma:generate`
5. `npm run dev -- -H 0.0.0.0`

