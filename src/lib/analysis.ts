import { z } from "zod";

export const roles = {
  subject: "主语",
  predicate: "谓语",
  object: "宾语",
  predicative: "表语",
  complement: "补语",
} as const;
const rangeSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().positive(),
]);
const explanation = z.object({
  text: z.string().min(1).max(400),
  meaning: z.string().min(1).max(500),
});
const schema = z.object({
  analyses: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        label: z.string().min(1).max(120),
        translation: z.string().min(1).max(3000),
        chunks: z.array(explanation).max(20),
        vocabulary: z.array(explanation).max(20),
        clauses: z
          .array(
            z.object({
              id: z.string().min(1).max(60),
              parentId: z.string().nullable(),
              kind: z.string().min(1).max(40),
              span: rangeSchema,
              components: z
                .array(
                  z.object({
                    role: z.enum([
                      "subject",
                      "predicate",
                      "object",
                      "predicative",
                      "complement",
                    ]),
                    head: z.array(rangeSchema).min(1).max(12),
                    extent: z.array(rangeSchema).min(1).max(12),
                  }),
                )
                .min(1)
                .max(30),
              relations: z
                .array(
                  z.object({
                    from: rangeSchema,
                    to: rangeSchema,
                    note: z.string().min(1).max(180),
                  }),
                )
                .max(30),
            }),
          )
          .min(1)
          .max(30),
      }),
    )
    .min(1)
    .max(3),
});

export type Range = z.infer<typeof rangeSchema>;
export type Analysis = z.infer<typeof schema>["analyses"][number];
export type Clause = Analysis["clauses"][number];
export type Token = { text: string; start: number; end: number };
export type Result = {
  sentence: string;
  tokens: Token[];
  analyses: Analysis[];
};

export function tokenize(sentence: string): Token[] {
  // Preserve character offsets while exposing boundaries inside I'm / she's.
  // Punctuation is also separate, so it need not become part of a component.
  const pattern =
    /[\p{L}]+(?:-[\p{L}]+)*|['’](?:re|ve|ll|s|m|d|t)\b|\d+(?:[.,]\d+)*|[^\s]/giu;
  return Array.from(sentence.matchAll(pattern), (m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}
export function contains(outer: Range, inner: Range) {
  return outer[0] <= inner[0] && inner[1] <= outer[1];
}
export function textOf(sentence: string, tokens: Token[], range: Range) {
  return sentence.slice(tokens[range[0]].start, tokens[range[1] - 1].end);
}

/** Structural validation cannot prove grammatical correctness; it prevents broken diagrams. */
export function parseAnalysis(value: unknown, tokens: Token[]): Analysis[] {
  const count = tokens.length;
  const { analyses } = schema.parse(value);
  const require = (ok: boolean) => {
    if (!ok) throw new Error("Invalid analysis structure");
  };
  const validRange = (r: Range, within: Range = [0, count]) => {
    require(r[0] < r[1] && contains(within, r));
  };
  require(new Set(analyses.map((a) => a.id)).size === analyses.length);
  for (const analysis of analyses) {
    const clauses = new Map(analysis.clauses.map((c) => [c.id, c]));
    require(clauses.size === analysis.clauses.length);
    const roots = analysis.clauses.filter((c) => c.parentId === null);
    require(
      roots.length === 1 &&
        roots[0].span[0] === 0 &&
        roots[0].span[1] === count,
    );
    for (const clause of analysis.clauses) {
      validRange(clause.span);
      const seen = new Set([clause.id]);
      let current = clause;
      while (current.parentId !== null) {
        const parent = clauses.get(current.parentId);
        require(!!parent && !seen.has(current.parentId));
        validRange(current.span, parent!.span);
        seen.add(current.parentId);
        current = parent!;
      }
      const assigned = new Set<number>();
      const occupied = new Set<number>();
      for (const component of clause.components) {
        for (const extent of component.extent) {
          validRange(extent, clause.span);
          for (let i = extent[0]; i < extent[1]; i++) {
            require(!occupied.has(i));
            occupied.add(i);
          }
        }
        // Articles belong with an adjacent noun head in this reading view.
        // Models sometimes return only the noun despite the requested convention.
        if (component.role === "subject" || component.role === "object") {
          const first = component.head[0];
          if (
            component.extent.some((r) =>
              contains(r, [first[0] - 1, first[1]]),
            ) &&
            /^(the|a|an)$/i.test(tokens[first[0] - 1]?.text || "")
          )
            first[0]--;
        }
        for (const head of component.head) {
          validRange(head, clause.span);
          require(component.extent.some((r) => contains(r, head)));
          for (let i = head[0]; i < head[1]; i++) {
            require(!assigned.has(i));
            assigned.add(i);
          }
        }
      }
      for (const relation of clause.relations) {
        validRange(relation.from, clause.span);
        validRange(relation.to, clause.span);
        require(
          relation.from[0] !== relation.to[0] ||
            relation.from[1] !== relation.to[1],
        );
        require(!contains(relation.from, relation.to));
      }
    }
  }
  return analyses;
}
