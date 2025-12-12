/*
# 🚴‍♂️ PulsePeak

**Votre Directeur Sportif Personnel propulsé par l'IA.**

PulsePeak est une application web moderne construite avec **Next.js** qui utilise l'intelligence artificielle (**Google Gemini**) pour générer, adapter et analyser des plans d'entraînement cycliste sur mesure.

L'application agit comme un véritable coach "World Tour", prenant en compte votre profil physiologique (FTP, PMA, Poids), vos disponibilités hebdomadaires et votre historique de performance pour créer une périodisation optimale.

## ✨ Fonctionnalités Clés

### 🧠 Planification Intelligente
- **Génération IA :** Création de blocs d'entraînement (ex: 3 semaines de charge + 1 semaine de récupération) adaptés à un objectif spécifique (Gran Fondo, Critérium, Endurance...).
- **Adaptabilité :** L'IA analyse votre historique récent (conformité, RPE) pour ajuster la charge du prochain bloc.
- **Double Version :** Chaque séance est générée avec une variante **Outdoor** (Route) et **Indoor** (Home Trainer).

### 📊 Profil & Physiologie
- **Calculateur de Zones Avancé :** Utilisation du modèle de **Puissance Critique** (Critical Power) si plusieurs tests sont disponibles (5', 8', 15', 20') pour déterminer votre FTP et votre W' (réserve anaérobie) avec précision.
- **Gestion des Disponibilités :** Définissez vos heures disponibles pour chaque jour de la semaine ; l'IA respectera strictement ces contraintes pour calculer le volume cible.

### 📅 Calendrier Interactif
- **Suivi :** Marquez vos séances comme "Faites", "Ratées" ou "À faire".
- **Feedback :** Saisissez votre RPE (Ressenti), la durée réelle et la distance pour nourrir l'algorithme.
- **Flexibilité :** Déplacez une séance, échangez deux séances ou régénérez une séance spécifique via l'IA si elle ne vous convient pas.
- **Ajout Manuel :** Ajoutez des sorties libres non prévues au programme.

### 📈 Analyse de Performance (Dashboard Directeur Sportif)
- **KPIs :** Suivi du TSS (Training Stress Score), du volume horaire et de la distance.
- **Santé :** Surveillance de l'indice de **Monotonie** pour prévenir le surentraînement.
- **Comparatif :** Graphiques visuels comparant le "Planifié" vs "Réalisé" sur une période donnée ou sur la saison entière.

## 🛠️ Stack Technique

- **Framework :** [Next.js 14+](https://nextjs.org/) (App Router, Server Components, Server Actions).
- **Langage :** TypeScript.
- **Styling :** [Tailwind CSS](https://tailwindcss.com/) & [Lucide React](https://lucide.dev/) (Icônes).
- **IA :** Google Gemini API (`gemini-2.5-flash`).
- **Base de Données :** Système de fichiers local (JSON) pour une portabilité maximale et une simplicité de déploiement (simule une NoSQL DB).

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+ installé.
- Une clé API Google Gemini (gratuite via Google AI Studio).

### 1. Cloner le projet
```bash
git clone [https://github.com/votre-pseudo/pulsepeak.git](https://github.com/votre-pseudo/pulsepeak.git)
cd pulsepeak
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration des Variables d'Environnement
Créez un fichier `.env.local` à la racine du projet et ajoutez votre clé API :

```env
GEMINI_API_KEY="VOTRE_CLE_API_ICI"
```

### 4. Initialiser les données locales
Assurez-vous que le dossier pour la base de données JSON existe (il sera utilisé pour stocker le profil et le calendrier).
```bash
mkdir -p src/lib/data
```

### 5. Lancer le serveur de développement
```bash
npm run dev
```
Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 📂 Structure du Projet

L'architecture suit une approche "Feature-First" pour une meilleure maintenabilité.

```
src/
├── app/
│   ├── actions/              # Server Actions (Logique métier backend)
│   │   └── schedule.ts       # Gestion du calendrier, appels IA, sauvegardes
│   ├── page.tsx              # Page principale (Client Wrapper)
│   └── layout.tsx            # Layout global
│
├── components/
│   ├── ui/                   # Composants Design System (Boutons, Cards, Modales...)
│   └── features/             # Composants Métier
│       ├── calendar/         # Vue Calendrier, Modal Génération
│       ├── workout/          # Détails séance, Feedback, Ajout Manuel
│       ├── profile/          # Formulaire profil, Calcul Zones
│       └── stats/            # Dashboard Analyse
│
└── lib/
    ├── ai/                   # Intégration API Gemini & Prompts
    ├── data/                 # Types TypeScript & CRUD JSON
    └── utils.ts              # Fonctions utilitaires (Dates, Formatage)
```

## 🤖 Le Prompt Engineering

Le "cerveau" de PulsePeak réside dans `src/lib/ai/coach-api.ts`. Le prompt est structuré pour forcer l'IA à :
1.  Agir comme un coach UCI.
2.  Analyser la conformité passée (si vous roulez moins que prévu, elle réduit le volume futur).
3.  Respecter une périodisation 3+1 (Charge/Récup) par défaut, ou adaptée au thème.
4.  Utiliser des descriptions précises basées sur les **Zones de Puissance** (Watts) calculées.
5.  Retourner un format JSON strict pour une intégration directe dans l'interface.

## 📝 Notes

Les données sont stockées dans `src/lib/data/*.json`. En production sur Vercel, ce système de fichier est éphémère (les données seront perdues au redéploiement). Pour une persistance réelle en production, il est recommandé de remplacer les fonctions dans `crud.ts` pour pointer vers une base de données comme Firebase, Supabase ou MongoDB.

## 📄 Licence

Distribué sous la licence MIT.
*/