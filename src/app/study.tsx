"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { type Result } from "@/lib/analysis";
import { ClauseTree } from "./sentence-view";
import "./style.css";

const sample =
  "For the last 15 years the cadence of the Lean LaunchPad class has been the same";

type Preferences = {
  relations: boolean;
  translation: boolean;
  expressions: boolean;
};
const defaults: Preferences = {
  relations: false,
  translation: false,
  expressions: false,
};
const preferenceKey = "sentence-study.display.v1";

export default function Study() {
  const [sentence, setSentence] = useState(sample);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [reading, setReading] = useState(0);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || "null");
      if (
        saved &&
        Object.keys(defaults).every((k) => typeof saved[k] === "boolean")
      )
        setPreferences({
          relations: saved.relations,
          translation: saved.translation,
          expressions: saved.expressions,
        });
    } catch {
      /* Storage is optional. */
    }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (preferencesReady)
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      } catch {
        /* Keep the current session usable. */
      }
  }, [preferences, preferencesReady]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = sentence.trim();
    if (!text) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setResult(null);
    setReading(0);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: text }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "分析失败，请重试。");
      if (current === generation.current) setResult(data);
    } catch (e) {
      if (current === generation.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : "连接中断，请重试。");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  const analysis = result?.analyses[reading];
  const root = analysis?.clauses.find((c) => c.parentId === null);
  return (
    <main className="workspace">
      <header className="masthead">
        <a href="/" className="brand">
          <span className="brand-mark">Aa</span>句子研读
        </a>
        <span className="masthead-note">English, in perspective.</span>
      </header>
      <section className="intro">
        <p className="eyebrow">从看清结构，到读懂意思</p>
        <h1>长句，也有清晰的主干。</h1>
        <p>先自己读一遍，再一点点揭晓。</p>
      </section>
      <form className="input-area" onSubmit={submit}>
        <label htmlFor="sentence">英语句子</label>
        <textarea
          id="sentence"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          maxLength={3000}
          rows={3}
          spellCheck={false}
          placeholder="粘贴一句想读懂的英文…"
        />
        <div className="input-footer">
          <span>一次专注一句话</span>
          <button className="primary" disabled={!sentence.trim()} type="submit">
            {busy ? "重新分析" : "分析句子"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      <div className="examples">
        <span>试一句</span>
        {[
          { name: "主系表", text: "She is happy." },
          {
            name: "从句",
            text: "The report that you sent me yesterday contains several errors.",
          },
          { name: "歧义", text: "I saw the man with a telescope." },
        ].map((s) => (
          <button
            type="button"
            key={s.name}
            onClick={() => setSentence(s.text)}
          >
            {s.name}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      {busy && (
        <div className="waiting" role="status">
          <span className="spinner" />
          正在梳理句子结构… <span>你可以先试着找找主干。</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              request.current?.abort();
              generation.current++;
              setBusy(false);
            }}
          >
            取消
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          {error} 输入已保留，可再次点击分析。
        </div>
      )}
      {result && root && analysis && (
        <section className="result" aria-label="句子分析">
          <div className="result-heading">
            <h2>先看主干</h2>
            <span>颜色标记核心 · 下划线表示成分范围</span>
          </div>
          {sentence.trim() !== result.sentence && (
            <p className="muted edit-note">
              输入已修改，以下仍是上一次分析。提交后更新。
            </p>
          )}
          <div className="toolbar">
            <div className="switches">
              {(
                [
                  { key: "relations", label: "修饰关系" },
                  { key: "translation", label: "句子翻译" },
                  { key: "expressions", label: "表达与词汇" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={preferences[item.key]}
                  onClick={() =>
                    setPreferences((p) => ({ ...p, [item.key]: !p[item.key] }))
                  }
                >
                  <span className="switch-track" aria-hidden="true">
                    <span />
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="presets">
              <button type="button" onClick={() => setPreferences(defaults)}>
                只看主干
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() =>
                  setPreferences({
                    relations: true,
                    translation: true,
                    expressions: true,
                  })
                }
              >
                全部展示
              </button>
            </div>
          </div>
          {result.analyses.length > 1 && (
            <div className="ambiguity">
              <span>这句话存在其他理解</span>
              <label>
                当前分析
                <select
                  value={reading}
                  onChange={(e) => setReading(Number(e.target.value))}
                >
                  {result.analyses.map((a, i) => (
                    <option key={a.id} value={i}>
                      理解 {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <span className="muted">切换后对照结构与译文</span>
            </div>
          )}
          <ClauseTree
            key={`${result.sentence}:${analysis.id}`}
            result={result}
            analysis={analysis}
            clause={root}
            relations={preferences.relations}
          />
          {preferences.translation && (
            <section className="translation" aria-label="句子翻译">
              <h3>句子翻译</h3>
              <p>{analysis.translation}</p>
            </section>
          )}
          {preferences.expressions && (
            <div className="aids-grid">
              <section aria-label="表达语块">
                <h3>
                  表达语块 <span>CHUNKS</span>
                </h3>
                {analysis.chunks.length ? (
                  <dl>
                    {analysis.chunks.map((x, i) => (
                      <div key={i}>
                        <dt>{x.text}</dt>
                        <dd>{x.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="muted">这句没有特别需要整体记忆的搭配。</p>
                )}
              </section>
              <section aria-label="难词释义">
                <h3>
                  难词释义 <span>IN CONTEXT</span>
                </h3>
                {analysis.vocabulary.length ? (
                  <dl>
                    {analysis.vocabulary.map((x, i) => (
                      <div key={i}>
                        <dt>{x.text}</dt>
                        <dd>{x.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="muted">这句没有需要额外解释的难词。</p>
                )}
              </section>
            </div>
          )}
          <p className="preference-note">展示偏好保存在当前浏览器</p>
        </section>
      )}
      {!result && !busy && !error && (
        <div className="empty-note">
          <span className="empty-rule" />
          <p>
            主语、谓语、宾语，以及它们之间的关系。
            <br />
            <span>让复杂的句子，回到可以理解的顺序。</span>
          </p>
        </div>
      )}
      <footer>
        为理解留一点空间。<span>AI 分析可能有误，请结合上下文判断。</span>
      </footer>
    </main>
  );
}
