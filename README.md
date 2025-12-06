🚴‍♂️ PulsePeak
Votre Directeur Sportif Personnel propulsé par l'IA.
PulsePeak est une application web moderne construite avec Next.js qui utilise l'intelligence artificielle (Google Gemini) pour générer, adapter et analyser des plans d'entraînement cycliste sur mesure.
L'application agit comme un véritable coach "World Tour", prenant en compte votre profil physiologique (FTP, PMA, Poids), vos disponibilités hebdomadaires et votre historique de performance pour créer une périodisation optimale.
✨ Fonctionnalités Clés
🧠 Planification Intelligente
• Génération IA : Création de blocs d'entraînement (ex: 3 semaines de charge + 1 semaine de récupération) adaptés à un objectif spécifique (Gran Fondo, Critérium, Endurance...).
• Adaptabilité : L'IA analyse votre historique récent (conformité, RPE) pour ajuster la charge du prochain bloc.
• Double Version : Chaque séance est générée avec une variante Outdoor (Route) et Indoor (Home Trainer).
📊 Profil & Physiologie
• Calculateur de Zones Avancé : Utilisation du modèle de Puissance Critique (Critical Power) si plusieurs tests sont disponibles (5', 8', 15', 20') pour déterminer votre FTP et votre W' (réserve anaérobie) avec précision.
• Gestion des Disponibilités : Définissez vos heures disponibles pour chaque jour de la semaine ; l'IA respectera strictement ces contraintes pour calculer le volume cible.
📅 Calendrier Interactif
• Suivi : Marquez vos séances comme "Faites", "Ratées" ou "À faire".
• Feedback : Saisissez votre RPE (Ressenti), la durée réelle et la distance pour nourrir l'algorithme.
• Flexibilité : Déplacez une séance, échangez deux séances ou régénérez une séance spécifique via l'IA si elle ne vous convient pas.
• Ajout Manuel : Ajoutez des sorties libres non prévues au programme.
📈 Analyse de Performance (Dashboard Directeur Sportif)
• KPIs : Suivi du TSS (Training Stress Score), du volume horaire et de la distance.
• Santé : Surveillance de l'indice de Monotonie pour prévenir le surentraînement.
• Comparatif : Graphiques visuels comparant le "Planifié" vs "Réalisé" sur une période donnée ou sur la saison entière.
🛠️ Stack Technique
• Framework : Next.js 14+ (App Router, Server Components, Server Actions).
• Langage : TypeScript.
• Styling : Tailwind CSS & Lucide React (Icônes).
• IA : Google Gemini API (gemini-2.5-flash).
• Base de Données : Système de fichiers local (JSON) pour une portabilité maximale et une simplicité de déploiement (simule une NoSQL DB).
🚀 Installation et Démarrage
Prérequis
• Node.js 18+ installé.
• Une clé API Google Gemini (gratuite via Google AI Studio).
1. Cloner le projet
