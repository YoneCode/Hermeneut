/**
 * How it works — a genuine ordered sequence (register, claim, evaluate),
 * so the step numbers carry real information. Left-aligned, connected
 * vertical rail rather than three identical cards.
 */
const STEPS = [
  {
    n: "1",
    title: "Register an obligation",
    body: "A creator escrows GEN against a sentence in plain language. A coherence check rejects contradictory or paradoxical wording before any capital is locked.",
    sample: "\u201cThe team ships an open-source v2 on GitHub before Q3 2026.\u201d",
  },
  {
    n: "2",
    title: "Stake a claim",
    body: "A beneficiary stakes GEN and submits evidence, free text plus source URLs, arguing that the condition has been met.",
    sample: "Evidence: a release tag, a published report, an on-chain balance.",
  },
  {
    n: "3",
    title: "Reach consensus",
    body: "LLM validators read the evidence, weigh it against the relevant precedent, and vote. The verdict releases or slashes the stake, and is written back as new case law.",
    sample: "Verdict: fulfilled or unfulfilled, with a confidence score.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="ht-section">
      <div className="ht-section__head">
        <h2 className="ht-display ht-h2">From a sentence to a settled verdict.</h2>
        <p className="ht-lead">
          HERMENEUT turns an ambiguous promise into an enforceable, on-chain
          decision. Three steps, each a real transaction on GenLayer Bradbury.
        </p>
      </div>

      <ol className="ht-steps">
        {STEPS.map((s) => (
          <li key={s.n} className="ht-step">
            <span className="ht-step__n ht-display">{s.n}</span>
            <div className="ht-step__body">
              <h3 className="ht-h3">{s.title}</h3>
              <p>{s.body}</p>
              <p className="ht-step__sample ht-mono-label">{s.sample}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
