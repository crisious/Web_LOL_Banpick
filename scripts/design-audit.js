#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_CONTEXT_FILES = ["index.html", "main.js"];
const DEFAULT_TOP_LIMIT = 8;

const SCOPE_ALIASES = {
  all: "all",
  color: "colors",
  colors: "colors",
  tokens: "tokens",
  token: "tokens",
  radius: "radius",
  radii: "radius",
  gap: "spacing",
  gaps: "spacing",
  space: "spacing",
  spacing: "spacing",
  fontsize: "fontSize",
  "font-size": "fontSize",
  typography: "fontSize",
  breakpoint: "breakpoints",
  breakpoints: "breakpoints",
  responsive: "breakpoints",
  custom: "customProps",
  customprops: "customProps",
  vars: "customProps",
  "custom-props": "customProps",
  "custom-properties": "customProps",
};

function parseArgs(argv) {
  const options = {
    file: "styles.css",
    scope: "all",
    format: "text",
    output: "",
    top: DEFAULT_TOP_LIMIT,
    context: [...DEFAULT_CONTEXT_FILES],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--file" || arg === "-f") {
      options.file = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--scope" || arg === "-s") {
      options.scope = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--format") {
      options.format = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--top") {
      options.top = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === "--context") {
      const value = argv[index + 1] || "";
      options.context = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const scope = SCOPE_ALIASES[(options.scope || "").toLowerCase()];
  if (!scope) {
    throw new Error(`Unsupported scope: ${options.scope}`);
  }
  options.scope = scope;

  const format = (options.format || "").toLowerCase();
  if (!["text", "markdown", "json"].includes(format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }
  options.format = format;

  if (!Number.isFinite(options.top) || options.top <= 0) {
    throw new Error(`Invalid --top value: ${options.top}`);
  }

  return options;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/design-audit.js [options]",
      "",
      "Options:",
      "  --file, -f <path>       CSS file to audit (default: styles.css)",
      "  --scope, -s <scope>     all | colors | radius | spacing | fontSize | breakpoints | customProps | tokens",
      "  --format <type>         text | markdown | json (default: text)",
      "  --output, -o <path>     Write the rendered report to a file",
      "  --top <n>               Number of findings to render per section (default: 8)",
      "  --context <files>       Comma-separated runtime context files (default: index.html,main.js)",
      "  --help, -h              Show this help message",
      "",
      "Examples:",
      "  node scripts/design-audit.js",
      "  node scripts/design-audit.js --scope colors --format markdown",
      "  node scripts/design-audit.js --scope all --format json --output test-artifacts/design-audit.json",
      "",
    ].join("\n"),
  );
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

function buildLineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lineNumberAt(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return high + 1;
}

function findNamedBlock(source, selector) {
  const startIndex = source.indexOf(selector);
  if (startIndex === -1) return null;

  const braceStart = source.indexOf("{", startIndex);
  if (braceStart === -1) return null;

  let depth = 1;
  let cursor = braceStart + 1;

  while (cursor < source.length && depth > 0) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") depth -= 1;
    cursor += 1;
  }

  if (depth !== 0) return null;

  return {
    start: startIndex,
    braceStart,
    bodyStart: braceStart + 1,
    bodyEnd: cursor - 1,
    end: cursor,
  };
}

function blankRanges(source, ranges) {
  if (!ranges.length) return source;
  const chars = source.split("");
  for (const range of ranges) {
    for (let index = range.start; index < range.end; index += 1) {
      if (chars[index] !== "\n") {
        chars[index] = " ";
      }
    }
  }
  return chars.join("");
}

