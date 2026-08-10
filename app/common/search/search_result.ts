/**
 * **Le contrat de sortie commun aux actions `Search*`** (slice 7 — recherche globale ⌘K).
 *
 * Une palette ⌘K n'affiche pas des annonces, des groupes et des branches : elle affiche des
 * *lignes*. Chaque action de recherche projette donc son model dans la **même** forme plate — un
 * libellé, un sous-titre, un identifiant — plutôt que de renvoyer onze view-models que le
 * controller devrait ensuite aplatir onze fois.
 *
 * Ce que ce contrat ne porte **pas** : l'URL de destination. Le chemin admin d'un résultat est une
 * affaire de routage du portail, pas du module métier — `#announcements/actions/search_announcements`
 * n'a pas à savoir que la surface Communications s'appelle `/admin/communications`. La
 * correspondance `type → URL` vit en **un seul endroit** (`#admin/support/search_destinations`),
 * ce qui la rend triviale à suivre quand l'arborescence du portail bouge.
 */

/**
 * Une ligne de résultat, indépendante du type de l'objet trouvé.
 *
 * - `id` — identifiant **stringifié** (uuid pour le contenu, entier des référentiels, ADR-0001) :
 *   la palette n'en fait rien d'autre que construire une URL.
 * - `label` — ce qui a matché, tel qu'on l'affiche (titre replié dans la langue de l'admin pour un
 *   champ multilingue, ADR-0023).
 * - `subtitle` — **contexte**, pas décoration : ce qui permet de distinguer deux « Culte du
 *   dimanche » (la date, la branche, le statut…). `null` quand il n'y a rien d'utile à dire.
 * - `branchId` — périmètre de la ligne (`null` = national ou objet non branché). Exposé pour que
 *   l'UI puisse pastiller la branche, et parce qu'il rend les tests de périmètre lisibles.
 */
export interface SearchHit {
  id: string
  label: string
  subtitle: string | null
  branchId: number | null
}

/**
 * Ce que renvoie une action `Search*` : la page de résultats **plafonnée**, et le **total** réel.
 *
 * Les deux, pas seulement la page : sans `total`, l'UI ne peut pas écrire « et 12 autres » et un
 * administrateur croit avoir tout vu alors qu'il voit cinq lignes sur dix-sept. Le total est
 * compté **après** application du périmètre RBAC — il ne fuite jamais l'existence de contenu hors
 * périmètre.
 */
export interface SearchResultSet {
  hits: SearchHit[]
  total: number
}

/** Réponse d'une action à qui l'on soumet une saisie refusée (trop courte) ou un périmètre vide. */
export const EMPTY_RESULT_SET: SearchResultSet = { hits: [], total: 0 }

/**
 * Plafond par type. Cinq lignes : au-delà, une palette ⌘K devient une liste — et c'est le rôle de
 * la surface dédiée, vers laquelle le « et N autres » renvoie.
 */
export const DEFAULT_SEARCH_LIMIT = 5
