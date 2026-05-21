- Command to use to reset the admin user's 2FA in case you get locked out:
docker exec -it exchange_postgres psql -U exchange_user -d exchange_db -c "UPDATE users SET \"totpSecret\" = NULL, \"totpEnabled\" = false WHERE username = 'admin';"

- Command to unlock the admin account after too many failed login attempts:
docker exec exchange_redis redis-cli DEL locked:admin failedLogins:admin

- Command to install the system (run the install script, passing your GHCR personal access token as argument)

curl -fsSL "https://raw.githubusercontent.com/Ali-Younis/Currency_Exchange/main/exchange-system/deploy/install.sh" | bash -s -- "<YOUR_GITHUB_PAT>"