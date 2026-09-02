import { decouperLiens } from "@/lib/liens";

/**
 * Un texte libre dont les adresses web sont cliquables. Pour la LECTURE d'un
 * champ long — un `<textarea>` ne sait pas souligner un lien, il ne montre que
 * des lettres. Retours à la ligne et espaces sont gardés tels que tapés.
 */
export function TexteAvecLiens({ texte, className }: { texte: string; className?: string }) {
  const segments = decouperLiens(texte);
  return (
    <div className={`whitespace-pre-wrap break-words ${className ?? ""}`}>
      {segments.map((s, i) =>
        s.type === "lien" ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {s.valeur}
          </a>
        ) : (
          <span key={i}>{s.valeur}</span>
        ),
      )}
    </div>
  );
}
