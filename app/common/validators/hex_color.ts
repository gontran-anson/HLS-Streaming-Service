import { HEX_COLOR_PATTERN } from '#mediatheque/support/teaching_color'
import vine from '@vinejs/vine'

/**
 * **Une couleur `#RRGGBB`**, et rien d'autre.
 *
 * Ni `rgb()`, ni un nom CSS, ni la forme courte `#abc` : la valeur est lue **telle quelle** par le
 * client Flutter (`Color(int.parse(hex, radix: 16))`). Une variante que le navigateur comprend
 * parfaitement n'y produit pas un rendu approximatif — elle y produit une exception. La borne est
 * donc posée au plus tôt, là où le message est encore lisible ; le CHECK en base est le dernier
 * filet, pas le premier.
 *
 * Sept caractères exactement, `maxLength` compris : la colonne fait `varchar(7)`.
 */
export const hexColor = () => vine.string().trim().regex(HEX_COLOR_PATTERN).maxLength(7)
