import type { LinkContext } from "@/lib/types";

const MAX_LINKS = 3;
const MAX_RESPONSE_BYTES = 300_000;
const MAX_EXCERPT_LENGTH = 7000;
const FETCH_TIMEOUT_MS = 8000;

const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function parseSourceLinks(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_LINKS);
}

export async function fetchLinkContexts(urls: string[]): Promise<LinkContext[]> {
  const limitedUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean))).slice(0, MAX_LINKS);

  return Promise.all(limitedUrls.map(fetchLinkContext));
}

async function fetchLinkContext(rawUrl: string): Promise<LinkContext> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return { url: rawUrl, status: "failed", error: "Invalid URL." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { url: rawUrl, status: "failed", error: "Only http and https links are supported." };
  }

  if (isBlockedHostname(url.hostname)) {
    return { url: rawUrl, status: "failed", error: "Local or private links are not supported." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html, text/plain, application/json;q=0.8, */*;q=0.5",
        "user-agent": "The Slop Cannon link context fetcher"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return { url: url.toString(), status: "failed", error: `Fetch failed with ${response.status}.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!isReadableContentType(contentType)) {
      return { url: url.toString(), status: "failed", error: "Link did not return readable text." };
    }

    const text = await readLimitedText(response);
    const articleHtml = extractArticleHtml(text);
    const title = extractTitle(articleHtml) ?? extractTitle(text);
    const headings = extractHeadings(articleHtml);
    const excerpt = extractReadableText(articleHtml).slice(0, MAX_EXCERPT_LENGTH).trim();

    if (!excerpt) {
      return { url: url.toString(), status: "failed", error: "No readable text found on the page." };
    }

    return {
      url: url.toString(),
      title,
      headings,
      excerpt,
      status: "fetched"
    };
  } catch (error) {
    return {
      url: url.toString(),
      status: "failed",
      error: error instanceof Error && error.name === "AbortError" ? "Fetch timed out." : "Could not fetch link."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return PRIVATE_HOSTS.has(normalized) || normalized.endsWith(".local") || isPrivateIpv4(normalized);
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isReadableContentType(contentType: string) {
  return (
    contentType.includes("text/html") ||
    contentType.includes("text/plain") ||
    contentType.includes("application/json") ||
    contentType === ""
  );
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) {
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  return new TextDecoder().decode(concatChunks(chunks, Math.min(total, MAX_RESPONSE_BYTES)));
}

function concatChunks(chunks: Uint8Array[], length: number) {
  const result = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    const available = Math.min(chunk.byteLength, length - offset);
    result.set(chunk.slice(0, available), offset);
    offset += available;

    if (offset >= length) {
      break;
    }
  }

  return result;
}

function extractTitle(value: string) {
  const match = value.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? value.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(stripTags(match[1])).trim().slice(0, 180) : undefined;
}

function extractArticleHtml(value: string) {
  const articleMatch = value.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const mainMatch = value.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? value;
}

function extractHeadings(value: string) {
  const headings: string[] = [];
  const headingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match = headingPattern.exec(value);

  while (match) {
    const heading = decodeHtml(stripTags(match[1])).replace(/\s+/g, " ").trim();
    if (heading) {
      headings.push(heading.slice(0, 180));
    }
    match = headingPattern.exec(value);
  }

  return Array.from(new Set(headings)).slice(0, 12);
}

function extractReadableText(value: string) {
  return decodeHtml(
    stripTags(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
        .replace(/<(h[1-6]|p|li|blockquote)[^>]*>/gi, "\n")
        .replace(/<\/(h[1-6]|p|li|blockquote)>/gi, "\n")
        .replace(/<[^>]+(>|$)/g, " ")
    )
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