function normalizeValue(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function parseCustomPropertyDeclarations(source, lineStarts, start = 0, end = source.length) {
  const result = [];
  const segment = source.slice(start, end);
  const regex = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;

  while ((match = regex.exec(segment)) !== null) {
    const index = start + match.index;
    const name = `--${match[1]}`;
    const value = match[2].trim();
    result.push({
      name,
      value,
      normalizedValue: normalizeValue(value),
      index,
      line: lineNumberAt(lineStarts, index),
    });
  }

  return result;
}

function collectPropertyDeclarations(source, lineStarts, propertyNames) {
  const escaped = propertyNames.map(escapeRegExp).join("|");
  const regex = new RegExp(`\\b(${escaped})\\s*:\\s*([^;]+);`, "gi");
  const result = [];
  let match;

  while ((match = regex.exec(source)) !== null) {
    const index = match.index;
    result.push({
      property: match[1],
      value: match[2].trim(),
      index,
      line: lineNumberAt(lineStarts, index),
    });
  }

  return result;
}

function collectLiteralMatches(source, lineStarts, regex) {
  const result = [];
  let match;
  regex.lastIndex = 0;

  while ((match = regex.exec(source)) !== null) {
    result.push({
      value: match[0],
      index: match.index,
      line: lineNumberAt(lineStarts, match.index),
    });
  }

  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeColor(value) {
  return /#(?:[0-9a-f]{3,8})\b|rgba?\(|hsla?\(/i.test(value);
}

function categorizeRootToken(token) {
  if (token.name.startsWith("--radius-")) return "radius";
  if (token.name.startsWith("--space-")) return "spacing";
  if (token.name.startsWith("--fs-")) return "fontSize";
  if (looksLikeColor(token.value) || token.name === "--shadow") return "colors";
  return "other";
}

function buildTokenIndex(tokens) {
  const byName = new Map();
  const byCategory = {
    colors: [],
    radius: [],
    spacing: [],
    fontSize: [],
    other: [],
  };
  const byValue = {
    colors: new Map(),
    radius: new Map(),
    spacing: new Map(),
    fontSize: new Map(),
  };

  for (const token of tokens) {
    const category = categorizeRootToken(token);
    byName.set(token.name, token);
    byCategory[category].push(token);

    if (byValue[category]) {
      if (!byValue[category].has(token.normalizedValue)) {
        byValue[category].set(token.normalizedValue, []);
      }
      byValue[category].get(token.normalizedValue).push(token.name);
    }
  }

  return { byName, byCategory, byValue };
}

function analyzeValueDeclarations(declarations, options) {
  const {
    tokenPrefix,
    tokenValues,
    keywordOk = [],
    responsiveMatcher = null,
  } = options;

  let tokenReferences = 0;
  let rawTotal = 0;
  const rawGroups = new Map();
  let responsiveTotal = 0;
  const responsiveGroups = new Map();

  for (const declaration of declarations) {
    const value = declaration.value;
    if (value.includes(`var(${tokenPrefix}`)) {
      tokenReferences += 1;
      continue;
    }

    if (responsiveMatcher && responsiveMatcher.test(value)) {
      responsiveTotal += 1;
      addGroupEntry(responsiveGroups, declaration);
      continue;
    }

    if (keywordOk.includes(value)) {
      continue;
    }

    rawTotal += 1;
    addGroupEntry(rawGroups, declaration, tokenValues);
  }

  return {
    tokenReferences,
    rawTotal,
    rawGroups: finalizeGroups(rawGroups),
    responsiveTotal,
    responsiveGroups: finalizeGroups(responsiveGroups),
    coverage: percentage(tokenReferences, tokenReferences + rawTotal),
  };
}

function addGroupEntry(groups, declaration, tokenValues) {
  const key = normalizeValue(declaration.value);
  if (!groups.has(key)) {
    groups.set(key, {
      value: declaration.value,
      count: 0,
      lines: [],
      matchingTokens: tokenValues?.get(key) || [],
    });
  }
  const group = groups.get(key);
  group.count += 1;
  group.lines.push(declaration.line);
}

function finalizeGroups(groups) {
  return [...groups.values()]
    .map((group) => ({
      ...group,
      lines: uniqueNumbers(group.lines),
    }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function uniqueNumbers(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function percentage(value, total) {
  if (!total) return 100;
  return Math.round((value / total) * 1000) / 10;
}

function analyzeBreakpoints(source, lineStarts) {
  const regex = /@media\s*\(([^)]+)\)/gi;
  const groups = new Map();
  let match;

  while ((match = regex.exec(source)) !== null) {
    const condition = match[1].trim();
    if (!groups.has(condition)) {
      groups.set(condition, {
        condition,
        count: 0,
        lines: [],
      });
    }
    const group = groups.get(condition);
    group.count += 1;
    group.lines.push(lineNumberAt(lineStarts, match.index));
  }

  return [...groups.values()]
    .map((group) => ({ ...group, lines: uniqueNumbers(group.lines) }))
    .sort((left, right) => right.count - left.count || left.condition.localeCompare(right.condition));
}

function parseVarCall(source, startIndex) {
  let cursor = startIndex + 4;
  let depth = 1;
  let body = "";

  while (cursor < source.length && depth > 0) {
    const char = source[cursor];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth > 0) body += char;
    cursor += 1;
  }

  if (depth !== 0) {
    return null;
  }

  const parts = splitTopLevelComma(body);
  const name = parts[0].trim();
  const fallback = parts.length > 1 ? parts.slice(1).join(",").trim() : "";

  if (!/^--[a-z0-9-]+$/i.test(name)) {
    return null;
  }

  return {
    name,
    fallback,
    end: cursor,
  };
}

function splitTopLevelComma(source) {
  const parts = [];
  let depth = 0;
  let current = "";

  for (const char of source) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

function collectVarReferences(source, lineStarts) {
  const result = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf("var(", cursor);
    if (start === -1) break;
    const parsed = parseVarCall(source, start);
    if (!parsed) {
      cursor = start + 4;
      continue;
    }
    result.push({
      name: parsed.name,
      fallback: parsed.fallback,
      index: start,
      line: lineNumberAt(lineStarts, start),
    });
    cursor = parsed.end;
  }

  return result;
}

function analyzeCustomProps(cssSource, lineStarts, declaredInCss, contextFiles) {
  const declarations = new Set(declaredInCss.map((entry) => entry.name));
  const references = collectVarReferences(cssSource, lineStarts);
  const groups = new Map();

  for (const reference of references) {
    if (declarations.has(reference.name)) {
      continue;
    }
    if (reference.fallback) {
      continue;
    }

    if (!groups.has(reference.name)) {
      const contexts = contextFiles
        .filter((file) => file.content.includes(reference.name))
        .map((file) => file.path);
      groups.set(reference.name, {
        name: reference.name,
        count: 0,
        lines: [],
        runtimeContextFiles: contexts,
      });
    }

    const group = groups.get(reference.name);
    group.count += 1;
    group.lines.push(reference.line);
  }

  return [...groups.values()]
    .map((group) => ({ ...group, lines: uniqueNumbers(group.lines) }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function analyzeColors(source, lineStarts, tokenValues, tokenNames) {
  const literalRegex = /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
  const literals = collectLiteralMatches(source, lineStarts, literalRegex);
  const groupedLiterals = new Map();

  for (const literal of literals) {
    addGroupEntry(groupedLiterals, literal, tokenValues);
  }

  const varReferenceRegex = /var\(\s*(--[a-z0-9-]+)/gi;
  const tokenRefNames = [];
  let match;
  while ((match = varReferenceRegex.exec(source)) !== null) {
    if (tokenNames.has(match[1])) {
      tokenRefNames.push(match[1]);
    }
  }

  return {
    tokenReferences: tokenRefNames.length,
    rawTotal: literals.length,
    rawGroups: finalizeGroups(groupedLiterals),
    coverage: percentage(tokenRefNames.length, tokenRefNames.length + literals.length),
  };
}

function limitItems(items, top) {
  return items.slice(0, top);
}

function formatLines(lines) {
  if (!lines.length) return "";
  const preview = lines.slice(0, 4).map((line) => `L${line}`).join(", ");
  return lines.length > 4 ? `${preview}, ...` : preview;
}

function renderText(report) {
  const lines = [];
  lines.push(`Design audit for ${report.file}`);
  lines.push(`Scope: ${report.scope}`);
  lines.push("");
  lines.push("Token inventory");
  lines.push(`- Colors: ${report.tokens.colors.length}`);
  lines.push(`- Radius: ${report.tokens.radius.length}`);
  lines.push(`- Spacing: ${report.tokens.spacing.length}`);
  lines.push(`- Font sizes: ${report.tokens.fontSize.length}`);
  lines.push(`- Other: ${report.tokens.other.length}`);

  renderSelectedSections(report, lines, "text");
  return `${lines.join("\n")}\n`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Design Audit");
  lines.push("");
  lines.push(`- File: \`${report.file}\``);
  lines.push(`- Scope: \`${report.scope}\``);
  lines.push("");
  lines.push("## Token Inventory");
  lines.push("");
  lines.push(`- Colors: ${report.tokens.colors.length}`);
  lines.push(`- Radius: ${report.tokens.radius.length}`);
  lines.push(`- Spacing: ${report.tokens.spacing.length}`);
  lines.push(`- Font sizes: ${report.tokens.fontSize.length}`);
  lines.push(`- Other: ${report.tokens.other.length}`);

  renderSelectedSections(report, lines, "markdown");
  return `${lines.join("\n")}\n`;
}

function renderSelectedSections(report, lines, format) {
  const include = {
    colors: report.scope === "all" || report.scope === "colors" || report.scope === "tokens",
    radius: report.scope === "all" || report.scope === "radius" || report.scope === "tokens",
    spacing: report.scope === "all" || report.scope === "spacing" || report.scope === "tokens",
    fontSize: report.scope === "all" || report.scope === "fontSize" || report.scope === "tokens",
    breakpoints: report.scope === "all" || report.scope === "breakpoints",
    customProps: report.scope === "all" || report.scope === "customProps",
  };

  if (include.colors) {
    pushSectionHeader(lines, format, "Colors");
    pushMetricSummary(lines, format, report.colors);
    pushGroupList(lines, format, "Exact token matches", report.colors.rawGroups.filter((group) => group.matchingTokens.length), report.top);
    pushGroupList(lines, format, "Remaining raw literals", report.colors.rawGroups.filter((group) => !group.matchingTokens.length), report.top);
  }

  if (include.radius) {
    pushSectionHeader(lines, format, "Radius");
    pushMetricSummary(lines, format, report.radius);
    pushGroupList(lines, format, "Raw radius values", report.radius.rawGroups, report.top);
  }

  if (include.spacing) {
    pushSectionHeader(lines, format, "Spacing");
    pushMetricSummary(lines, format, report.spacing);
    pushGroupList(lines, format, "Raw gap values", report.spacing.rawGroups, report.top);
  }

  if (include.fontSize) {
    pushSectionHeader(lines, format, "Font Size");
    pushMetricSummary(lines, format, report.fontSize);
    if (report.fontSize.responsiveTotal) {
      pushGroupList(lines, format, "Responsive exceptions", report.fontSize.responsiveGroups, report.top);
    }
    pushGroupList(lines, format, "Raw font-size values", report.fontSize.rawGroups, report.top);
  }

  if (include.breakpoints) {
    pushSectionHeader(lines, format, "Breakpoints");
    if (!report.breakpoints.length) {
      pushEmpty(lines, format, "No media queries found.");
    } else {
      for (const item of limitItems(report.breakpoints, report.top)) {
        pushLine(lines, format, `\`${item.condition}\` x${item.count} (${formatLines(item.lines)})`);
      }
    }
  }

  if (include.customProps) {
    pushSectionHeader(lines, format, "Custom Properties");
    if (!report.customProps.length) {
      pushEmpty(lines, format, "No missing custom property references without fallback.");
    } else {
      for (const item of limitItems(report.customProps, report.top)) {
        const runtime = item.runtimeContextFiles.length
          ? ` runtime context: ${item.runtimeContextFiles.join(", ")}`
          : "";
        pushLine(lines, format, `\`${item.name}\` x${item.count} (${formatLines(item.lines)})${runtime}`);
      }
    }
  }
}

function pushSectionHeader(lines, format, title) {
  lines.push("");
  if (format === "markdown") {
    lines.push(`## ${title}`);
    lines.push("");
  } else {
    lines.push(title);
  }
}

function pushMetricSummary(lines, format, data) {
  pushLine(lines, format, `Token references: ${data.tokenReferences}`);
  pushLine(lines, format, `Raw values: ${data.rawTotal}`);
  if (typeof data.responsiveTotal === "number" && data.responsiveTotal > 0) {
    pushLine(lines, format, `Responsive exceptions: ${data.responsiveTotal}`);
  }
  pushLine(lines, format, `Token coverage: ${data.coverage}%`);
}

function pushGroupList(lines, format, label, items, top) {
  const entries = limitItems(items, top);
  if (!entries.length) {
    return;
  }

  if (format === "markdown") {
    lines.push(`### ${label}`);
    lines.push("");
  } else {
    lines.push(`${label}`);
  }

  for (const item of entries) {
    const tokenNote = item.matchingTokens?.length ? ` -> ${item.matchingTokens.join(", ")}` : "";
    pushLine(lines, format, `\`${item.value}\` x${item.count} (${formatLines(item.lines)})${tokenNote}`);
  }
}

function pushEmpty(lines, format, text) {
  pushLine(lines, format, text);
}

function pushLine(lines, format, text) {
  if (format === "markdown") {
    lines.push(`- ${text}`);
  } else {
    lines.push(`- ${text}`);
  }
}

function loadContextFiles(rootDir, files) {
  return files.map((filePath) => {
    const resolved = path.resolve(rootDir, filePath);
    try {
      return {
        path: path.relative(rootDir, resolved) || path.basename(resolved),
        content: fs.readFileSync(resolved, "utf8"),
      };
    } catch {
      return {
        path: filePath,
        content: "",
      };
    }
  });
}

function buildReport(cssPath, cssSource, options) {
  const rootDir = path.dirname(cssPath);
  const sanitizedSource = stripComments(cssSource);
  const lineStarts = buildLineStarts(sanitizedSource);
  const rootBlock = findNamedBlock(sanitizedSource, ":root");

  if (!rootBlock) {
    throw new Error(`Could not find a :root block in ${cssPath}`);
  }

  const rootTokens = parseCustomPropertyDeclarations(cssSource, lineStarts, rootBlock.bodyStart, rootBlock.bodyEnd);
  const declaredInCss = parseCustomPropertyDeclarations(cssSource, lineStarts);
  const tokenIndex = buildTokenIndex(rootTokens);
  const auditSource = blankRanges(sanitizedSource, [{ start: rootBlock.start, end: rootBlock.end }]);

  const radiusDeclarations = collectPropertyDeclarations(auditSource, lineStarts, ["border-radius"]);
  const spacingDeclarations = collectPropertyDeclarations(auditSource, lineStarts, ["gap", "row-gap", "column-gap"]);
  const fontSizeDeclarations = collectPropertyDeclarations(auditSource, lineStarts, ["font-size"]);
  const breakpoints = analyzeBreakpoints(auditSource, lineStarts);
  const colors = analyzeColors(
    auditSource,
    lineStarts,
    tokenIndex.byValue.colors,
    new Set(tokenIndex.byCategory.colors.map((token) => token.name)),
  );
  const contextFiles = loadContextFiles(rootDir, options.context);
  const customProps = analyzeCustomProps(sanitizedSource, lineStarts, declaredInCss, contextFiles);

  return {
    file: path.relative(process.cwd(), cssPath) || path.basename(cssPath),
    scope: options.scope,
    top: options.top,
    generatedAt: new Date().toISOString(),
    tokens: tokenIndex.byCategory,
    colors,
    radius: analyzeValueDeclarations(radiusDeclarations, {
      tokenPrefix: "--radius-",
      tokenValues: tokenIndex.byValue.radius,
      keywordOk: ["inherit", "initial", "unset", "revert"],
    }),
    spacing: analyzeValueDeclarations(spacingDeclarations, {
      tokenPrefix: "--space-",
      tokenValues: tokenIndex.byValue.spacing,
      keywordOk: ["normal", "inherit", "initial", "unset", "revert"],
    }),
    fontSize: analyzeValueDeclarations(fontSizeDeclarations, {
      tokenPrefix: "--fs-",
      tokenValues: tokenIndex.byValue.fontSize,
      keywordOk: ["inherit", "initial", "unset", "revert"],
      responsiveMatcher: /^clamp\(/i,
    }),
    breakpoints,
    customProps,
  };
}

function renderReport(report, format) {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "markdown") {
    return renderMarkdown(report);
  }
  return renderText(report);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const cssPath = path.resolve(process.cwd(), options.file);
  const cssSource = fs.readFileSync(cssPath, "utf8");
  const report = buildReport(cssPath, cssSource, options);
  const rendered = renderReport(report, options.format);

  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rendered, "utf8");
  }

  process.stdout.write(rendered);
}

try {
  main();
} catch (error) {
  process.stderr.write(`design-audit failed: ${error.message}\n`);
  process.exit(1);
}
