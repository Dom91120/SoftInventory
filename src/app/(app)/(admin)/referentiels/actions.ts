"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import {
  categorieDocumentSchema,
  criticiteSchema,
  serveurSchema,
  serviceUtilisateurSchema,
  statutLogicielSchema,
  technologieSchema,
  typeTacheSchema,
} from "@/schemas/referentiels";
import { requireRole } from "@/server/guards";
import * as refs from "@/server/services/referentiels";

// Actions génériques des référentiels. L'entité est une CLÉ d'un registre fermé
// (jamais un nom de table libre) : le client ne peut désigner que ce qui est
// listé ici. Pattern : guard → parse → service → revalidatePath → {ok|error}.

type Registry = {
  // biome-ignore lint/suspicious/noExplicitAny: registre hétérogène, typé à l'usage par entité.
  schema: z.ZodType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: idem.
  create?: (data: any) => Promise<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: idem.
  update: (id: number, data: any) => Promise<unknown>;
  remove?: (id: number) => Promise<unknown>;
  /**
   * Référentiel à liste FIGÉE : les lignes s'éditent mais ne s'ajoutent ni ne
   * se suppriment. L'écran masque déjà les commandes correspondantes ; ce
   * drapeau est la garde côté serveur, seule opposable à un appel direct.
   */
  fige?: true;
};

const REGISTRY = {
  services: {
    schema: serviceUtilisateurSchema,
    create: refs.createServiceUtilisateur,
    update: refs.updateServiceUtilisateur,
    remove: refs.deleteServiceUtilisateur,
  },
  serveurs: {
    schema: serveurSchema,
    create: refs.createServeur,
    update: refs.updateServeur,
    remove: refs.deleteServeur,
  },
  technologies: {
    schema: technologieSchema,
    create: refs.createTechnologie,
    update: refs.updateTechnologie,
    remove: refs.deleteTechnologie,
  },
  criticites: {
    schema: criticiteSchema,
    create: refs.createCriticite,
    update: refs.updateCriticite,
    remove: refs.deleteCriticite,
  },
  "types-taches": {
    schema: typeTacheSchema,
    create: refs.createTypeTache,
    update: refs.updateTypeTache,
    remove: refs.deleteTypeTache,
  },
  categories: {
    schema: categorieDocumentSchema,
    create: refs.createCategorieDocument,
    update: refs.updateCategorieDocument,
    remove: refs.deleteCategorieDocument,
  },
  statuts: {
    schema: statutLogicielSchema,
    update: refs.updateStatutLogiciel,
    fige: true,
  },
} satisfies Record<string, Registry>;

export type RefEntity = keyof typeof REGISTRY;

type Result = { ok: true } | { ok: false; error: string };

/** Traduit les erreurs Prisma prévisibles en messages lisibles. */
function messageErreur(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return "Cette valeur existe déjà dans ce référentiel.";
  if (code === "P2003") {
    return "Suppression impossible : cette valeur est encore utilisée par l'inventaire.";
  }
  console.error("[referentiels] erreur inattendue:", e);
  return "Une erreur est survenue. Réessayez.";
}

function entry(entity: RefEntity): Registry {
  const found = REGISTRY[entity];
  if (!found) throw new Error("Référentiel inconnu.");
  return found;
}

export async function createRefAction(
  entity: RefEntity,
  input: Record<string, unknown>,
): Promise<Result> {
  await requireRole("admin");
  const parsed = entry(entity).schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const def = entry(entity);
  if (!def.create) return { ok: false, error: "Ce référentiel n'accepte pas d'ajout." };
  try {
    await def.create(parsed.data);
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
  revalidatePath("/referentiels");
  return { ok: true };
}

export async function updateRefAction(
  entity: RefEntity,
  id: number,
  input: Record<string, unknown>,
): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const parsed = entry(entity).schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  try {
    await entry(entity).update(id, parsed.data);
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
  revalidatePath("/referentiels");
  return { ok: true };
}

export async function deleteRefAction(entity: RefEntity, id: number): Promise<Result> {
  await requireRole("admin");
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: "Identifiant invalide." };
  const def = entry(entity);
  if (!def.remove) return { ok: false, error: "Ce référentiel n'accepte pas de suppression." };
  try {
    await def.remove(id);
  } catch (e) {
    return { ok: false, error: messageErreur(e) };
  }
  revalidatePath("/referentiels");
  return { ok: true };
}
