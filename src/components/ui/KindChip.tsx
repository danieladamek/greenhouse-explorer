const KIND: Record<string, string> = {
  science: 'bg-cat-a/15 text-cat-a dark:text-blue-200',
  methods: 'bg-cat-c/15 text-cat-c dark:text-emerald-200',
  statistics: 'bg-cat-b/15 text-cat-b dark:text-pink-200',
  notation: 'bg-cat-e/15 text-cat-e dark:text-indigo-200',
  drug: 'bg-cat-d/20 text-cat-d dark:text-amber-200',
};
export default function KindChip({ kind }: { kind: string }) {
  return <span className={`bx-chip ${KIND[kind] ?? 'bg-paper-2 dark:bg-night-2'}`}>{kind}</span>;
}
