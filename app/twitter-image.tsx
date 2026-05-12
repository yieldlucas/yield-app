// Twitter card image — réutilise exactement le visuel OpenGraph (Twitter
// accepte le même format 1200×630). On délègue à app/opengraph-image.tsx
// pour ne pas dupliquer le code.

export { default, runtime, alt, size, contentType } from "./opengraph-image";
