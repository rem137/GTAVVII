# GTA VII — Neon Streets (Prototype prêt à présenter)

Version améliorée du prototype avec une boucle de gameplay plus proche d'un vertical slice publiable.

## Nouveautés majeures

- Campagne de 4 missions (vols, éliminations, collecte, extraction finale)
- Système de tir (joueur + ennemis gangs + police)
- Wanted level adaptatif avec unités de police actives selon le niveau
- Pickups dynamiques (cash / armure)
- Mini-map temps réel
- Cycle visuel jour/nuit
- Pause/menu de démarrage + live feed d'événements

## Lancer

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Contrôles

- `ZQSD` / `WASD` : déplacement
- `Shift` : sprint
- `Espace` : dash
- `E` : interagir / entrer-sortir véhicule
- `Clic gauche` : tirer
- `P` : pause

## Objectif

Terminer les 4 missions de la campagne puis continuer en mode libre.
