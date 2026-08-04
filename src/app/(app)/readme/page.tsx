import { readFile } from "node:fs/promises";
import { join } from "node:path";
import MarkdownIt from "markdown-it";
import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/guards";

export const metadata: Metadata = { title: "README" };

/**
 * `html: false` : le Markdown source ne peut pas injecter de HTML, il est
 * échappé. Le README vient du dépôt et non d'une saisie, mais la page passe le
 * résultat à `dangerouslySetInnerHTML` — autant que la seule voie d'injection
 * possible soit fermée par construction plutôt que par confiance.
 *
 * `linkify` transforme les URL nues en liens ; le README en contient.
 */
const md = new MarkdownIt({ html: false, linkify: true });

/**
 * Le README du dépôt, rendu dans l'application.
 *
 * Lu sur le DISQUE à chaque affichage plutôt qu'embarqué à la compilation :
 * le fichier reste éditable sans reconstruire, et le rendu suit. En Docker
 * (`output: standalone`), le traceur ne l'embarque pas tout seul — le
 * Dockerfile le copie explicitement, sans quoi cette page serait vide.
 */
export default async function ReadmePage() {
  await requireUser();

  let source: string | null = null;
  try {
    source = await readFile(join(process.cwd(), "README.md"), "utf8");
  } catch {
    // Fichier absent : on le dit plutôt que de faire tomber la page. Le cas
    // signale un déploiement incomplet, pas une erreur de l'utilisateur.
    source = null;
  }

  return (
    <>
      <PageHeader title="README" subtitle="La documentation du dépôt, telle qu'elle y figure" />
      <Card>
        {source === null ? (
          <EmptyState>
            README.md est introuvable sur le serveur. En production, vérifiez que le Dockerfile le
            copie bien dans l'image.
          </EmptyState>
        ) : (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML produit par markdown-it depuis un fichier du dépôt, avec `html: false` — aucune balise du source n'est interprétée.
          <div className="markdown" dangerouslySetInnerHTML={{ __html: md.render(source) }} />
        )}
      </Card>
    </>
  );
}
