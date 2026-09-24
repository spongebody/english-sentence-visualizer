"use client";
import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";
import {
  roles,
  textOf,
  type Result,
  type Clause,
  type Analysis,
  type Range,
} from "@/lib/analysis";

function RelationLines({
  container,
  clause,
  selected,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  clause: Clause;
  selected: number | null;
}) {
  const [paths, setPaths] = useState<
    { d: string; x: number; y: number; index: number }[]
  >([]);
  const marker = useId().replaceAll(":", "");
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const anchor = (range: Range, target = false) => {
        const full =
          target && range[0] === clause.span[0] && range[1] === clause.span[1];
        const node = el.querySelector<HTMLElement>(
          full ? "[data-clause-anchor]" : `[data-token="${range[0]}"]`,
        );
        const rect = node?.getClientRects()[0];
        return rect
          ? {
              x: rect.left - box.left + Math.min(rect.width / 2, 32),
              y: rect.top - box.top - 5,
            }
          : null;
      };
      setPaths(
        clause.relations.flatMap((r, index) => {
          const from = anchor(r.from),
            to = anchor(r.to, true);
          if (!from || !to) return [];
          const top = Math.max(
            8,
            Math.min(from.y, to.y) - 20 - (index % 3) * 10,
          );
          let d = `M ${from.x} ${from.y} C ${from.x} ${top}, ${to.x} ${top}, ${to.x} ${to.y}`;
          // Cross-line relationships run through the reserved right gutter.
          if (Math.abs(from.y - to.y) > 45) {
            const gutter = box.width - 8 - (index % 3) * 7;
            d = `M ${from.x} ${from.y} Q ${from.x} ${from.y - 14} ${gutter - 6} ${from.y - 14} Q ${gutter} ${from.y - 14} ${gutter} ${from.y} L ${gutter} ${to.y - 16} Q ${gutter} ${to.y - 22} ${gutter - 8} ${to.y - 22} L ${to.x + 8} ${to.y - 22} Q ${to.x} ${to.y - 22} ${to.x} ${to.y}`;
          }
          return [{ d, x: from.x, y: from.y, index }];
        }),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    window.addEventListener("resize", schedule);
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) schedule();
    });
    measure();
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [clause, container]);
  return (
    <svg className="relation-lines" aria-hidden="true">
      <defs>
        <marker
          id={marker}
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M0 0 L7 3.5 L0 7" fill="none" stroke="currentColor" />
        </marker>
      </defs>
      {paths
        .filter((p) => selected === null || p.index === selected)
        .map((p) => (
          <g key={p.index}>
            <circle cx={p.x} cy={p.y} r="2.2" />
            <path
              d={p.d}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              markerEnd={`url(#${marker})`}
            />
          </g>
        ))}
    </svg>
  );
}

