/**
 * MarkdownText — AI/chat replies with line breaks, lists, and emoji preserved.
 */

import ReactMarkdown from 'react-markdown';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

/** Single newlines → hard breaks; keep blank lines as paragraphs. */
export function prepareChatMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `${line}  `))
    .join('\n');
}

export function MarkdownText({ text, className }: MarkdownTextProps) {
  const prepared = prepareChatMarkdown(text);
  return (
    <div
      className={[
        'chat-md max-w-none text-inherit leading-relaxed break-words',
        '[&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0',
        '[&>ul]:my-1.5 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:my-1.5 [&>ol]:list-decimal [&>ol]:pl-4',
        '[&>li]:my-0.5 [&>li]:marker:text-text-muted',
        '[&>strong]:font-semibold',
        '[&>hr]:my-2 [&>hr]:border-border',
        '[&>code]:rounded [&>code]:bg-surface-secondary [&>code]:px-1 [&>code]:font-mono [&>code]:text-[0.9em]',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} className="underline text-accent-fg" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
