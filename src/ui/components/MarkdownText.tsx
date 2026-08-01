/**
 * MarkdownText — Renders Markdown text from AI responses with proper formatting.
 *
 * Uses react-markdown to parse markdown and applies Tailwind utility classes
 * that inherit the parent container's font size.
 */

import ReactMarkdown from "react-markdown";

interface MarkdownTextProps {
  text: string;
}

export function MarkdownText({ text }: MarkdownTextProps) {
  return (
    <div className="prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>li]:marker:text-text-muted [&>p]:my-1 [&>p:last-child]:mb-0 [&>strong]:font-bold [&>em]:italic [&>h1]:text-xl [&>h2]:text-lg [&>h3]:text-base [&>h4]:text-sm [&>blockquote]:border-l-4 [&>blockquote]:border-border [&>blockquote]:pl-3 [&>blockquote]:text-text-muted [&>code]:bg-surface-secondary [&>code]:rounded [&>code]:px-1 [&>code]:font-mono [&>pre]:bg-surface-secondary [&>pre]:rounded [&>pre]:p-2 [&>pre]:font-mono [&>pre>code]:bg-transparent [&>table]:border-collapse [&>table]:w-full [&>table]:text-xs [&>th]:border [&>th]:px-2 [&>th]:py-1 [&>th]:bg-surface-secondary [&>td]:border [&>td]:px-2 [&>td]:py-1">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
