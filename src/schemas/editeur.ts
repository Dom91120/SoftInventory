import { z } from "zod";

const texte = (max: number, quoi: string) =>
  z.string().trim().max(max, `${quoi} : ${max} caractères max.`);

const emailOptionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Adresse trop longue (${max} caractères max).`)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse e-mail invalide.");

const urlOptionnelle = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `URL trop longue (${max} caractères max).`)
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/i.test(v),
      "URL invalide (elle doit commencer par http:// ou https://).",
    );

/** Fiche éditeur/fournisseur, canaux de support compris. */
export const editeurSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom de l'éditeur est obligatoire.")
    .max(150, "Nom trop long (150 caractères max)."),
  adresse: texte(300, "Adresse"),
  codePostal: texte(10, "Code postal"),
  ville: texte(120, "Ville"),
  telephone: texte(30, "Téléphone standard"),
  email: emailOptionnel(200),
  siteWeb: urlOptionnelle(300),
  supportUrl: urlOptionnelle(300),
  supportEmail: emailOptionnel(200),
  supportTelephone: texte(30, "Tél du support"),
  numeroClient: texte(60, "N° de client"),
  supportHoraires: texte(200, "Horaires du support"),
  supportHoraires2: texte(200, "Horaires du support (2ᵉ ligne)"),
  commercialContact: texte(120, "Contact commercial"),
  commercialTelephone: texte(30, "Tél commercial"),
  commercialEmail: emailOptionnel(200),
  commercialContact2: texte(120, "Contact commercial 2"),
  commercialTelephone2: texte(30, "Tél commercial 2"),
  commercialEmail2: emailOptionnel(200),
  adminContact: texte(120, "Contact administratif"),
  adminTelephone: texte(30, "Tél administratif"),
  adminEmail: emailOptionnel(200),
  dpoContact: texte(120, "DPO"),
  dpoTelephone: texte(30, "Tél DPO"),
  dpoEmail: emailOptionnel(200),
  notes: texte(4000, "Observations"),
});
export type EditeurInput = z.infer<typeof editeurSchema>;
