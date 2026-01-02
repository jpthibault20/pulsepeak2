@echo off
TITLE Next.js Dev Server
echo Lancement du projet Next.js...

:: Ouvre le navigateur par defaut sur l'adresse locale
:: On attend 3 secondes pour laisser au serveur le temps de demarrer
start http://localhost:3000

:: Lance la commande npm
npm run dev

pause