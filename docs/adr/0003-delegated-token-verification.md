# Authentification entièrement déléguée à un endpoint HTTP configurable

Ce service n'a **aucune connaissance locale** de l'authentification : il ne détient ni
secret partagé, ni clé de vérification de signature. Un middleware **relaie** le token reçu
vers un **endpoint de vérification configurable** (`AUTH_VERIFY_URL`) et considère la
requête authentifiée si la réponse correspond à ce qu'on attend — **statut HTTP attendu**,
et optionnellement un **corps de réponse** spécifique. La stratégie est enfichable derrière
une interface `TokenVerifier` : on branche `new-life-server` ou tout autre service sans
toucher les contrôleurs.

## Considered Options

Une **vérification locale de signature asymétrique** (JWT signé par `new-life-server`,
clé publique ici) rendrait le service autonome sur le chemin de chaque requête. Rejetée :
on veut un service **ignorant des identités**, qui délègue *tout* et reste configurable
vers n'importe quel émetteur. L'autonomie est obtenue autrement (le service tourne même
si on pointe le vérificateur ailleurs), pas en embarquant de la crypto d'auth.

## Consequences

- Le service **ne connaît pas l'identité** de l'appelant. L'autorisation du canal SSE
  `transcodes/${id}` se réduit donc à « token valide » — pas de cloisonnement par
  propriétaire (aucun `owner_id` sur le Transcode). Un cloisonnement futur passera par
  l'exploitation du corps de réponse du vérificateur.
- La vérification appelant un service distant à chaque requête, un **cache court** (Redis,
  TTL ~30–60 s, clé = token) absorbe les rafales de polling/SSE.
- Une panne du vérificateur rend le service inaccessible : c'est un couplage assumé.
