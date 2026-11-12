import Link from 'next/link';

export function RichText({ text }: { text: string }) {
  const tokens = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_]{3,24}\b|#[a-zA-Z0-9_]+)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokens.exec(text)) !== null) {
    const mentionStart = match.index + match[1].length;
    if (mentionStart > cursor) nodes.push(text.slice(cursor, mentionStart));
    const token = match[2];
    nodes.push(token.startsWith('@') ? (
      <Link
        key={`${mentionStart}-${token}`}
        href={`/profile/${encodeURIComponent(token.slice(1).toLowerCase())}`}
        className="font-medium text-violet-700 hover:underline"
      >
        {token}
      </Link>
    ) : (
      <span key={`${mentionStart}-${token}`} className="rounded bg-blue-100 px-1 font-semibold text-blue-700">
        {token}
      </span>
    ));
    cursor = mentionStart + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
