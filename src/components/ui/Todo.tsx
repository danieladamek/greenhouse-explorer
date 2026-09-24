/**
 * Amber TODO(author) marker — a pending fact is shown, labelled, and never hidden or filled (APP-SPEC §6).
 * In this pack the amber markers are decisions, not oversights: 260 todo.yaml entries, 29 compounds with no
 * evidence rows, and a physchem block that is null on every record.
 */
export default function Todo({ children }: { children: React.ReactNode }) {
  return <span className="bx-todo" data-todo="author">TODO(author): {children}</span>;
}
