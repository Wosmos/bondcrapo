/**
 * Minimal, dependency free PDF text extraction for the State Bank of Pakistan rate sheets.
 *
 * The sheets are one page Office exports with WinAnsi TrueType fonts: every visible string sits
 * in a `BT ... ET` block positioned with `Tm`/`Td` and drawn with `Tj`/`TJ`. We inflate the
 * FlateDecode content streams with the web standard `DecompressionStream`, collect positioned
 * fragments and rebuild lines by their baseline. That keeps the parser runtime agnostic (Node,
 * Workers) and avoids shipping pdf.js in the server bundle. It is deliberately not a general PDF
 * reader: CID (Identity-H) strings are skipped, which only affects footnote glyphs on these sheets.
 */

export interface TextFragment {
  x: number;
  y: number;
  size: number;
  text: string;
}

const latin1 = new TextDecoder("latin1");

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** Returns the decoded content of every stream that looks like a page content stream. */
async function contentStreams(pdf: Uint8Array): Promise<string[]> {
  const raw = latin1.decode(pdf);
  const out: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const objStart = raw.lastIndexOf(" obj", m.index);
    const dict = raw.slice(objStart < 0 ? Math.max(0, m.index - 400) : objStart, m.index);
    re.lastIndex = end + "endstream".length;
    // Fonts, images, xref and object streams never carry page text.
    if (/\/(Length1|Subtype|ObjStm|XRef|Length2|Length3)\b/.test(dict) && !/\/Type\s*\/XObject\s*\/Subtype\s*\/Form/.test(dict)) continue;
    // Prefer the declared /Length: DecompressionStream rejects the trailing EOL before `endstream`.
    const declared = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    const length = declared ? Number(declared[1]) : end - start;
    let body = pdf.subarray(start, Math.min(start + length, end));
    if (/\/FlateDecode/.test(dict)) {
      const inflated = await inflate(body);
      if (!inflated) continue;
      body = inflated;
    } else if (/\/Filter/.test(dict)) {
      continue;
    }
    const text = latin1.decode(body);
    if (text.includes("BT") && /T[jJ]/.test(text)) out.push(text);
  }
  return out;
}

type Token = { t: "num"; v: number } | { t: "str"; v: string } | { t: "op"; v: string } | { t: "arr"; v: Array<string | number> };

function readLiteral(s: string, i: number): [string, number] {
  // s[i] === "("
  let depth = 1;
  let out = "";
  i++;
  while (i < s.length && depth > 0) {
    const c = s[i]!;
    if (c === "\\") {
      const n = s[i + 1] ?? "";
      if (/[0-7]/.test(n)) {
        const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1))![0];
        out += String.fromCharCode(parseInt(oct, 8));
        i += 1 + oct.length;
        continue;
      }
      const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
      out += map[n] ?? (n === "\r" || n === "\n" ? "" : n);
      i += 2;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    out += c;
    i++;
  }
  return [out, i];
}

function readHex(s: string, i: number): [string, number] {
  const end = s.indexOf(">", i);
  const hex = s.slice(i + 1, end).replace(/\s+/g, "");
  let out = "";
  // Single byte (WinAnsi) strings only; two byte CID strings decode to junk and are dropped below.
  for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
  return [out.includes("\u0000") ? "" : out, end + 1];
}

function* tokenize(s: string): Generator<Token> {
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === "%") {
      const nl = s.indexOf("\n", i);
      i = nl < 0 ? s.length : nl + 1;
    } else if (c === "(") {
      const [v, next] = readLiteral(s, i);
      i = next;
      yield { t: "str", v };
    } else if (c === "<" && s[i + 1] === "<") {
      // Inline dictionaries (marked content properties): skip to the matching close.
      let depth = 0;
      while (i < s.length) {
        if (s[i] === "<" && s[i + 1] === "<") {
          depth++;
          i += 2;
        } else if (s[i] === ">" && s[i + 1] === ">") {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else if (s[i] === "(") {
          i = readLiteral(s, i)[1];
        } else i++;
      }
    } else if (c === "<") {
      const [v, next] = readHex(s, i);
      i = next;
      yield { t: "str", v };
    } else if (c === "[") {
      const arr: Array<string | number> = [];
      i++;
      while (i < s.length && s[i] !== "]") {
        const d = s[i]!;
        if (/\s/.test(d)) i++;
        else if (d === "(") {
          const [v, next] = readLiteral(s, i);
          arr.push(v);
          i = next;
        } else if (d === "<") {
          const [v, next] = readHex(s, i);
          arr.push(v);
          i = next;
        } else {
          const num = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 32));
          if (num) {
            arr.push(Number(num[0]));
            i += num[0].length;
          } else i++;
        }
      }
      i++;
      yield { t: "arr", v: arr };
    } else if (/[0-9+\-.]/.test(c)) {
      const num = /^[+-]?(\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 32));
      if (num) {
        yield { t: "num", v: Number(num[0]) };
        i += num[0].length;
      } else i++;
    } else if (c === "/") {
      const name = /^\/[^\s/<>[\]()]*/.exec(s.slice(i))![0];
      i += name.length;
      yield { t: "op", v: name };
    } else {
      const op = /^[A-Za-z'"*]+/.exec(s.slice(i));
      if (op) {
        i += op[0].length;
        yield { t: "op", v: op[0] };
      } else i++;
    }
  }
}

