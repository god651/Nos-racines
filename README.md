# NOS RACINES — application Android

Le patrimoine familial numérique et vivant : un arbre où chaque visage a une voix, une histoire et un mémorial.

L'application s'installe sur les téléphones Android comme une application normale. Elle marche sans Internet. La famille reste dans le téléphone : ce dépôt GitHub contient uniquement le code, jamais les photos, les voix ni les fiches.

---

## Comment arrivent les mises à jour (réservé au créateur)

Seul le propriétaire de ce dépôt GitHub peut envoyer une mise à jour. Les téléphones ne reçoivent que ce qu'il publie.

1. **Demander le changement à Claude.** Claude modifie le code et l'envoie sur ce dépôt.
2. **La fabrication se fait toute seule** (onglet *Actions*, environ 10 minutes). Elle prépare un **brouillon** dans l'onglet *Releases* avec trois fichiers :
   - `nos-racines.apk` : l'application à installer ;
   - `mise-a-jour.zip` : la mise à jour, qui arrive directement dans l'application ;
   - `latest.json` : le petit bulletin que les téléphones consultent.
3. **Vous vérifiez, puis vous publiez.** Dans *Releases*, ouvrez le brouillon, cliquez sur le crayon (*Edit*), puis sur **Publish release**.
4. **Sur les téléphones.** À la prochaine ouverture avec Internet, un bandeau « Nouvelle version prête » apparaît. Un toucher sur *Installer* suffit, et un mot « Nouveautés » s'affiche ensuite.

Tant que vous n'avez pas publié, rien ne bouge. Pour annuler une version publiée, supprimez-la dans *Releases* : la précédente redevient la dernière.

Si une mise à jour ne démarre pas correctement, le téléphone revient tout seul à la version d'avant. Les données de la famille ne sont jamais touchées par une mise à jour.

### Le texte « Nouveautés »

Le fichier `notes-version.txt` contient le message montré à la famille après la mise à jour. Claude le remplit à chaque changement.

### Changements qui demandent de réinstaller

C'est rare : cela arrive seulement quand une nouvelle fonction du téléphone est ajoutée. Dans ce cas, Claude augmente `minApk` dans `natif.json`, et les téléphones proposent alors de *Télécharger* la nouvelle application au lieu de l'installer directement.

---

## Installer l'application sur un téléphone

1. Sur le téléphone, ouvrez `https://github.com/<votre-nom>/nos-racines/releases/latest/download/nos-racines.apk`.
2. Ouvrez le fichier téléchargé. Android demande d'autoriser l'installation depuis Chrome : acceptez.
3. L'icône **Nos Racines** apparaît avec les autres applications.

Une fois l'application installée, *Paramètres → À propos → Installer l'application chez un proche* montre un QR code qui mène au même lien.

---

## La clé de signature et la photo du générique

Chaque version est signée avec la même clé, ce qui permet de mettre à jour l'application sans la désinstaller. La clé (`secrets/nos-racines.keystore`) et la photo du générique (`secrets/visage-pere.jpg.enc`) sont dans le dépôt, mais **verrouillées** : sans le mot de passe, elles sont inutilisables et illisibles.

Le mot de passe est rangé dans les secrets du dépôt (*Settings → Secrets and variables → Actions*), sous le nom `NR_KEYSTORE_PASSWORD`. Ne le supprimez pas, ne le montrez à personne, et gardez-en une copie (papier ou gestionnaire de mots de passe).

---

## Pour un développeur

```
npm ci
npx vite                 # version web de développement
npx vite build           # application web dans dist/
npx cap sync android     # copie dans le projet Android
```

Fabrication complète : `.github/workflows/fabrication.yml`.
