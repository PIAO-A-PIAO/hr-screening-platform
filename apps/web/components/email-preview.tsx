"use client";

import { useMemo } from "react";

const tokenPattern = /(\{\{?\s*[A-Za-z0-9_.-]+\s*\}?\})/g;
const exactToken = /^\{\{?\s*[A-Za-z0-9_.-]+\s*\}?\}$/;

export function PlaceholderText({ value }: { value: string }) {
  return <>{value.split(tokenPattern).map((part, index) => exactToken.test(part) ? <mark key={`${part}-${index}`}>{part}</mark> : part)}</>;
}

function safeHtml(html: string) {
  if (typeof window === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  documentNode.querySelectorAll("script,style,iframe,object,embed,form,input,button,img,meta,link,base").forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((element) => [...element.attributes].forEach((attribute) => {
    if (attribute.name.startsWith("on") || attribute.name === "style" || ((attribute.name === "href" || attribute.name === "src") && /^\s*(javascript|data):/i.test(attribute.value))) element.removeAttribute(attribute.name);
  }));
  const walker = documentNode.createTreeWalker(documentNode.body, NodeFilter.SHOW_TEXT); const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => { const parts = node.data.split(tokenPattern); if (parts.length === 1) return; const fragment = documentNode.createDocumentFragment(); parts.forEach((part) => { if (exactToken.test(part)) { const mark = documentNode.createElement("mark"); mark.textContent = part; fragment.append(mark); } else fragment.append(documentNode.createTextNode(part)); }); node.replaceWith(fragment); });
  return documentNode.body.innerHTML;
}

export function EmailPreview({ from, subject, html }: { from: string; subject: string; html: string }) {
  const body = useMemo(() => safeHtml(html), [html]);
  return <div className="emailPreview"><dl><dt>From</dt><dd>{from || "Configured sender"}</dd><dt>To</dt><dd>{"{candidate_email}"}</dd><dt>Subject</dt><dd><PlaceholderText value={subject} /></dd></dl><div className="emailPreviewBody" dangerouslySetInnerHTML={{ __html: body }} /></div>;
}