const hasControlChars = (s: string) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0d && c < 0x20)) return true;
  }
  return false;
};

function fragmentsOf(stream: string): TextFragment[] {
  const out: TextFragment[] = [];
  const stack: number[] = [];
  let size = 10;
  let lineX = 0;
  let lineY = 0;
  let leading = 0;
  let scale = 1;
  let inText = false;
  let pendingFont = false;
  let lastStr: string | null = null;
  const push = (text: string) => {
    // Two byte CID strings show up as control characters: not readable without the font's CMap.
    if (inText && text.length && !hasControlChars(text)) out.push({ x: lineX, y: lineY, size: size * scale, text });
  };
  for (const tok of tokenize(stream)) {
    if (tok.t === "num") {
      stack.push(tok.v);
      continue;
    }
    if (tok.t === "str") {
      lastStr = tok.v;
      continue;
    }
    if (tok.t === "arr") {
      // TJ arrays: kerning numbers only nudge glyphs, join the strings.
      lastStr = tok.v.filter((p): p is string => typeof p === "string").join("");
      continue;
    }
    const op = tok.v;
    if (op.startsWith("/")) {
      pendingFont = true;
      continue;
    }
    switch (op) {
      case "BT":
        inText = true;
        lineX = 0;
        lineY = 0;
        scale = 1;
        break;
      case "ET":
        inText = false;
        break;
      case "Tf":
        if (pendingFont && stack.length) size = stack[stack.length - 1]!;
        break;
      case "Tm": {
        const [a, , , , e, f] = stack.slice(-6);
        if (f !== undefined) {
          scale = Math.abs(a ?? 1) || 1;
          lineX = e ?? 0;
          lineY = f;
        }
        break;
      }
      case "Td":
      case "TD": {
        const [tx, ty] = stack.slice(-2);
        if (ty !== undefined) {
          lineX += (tx ?? 0) * scale;
          lineY += ty * scale;
          if (op === "TD") leading = -ty;
        }
        break;
      }
      case "TL":
        leading = stack[stack.length - 1] ?? leading;
        break;
      case "T*":
        lineY -= leading * scale;
        break;
      case "Tj":
      case "TJ":
        if (lastStr !== null) push(lastStr);
        break;
      case "'":
      case '"':
        lineY -= leading * scale;
        if (lastStr !== null) push(lastStr);
        break;
    }
    stack.length = 0;
    pendingFont = false;
    lastStr = null;
  }
  return out;
}

/** Approximate advance width of a string (Arial/Calibri digits are about 0.5 em). */
const advance = (f: TextFragment) => f.text.length * f.size * 0.5;

/**
 * Rebuilds the visual lines of a PDF, top to bottom. Fragments that touch are joined directly;
 * a word gap becomes one space and a column gap becomes two or more spaces, so callers can
 * split table rows on `/\s{2,}/`.
 */
export async function pdfLines(pdf: Uint8Array): Promise<string[]> {
  const fragments = (await Promise.all((await contentStreams(pdf)).map(fragmentsOf))).flat();
  const rows: TextFragment[][] = [];
  for (const f of fragments.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r[0]!.y - f.y) <= Math.max(1.5, f.size * 0.25));
    if (row) row.push(f);
    else rows.push([f]);
  }
  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let end = Number.NEGATIVE_INFINITY;
      for (const f of row) {
        const gap = f.x - end;
        if (line && gap > f.size * 1.5) line += "    ";
        else if (line && gap > f.size * 0.3 && !line.endsWith(" ") && !f.text.startsWith(" ")) line += " ";
        line += f.text;
        end = Math.max(end, f.x + advance(f));
      }
      return line.replace(/[ \t]+$/g, "").replace(/^\s+/, "");
    })
    .filter((l) => l.trim().length > 0);
}
