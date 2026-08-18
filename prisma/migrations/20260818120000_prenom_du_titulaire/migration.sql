-- Le prénom prend sa colonne, à côté de la civilité et pour la même raison :
-- c'est le NOM qui trie une liste de titulaires et qu'on y cherche. Deux fiches
-- le portaient encore collé au patronyme (« LARFA Idriss », « MILLARD REVENEAU
-- Marie-Christine ») ; leur reprise se fait à la main, il n'y a pas de règle
-- sûre pour deviner où finit un nom composé et où commence un prénom.
--
-- Vide par défaut, et vide pour toujours sur un certificat de machine.
ALTER TABLE "certificats" ADD COLUMN     "prenom" TEXT NOT NULL DEFAULT '';
