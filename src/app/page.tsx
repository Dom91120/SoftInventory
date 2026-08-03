import { redirect } from "next/navigation";

// La racine ne porte aucun écran : l'accueil des connectés est le tableau de
// bord, et requireUser (dans le layout du groupe) renvoie les autres au login.
export default function Home() {
  redirect("/tableau-de-bord");
}
