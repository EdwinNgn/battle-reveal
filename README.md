# BABY BATTLE — Le grand jeu du gender reveal

Un jeu de combat d'arcade original, à jouer sur ordinateur ou téléphone, dont le
vainqueur révèle le sexe du bébé. Deux équipes : **TEAM BOY** et **TEAM GIRL**.
Toute la salle joue pour une seule équipe, l'ordinateur défend l'autre, et chaque
combat gagné rapporte un point. À la fin, l'équipe en tête déclenche la
révélation.

Aucune installation pour les invités : un lien suffit.

---

## 1. Régler le sexe du bébé

**C'est la seule chose à modifier.** Ouvrez `src/config/secretConfig.ts` et
changez la ligne encadrée par les flèches :

```typescript
const BABY_GENDER = "girl" as BabyGender;   // ou "boy"
```

C'est tout. L'équipe correspondante finira toujours en tête, et le jeu affichera
**C'EST UNE FILLE !** ou **C'EST UN GARÇON !**

> ⚠️ **Ne faites pas cette modification devant vos invités**, et voyez la section
> 3 avant de publier le code sur GitHub.

---

## 2. Déployer

### Option A — GitHub Pages (gratuit, recommandé)

Un workflow est déjà configuré dans `.github/workflows/deploy.yml` : il vérifie,
construit et publie le jeu à chaque `push`.

```bash
git init
git add .
git commit -m "BABY BATTLE"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/battle-reveal.git
git push -u origin main
```

Puis dans les réglages du dépôt : **Settings → Pages → Source → GitHub Actions**.

Au bout d'une minute ou deux, le jeu est en ligne à l'adresse
`https://VOTRE-COMPTE.github.io/battle-reveal/`.

### Option B — Netlify ou Vercel

Encore plus simple, et le dépôt peut rester privé :

```bash
npm run build
```

Puis glissez le dossier `dist/` sur [app.netlify.com/drop](https://app.netlify.com/drop).
Aucun compte n'est nécessaire pour un déploiement rapide.

Avec la CLI Vercel : `npx vercel --prod` depuis le dossier du projet.

### Option C — un simple partage de fichiers

`dist/` ne contient que trois fichiers et aucune dépendance réseau. N'importe
quel hébergement statique fonctionne, y compris un partage de dossier.

---

## 3. Garder le secret

Le jeu prend soin de ne pas trahir la réponse : les textes de révélation sont
encodés dans le fichier compilé, les deux langues et les deux issues sont
toujours présentes, et la valeur de configuration n'apparaît nulle part en clair.
Vérifié automatiquement à chaque build.

**Mais tout cela tombe si votre dépôt GitHub est public**, puisque
`secretConfig.ts` y serait lisible en clair. Trois solutions :

1. **Dépôt privé.** GitHub Pages fonctionne avec les dépôts privés sur les
   comptes payants ; sinon utilisez Netlify ou Vercel, qui déploient depuis un
   dépôt privé gratuitement.
2. **Pas de dépôt du tout.** Construisez en local (`npm run build`) et déposez
   `dist/` sur Netlify. C'est le plus sûr et le plus rapide.
3. **Dépôt public assumé**, si vous êtes certain que personne n'ira chercher.

Reste une évidence : ne prêtez pas votre ordinateur déverrouillé à la personne la
plus curieuse de la soirée.

---

## 4. Jouer

### Déroulement d'une partie

```
TITRE → NOMBRE DE JOUEURS → CHOISIR SON ÉQUIPE
  ↓
JOUEUR 1 → combat → point
JOUEUR 2 → combat → point
  ...
  ↓
COMBAT FINAL → C'EST UNE FILLE / UN GARÇON !
```

L'équipe est choisie **une seule fois** pour tout le groupe. Chaque participant
joue ensuite un combat à son tour.

- **Nombre impair de joueurs** : le dernier joue le combat décisif.
- **Nombre pair** : tout le monde joue, le score finit à égalité, et un **combat
  final** supplémentaire départage. N'importe qui peut le jouer.

### Commandes

**Ordinateur**

| Touche | Action |
|---|---|
| ← → | Se déplacer |
| ↑ | Sauter |
| S | Coup de poing |
| D | Coup de pied |
| F | Coup puissant |
| Espace | Garde |

Les touches WASD/ZQSD et JKL fonctionnent aussi. Le jeu s'adapte aux claviers
AZERTY et QWERTY.

**Téléphone** — tenez l'appareil en paysage : les boutons tactiles apparaissent
pendant le combat, déplacements à gauche, attaques à droite.

### Langue

Le jeu est en français par défaut. Le drapeau en haut à droite de l'écran titre
(ou l'option dans les réglages) bascule en anglais. Le choix est mémorisé.

---

## 5. Développement

```bash
npm install
npm run dev          # serveur local sur http://localhost:5173
npm run build        # génère dist/
npm run preview      # prévisualise le build
```

### Vérifications

```bash
npm run verify           # logique du jeu, sans navigateur
npm run verify:browser   # rendu, commandes, mobile, langues (nécessite Chrome)
```

`npm run verify` tourne automatiquement avant chaque déploiement : si la garantie
du résultat ou les compteurs se cassent, la publication échoue au lieu d'envoyer
un jeu défectueux en soirée.

Quelques vérifications notables :

- **`proveDirector.mjs`** — parcourt toutes les séquences de résultats possibles
  et prouve que les combats réguliers finissent toujours à égalité.
- **`runTeamSimulations.ts`** — joue 720 sessions complètes avec de vrais combats
  simulés et des joueurs de niveaux variés, pour les deux configurations.
- **`keyCheck.mjs` / `playabilityCheck.mjs`** — teste chaque touche sur AZERTY et
  QWERTY, puis vérifie dans un vrai navigateur que le combattant réagit.
- **`i18nCheck.mjs`** — contrôle que rien ne déborde à l'écran dans les deux
  langues, le canvas ayant des tailles de texte fixes.

### Outils de développement

En mode `npm run dev` uniquement : `Ctrl+Shift+D` ouvre un panneau qui simule des
centaines de matchs et confirme que l'équipe désignée gagne toujours, pour les
deux réglages possibles. Absent du build de production.

### Équilibrage

Le jeu garantit le résultat final sans truquer chaque combat. Un `ScoreDirector`
décide avant chaque match du niveau d'intervention :

- **libre** — aucune interférence, le meilleur gagne ;
- **léger** — modificateurs discrets, perdable dans les deux sens ;
- **décidé** — résultat garanti.

Les premiers combats sont laissés totalement libres tant que l'égalité reste
atteignable. À 8 participants, entre 4 et 7 combats sur 9 sont réellement
imprévisibles, et seul le combat final est garanti.

---

## 6. Contenu original

Tous les visuels, sons et musiques sont générés par le code : sprites dessinés en
primitives sur canvas, audio synthétisé via la Web Audio API. Aucun fichier
externe, aucune police à télécharger, rien d'emprunté à un jeu existant. Le
dossier `dist/` pèse environ 25 ko compressé.
