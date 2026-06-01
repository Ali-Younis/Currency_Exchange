- Command to use to reset the admin user's 2FA in case you get locked out:
docker exec -it exchange_postgres psql -U exchange_user -d exchange_db -c "UPDATE users SET \"totpSecret\" = NULL, \"totpEnabled\" = false WHERE username = 'Awad';"

- Command to unlock the admin account after too many failed login attempts:
docker exec exchange_redis redis-cli DEL locked:admin failedLogins:admin

- Command to install the system (run the install script, passing your GHCR personal access token as argument)
curl -fsSL "https://raw.githubusercontent.com/Ali-Younis/Currency_Exchange/main/exchange-system/deploy/install.sh" | bash -s -- "TOKEN"

- Change password of admin user: 
Searched for text `bcrypt|hashPassword|password` (`**/exchange-system/apps/api/src`), no results

Searched for text `bcrypt|hashPassword|password` (`**/exchange-system/apps/api/src`), no results

Ran terminal command:  grep -r "bcrypt\|hashPassword\|hash" /Users/aliyounis/Currency_Exchange/exchange-system/apps/api/src --include="*.ts" -l

Ran terminal command:  grep -n "bcrypt\|hash\|rounds\|saltRounds" /Users/aliyounis/Currency_Exchange/exchange-system/apps/api/src/auth/auth.service.ts | head -20

Ran terminal command:  grep -n "SALT_ROUNDS" /Users/aliyounis/Currency_Exchange/exchange-system/apps/api/src/auth/auth.service.ts | head -5

Passwords are hashed with **bcryptjs** (12 rounds) stored in `passwordHash`. You need to generate the hash first using the API container (which already has bcryptjs), then update the DB:

**Step 1 — generate the bcrypt hash** (replace `YourNewPassword` with the actual password):
```bash
NEW_HASH=$(docker exec exchange_api node -e "require('bcryptjs').hash('YourNewPassword', 12).then(h => process.stdout.write(h))")
```

**Step 2 — write it to the database:**
```bash
docker exec exchange_postgres psql -U exchange_user -d exchange_db \
  -c "UPDATE users SET \"passwordHash\" = '${NEW_HASH}', \"mustChangePassword\" = false WHERE username = 'admin';"
```

Or as a single combined command:
```bash
docker exec exchange_postgres psql -U exchange_user -d exchange_db \
  -c "UPDATE users SET \"passwordHash\" = '$(docker exec exchange_api node -e "require('bcryptjs').hash('Rmxexchange@123', 12).then(h => process.stdout.write(h))")', \"forcePasswordChange\" = false WHERE username = 'admin';"
```

Set `mustChangePassword = false` to skip the forced-change prompt on next login, or set it to `true` if you want the user to be prompted to change it themselves.
