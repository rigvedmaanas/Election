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
ADMIN_PASSWORD_SHA256="240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
ADMIN_SESSION_SECRET="change-this-admin-session-secret"
RESULT_KEY_ONE_SHA256="6eac1114aa783f6549327e7d01f63752995da7b31f1f37092b7dcb9f49cf5651"
RESULT_KEY_TWO_SHA256="149d2937d1bce53fa683ae652291bd54cc8754444216a9e278b45776b76375af"
RESULT_SESSION_SECRET="change-this-result-session-secret"
```

Default passswords:
admin123
pwd1
pwd2

3. `npm i`
4. `npm run dev`

## Erase database

That clears all candidates and votes, and locks the kiosk.

`sqlite3 prisma/election.db "DELETE FROM EncryptedVote; DELETE FROM Candidate; UPDATE KioskState SET status = 'LOCKED', active_class = NULL WHERE id = 1;"`

If you only want to clear votes/results but keep candidates:

`sqlite3 prisma/election.db "DELETE FROM EncryptedVote; UPDATE KioskState SET status = 'LOCKED', active_class = NULL WHERE id = 1;"`
