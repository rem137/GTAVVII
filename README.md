# GTA VII — Prototype (Web)

Prototype jouable en HTML/CSS/JavaScript d'un mini bac à sable inspiré GTA.

## Lancer

Ouvrir `index.html` directement dans le navigateur, ou utiliser un serveur local:

```bash
python3 -m http.server 8000
```

Puis visiter `http://localhost:8000`.

## Contrôles

- `ZQSD` / `WASD`: déplacer le personnage
- `Shift`: sprinter
- `E`: entrer/sortir d'un véhicule (vol de voiture)
- `R`: recommencer après un game over

## Boucles de gameplay

- Voler des voitures augmente argent + niveau de recherche.
- La police chasse le joueur selon les étoiles de recherche.
- Mission de base: voler 3 voitures et atteindre 1000$ sans mourir.
