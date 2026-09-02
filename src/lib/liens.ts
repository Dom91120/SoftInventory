/**
 * Découpe d'un texte libre en morceaux : du texte, et les adresses web qu'il
 * contient. Pure, pour que le rendu — un `<a>` par lien — reste trivial et que
 * la reconnaissance se teste sans navigateur.
 *
 * Reconnu : `http://…`, `https://…`, et `www.…` sans protocole — c'est ainsi
 * qu'on tape une adresse dans un descriptif, sans jamais y mettre `<a>`.
 * L'adresse s'arrête au premier blanc ; la ponctuation qui la FERME (« . »,
 * « , », « ) », « » »…) reste au texte, sinon « voir https://x.fr. » mènerait à
 * une page inexistante. Une parenthèse fermante n'est rendue au texte que si
 * l'adresse n'en ouvre pas — `https://fr.wikipedia.org/wiki/Nice_(ville)` se
 * garde entière.
 */
export type Segment =
  | { type: "texte"; valeur: string }
  | { type: "lien"; valeur: string; href: string };

const MOTIF = /\b(?:https?:\/\/|www\.)[^\s<>"'«»]+/gi;
const FERMANTE = /[.,;:!?)\]}]+$/;

export function decouperLiens(texte: string): Segment[] {
  const segments: Segment[] = [];
  let curseur = 0;
  for (const m of texte.matchAll(MOTIF)) {
    let adresse = m[0];
    const fin = FERMANTE.exec(adresse);
    if (fin) {
      // On rend les fermantes une à une, en gardant celles qui répondent à une
      // ouvrante dans l'adresse.
      let garde = adresse.length - fin[0].length;
      for (let i = garde; i < adresse.length; i++) {
        const c = adresse[i];
        const ouvrante = c === ")" ? "(" : c === "]" ? "[" : c === "}" ? "{" : null;
        if (ouvrante && compte(adresse.slice(0, i), ouvrante) > compte(adresse.slice(0, i), c)) {
          garde = i + 1;
        } else break;
      }
      adresse = adresse.slice(0, garde);
    }
    if (adresse === "") continue;
    const debut = m.index;
    if (debut > curseur) segments.push({ type: "texte", valeur: texte.slice(curseur, debut) });
    segments.push({
      type: "lien",
      valeur: adresse,
      // Sans protocole, l'adresse serait lue comme un chemin relatif de
      // l'application.
      href: /^https?:\/\//i.test(adresse) ? adresse : `https://${adresse}`,
    });
    curseur = debut + adresse.length;
  }
  if (curseur < texte.length) segments.push({ type: "texte", valeur: texte.slice(curseur) });
  return segments;
}

function compte(s: string, c: string): number {
  let n = 0;
  for (const x of s) if (x === c) n++;
  return n;
}
