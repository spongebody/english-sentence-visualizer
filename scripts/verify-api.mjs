// Real-model acceptance checks through the public HTTP API. This makes paid API calls.
import assert from "node:assert/strict";
import fs from "node:fs";

const base = process.env.VERIFY_URL || "http://127.0.0.1:3000";
const cases = [
  {
    name: "cadence",
    sentence:
      "For the last 15 years the cadence of the Lean LaunchPad class has been the same",
    check: (r, t) => {
      const c = r.analyses[0].clauses;
      assert.equal(c.length, 1);
      assert.equal(
        t(c[0].components.find((x) => x.role === "subject").head[0]),
        "the cadence",
      );
      assert.equal(
        t(c[0].components.find((x) => x.role === "predicative").head[0]),
        "the same",
      );
      assert(
        c[0].relations.some(
          (x) =>
            t(x.from) === "of the Lean LaunchPad class" &&
            t(x.to).includes("cadence"),
        ),
      );
    },
  },
  {
    name: "predicative",
    sentence: "She is happy.",
    check: (r) => {
      const c = r.analyses[0].clauses[0].components;
      assert(c.some((x) => x.role === "predicative"));
      assert(!c.some((x) => x.role === "object"));
    },
  },
  {
    name: "complement",
    sentence: "They made him angry.",
    check: (r, t) => {
      assert(
        r.analyses[0].clauses[0].components.some(
          (x) =>
            x.role === "complement" &&
            t(x.head[0]).replace(/\.$/, "") === "angry",
        ),
      );
    },
  },
  {
    name: "relative-clause",
    sentence: "The report that you sent me yesterday contains several errors.",
    check: (r, t) => {
      const child = r.analyses[0].clauses.find((x) => x.parentId !== null);
      assert(child);
      assert(
        child.components.some(
          (x) => x.role === "subject" && t(x.head[0]) === "you",
        ),
      );
      assert(
        child.components.some(
          (x) => x.role === "object" && t(x.head[0]) === "that",
        ),
        "relative pronoun is the direct object",
      );
      assert(
        !child.components.some((x) => x.head.some((h) => t(h) === "yesterday")),
        "yesterday is an adjunct, not a core component",
      );
    },
  },
  {
    name: "ambiguity",
    sentence: "I saw the man with a telescope.",
    check: (r, t) => {
      assert(r.analyses.length >= 2);
      const relations = r.analyses.flatMap((a) => a.clauses[0].relations);
      assert(
        relations.some(
          (x) => t(x.from).startsWith("with") && t(x.to) === "saw",
        ),
      );
      assert(
        relations.some(
          (x) => t(x.from).startsWith("with") && t(x.to).includes("man"),
        ),
      );
      assert(
        r.analyses.some((a) =>
          a.clauses[0].components.some(
            (c) =>
              c.role === "object" &&
              c.extent.some((e) => t(e).includes("with a telescope")),
          ),
        ),
      );
      assert(
        !r.analyses.some((a) =>
          a.clauses[0].components.some(
            (c) =>
              c.role === "complement" &&
              c.head.some((h) => t(h).startsWith("with")),
          ),
        ),
      );
    },
  },
  {
    name: "nested",
    sentence:
      "The book that the teacher who lives next door recommended is fascinating.",
    check: (r, t) => {
      const clauses = r.analyses[0].clauses;
      assert(clauses.length >= 3);
      const inner = clauses.find((c) => t(c.span) === "who lives next door");
      assert(inner);
      assert(clauses.find((c) => c.id === inner.parentId)?.parentId !== null);
      assert(
        clauses.some((c) =>
          c.relations.some(
            (x) =>
              t(x.from) === "who lives next door" &&
              t(x.to).includes("teacher"),
          ),
        ),
      );
    },
  },
  {
    name: "inversion",
    sentence: "Never have I seen such a beautiful sky.",
    check: (r, t) => {
      const predicate = r.analyses[0].clauses[0].components.find(
        (c) => c.role === "predicate",
      );
      assert(predicate);
      assert.equal(predicate.head.map(t).join(" "), "have seen");
      assert(
        !predicate.extent.some((e) => t(e).split(/\s+/).includes("I")),
        "predicate extent must exclude the intervening subject",
      );
    },
  },
];
cases.push({
  name: "contraction",
  sentence: "I'm happy.",
  check: (r, t) => {
    const c = r.analyses[0].clauses[0].components;
    assert(c.some((x) => x.role === "subject" && t(x.head[0]) === "I"));
    assert(c.some((x) => x.role === "predicate" && t(x.head[0]) === "'m"));
    assert(c.some((x) => x.role === "predicative" && t(x.head[0]) === "happy"));
    assert.equal(
      r.tokens.map((x) => r.sentence.slice(x.start, x.end)).join(""),
      "I'mhappy.",
    );
  },
});
const results = [];
const selected = process.env.VERIFY_CASE
  ? cases.filter((c) => c.name === process.env.VERIFY_CASE)
  : cases;
assert(selected.length, "unknown VERIFY_CASE");
for (let i = 0; i < selected.length; i += 2) {
  results.push(
    ...(await Promise.all(
      selected.slice(i, i + 2).map(async (c) => {
        const start = Date.now();
        let response;
        try {
          const r = await fetch(`${base}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sentence: c.sentence }),
            signal: AbortSignal.timeout(125_000),
          });
          response = await r.json();
          assert.equal(r.status, 200, response.error);
          const text = (range) =>
            response.sentence.slice(
              response.tokens[range[0]].start,
              response.tokens[range[1] - 1].end,
            );
          c.check(response, text);
          console.log(`PASS ${c.name}`);
          return {
            name: c.name,
            sentence: c.sentence,
            passed: true,
            seconds: (Date.now() - start) / 1000,
            response,
          };
        } catch (error) {
          console.log(`FAIL ${c.name}: ${error.message}`);
          return {
            name: c.name,
            sentence: c.sentence,
            passed: false,
            error: error.message,
            response,
          };
        }
      }),
    )),
  );
}
const invalid = await fetch(`${base}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sentence: "  " }),
});
assert.equal(invalid.status, 400, "empty input rejected before model call");
console.log(
  `Empty input: 400. Samples: ${results.filter((x) => x.passed).length}/${results.length}.`,
);
if (process.env.VERIFY_OUTPUT)
  fs.writeFileSync(
    process.env.VERIFY_OUTPUT,
    JSON.stringify({ at: new Date().toISOString(), base, results }, null, 2),
  );
if (results.some((x) => !x.passed)) process.exitCode = 1;
