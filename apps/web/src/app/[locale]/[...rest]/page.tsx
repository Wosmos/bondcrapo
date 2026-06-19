import { notFound } from "next/navigation";

/** Unknown paths under a locale render the localized not-found page inside the shell. */
export default function CatchAll(): never {
  notFound();
}