export function ClauseView({
  result,
  clause,
  relations,
}: {
  result: Result;
  clause: Clause;
  relations: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selection =
    relations && selected !== null ? clause.relations[selected] : null;
  return (
    <section
      className={`clause ${clause.parentId === null ? "" : "child-clause"}`}
    >
      <div
        ref={container}
        className={`diagram ${relations ? "with-relations" : ""}`}
      >
        <div className="clause-heading">
          <span data-clause-anchor>{clause.kind}</span>
          <span>保留原句词序</span>
        </div>
        <p
          className="sentence"
          aria-label={clause.parentId === null ? "原句" : "从句原文"}
        >
          {result.tokens.slice(...clause.span).map((token, offset) => {
            const i = offset + clause.span[0];
            const core = clause.components.find((c) =>
              c.head.some(([s, e]) => s <= i && i < e),
            );
            const scopes = clause.components.filter((c) =>
              c.extent.some(([s, e]) => s <= i && i < e),
            );
            const scope = scopes[0];
            const scopeClass = scope
              ? `scoped scope-${scope.role} ${scope.extent.some(([s]) => s === i) ? "scope-start" : ""} ${scope.extent.some(([, e]) => e - 1 === i) ? "scope-end" : ""}`
              : "";
            const selectedWord =
              selection &&
              [selection.from, selection.to].some(([s, e]) => s <= i && i < e);
            return (
              <Fragment key={i}>
                {i > clause.span[0]
                  ? result.sentence.slice(result.tokens[i - 1].end, token.start)
                  : ""}
                <span
                  data-token={i}
                  className={`word ${core ? `core ${core.role}` : "modifier"} ${scopeClass} ${selectedWord ? "selected-word" : ""}`}
                  title={
                    core
                      ? roles[core.role]
                      : scopes.map((s) => `属于完整${roles[s.role]}`).join("；")
                  }
                >
                  {token.text}
                </span>
              </Fragment>
            );
          })}
        </p>
        {relations && (
          <RelationLines
            container={container}
            clause={clause}
            selected={selected}
          />
        )}
      </div>
      <dl className="backbone">
        {clause.components.map((c, i) => (
          <div key={i} className={c.role}>
            <dt>{roles[c.role]}</dt>
            <dd aria-label={`${roles[c.role]}核心`}>
              {c.head
                .map((r) => textOf(result.sentence, result.tokens, r))
                .join(" … ")}
            </dd>
          </div>
        ))}
      </dl>
      {relations && (
        <div className="relations">
          <div className="relations-caption">
            修饰关系 <span>点选一项，聚焦它的连线</span>
            {selected !== null && (
              <button type="button" onClick={() => setSelected(null)}>
                显示全部连线
              </button>
            )}
          </div>
          {clause.relations.length ? (
            clause.relations.map((r, i) => (
              <button
                key={i}
                type="button"
                className="relation-row"
                aria-pressed={selected === i}
                onClick={() => setSelected(selected === i ? null : i)}
              >
                <span className="relation-source">
                  {textOf(result.sentence, result.tokens, r.from)}
                </span>
                <span aria-hidden="true">→</span>
                <span className="relation-target">
                  {r.to[0] === clause.span[0] && r.to[1] === clause.span[1]
                    ? "整个" + clause.kind
                    : textOf(result.sentence, result.tokens, r.to)}
                </span>
                <span className="relation-note">{r.note}</span>
              </button>
            ))
          ) : (
            <p className="muted">这一层没有额外的修饰关系。</p>
          )}
        </div>
      )}
      <details className="scope-details">
        <summary>完整成分范围</summary>
        <dl>
          {clause.components.map((c, i) => (
            <div key={i}>
              <dt>{roles[c.role]}</dt>
              <dd aria-label={`完整${roles[c.role]}`}>
                {c.extent
                  .map((r) => textOf(result.sentence, result.tokens, r))
                  .join(" … ")}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export function ClauseTree({
  result,
  analysis,
  clause,
  relations,
}: {
  result: Result;
  analysis: Analysis;
  clause: Clause;
  relations: boolean;
}) {
  const children = analysis.clauses.filter((c) => c.parentId === clause.id);
  return (
    <>
      <ClauseView result={result} clause={clause} relations={relations} />
      {children.length > 0 && (
        <div className="clause-children">
          {children.map((child) => (
            <ExpandableClause
              key={child.id}
              result={result}
              analysis={analysis}
              clause={child}
              relations={relations}
            />
          ))}
        </div>
      )}
    </>
  );
}
function ExpandableClause(props: Parameters<typeof ClauseTree>[0]) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="clause-branch">
      <button
        className="clause-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="expand-icon" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
        <span className="clause-kind">{props.clause.kind}</span>
        <span className="clause-excerpt">
          {textOf(
            props.result.sentence,
            props.result.tokens,
            props.clause.span,
          )}
        </span>
        <span className="expand-label">{open ? "收起" : "展开结构"}</span>
      </button>
      <div id={id}>{open && <ClauseTree {...props} />}</div>
    </div>
  );
}
