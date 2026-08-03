"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";

const profileSchema = z.object({
  prenom: z.string().trim().max(80, "Prénom trop long (80 caractères max)."),
  nom: z.string().trim().max(80, "Nom trop long (80 caractères max)."),
  tel: z.string().trim().max(30, "Téléphone trop long (30 caractères max)."),
});

/**
 * Mise à jour du profil. Passe par notre propre action plutôt que par
 * /update-user de Better Auth : la liste des champs modifiables est ainsi
 * fermée ICI (le hook serveur verrouille en plus role/ldap/email).
 */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    prenom: formData.get("prenom") ?? "",
    nom: formData.get("nom") ?? "",
    tel: formData.get("tel") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { prenom, nom, tel } = parsed.data;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { prenom, nom, tel, name: `${prenom} ${nom}`.trim() },
  });
  revalidatePath("/mon-compte");
  return { ok: true };
}
