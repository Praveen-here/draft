"use client";

import { useMemo } from "react";
import { renderToString } from "katex";
import "katex/dist/katex.min.css";

/** KaTeX emits both visual HTML and accessible MathML. Links and HTML commands remain untrusted. */
export function MathText({ latex, block = false, className }: {
  latex: string; block?: boolean; className?: string;
}) {
  const html = useMemo(() => {
    try {
      return renderToString(latex.slice(0, 1500), {
        displayMode: block, throwOnError: false, trust: false, strict: "ignore",
        maxExpand: 200, output: "htmlAndMathml",
      });
    } catch {
      return null;
    }
  }, [latex, block]);
  if (html === null) return <span className={className}>{latex}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
