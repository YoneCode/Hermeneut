/**
 * Features. A varied grid, not identical cards: the precedent graph is the
 * lead idea and spans wide; the rest are supporting capabilities. No icons,
 * no eyebrows; the title carries the weight.
 */
const LEAD = {
  title: "A precedent graph that grows its own common law",
  body: "Every resolved claim becomes a node with weighted citation edges to the precedents it relied on. Landmark verdicts carry more influence. Because each new judgment is read in the light of past ones, the protocol is path-dependent: the order in which disputes are settled shapes how later disputes resolve.",
};

const FEATURES = [
  {
    title: "Dual-track consensus",
    body: "Low-stake disputes resolve through the equivalence principle, tolerant of wording. High-stake disputes run a stricter validator gate that checks conclusion, confidence delta, and citation overlap.",
  },
  {
    title: "Greybox sanitization",
    body: "Every user string is normalized, stripped of injection patterns, and fenced as data before a model reads it. Precedent text is re-sanitized on each retrieval, so the graph cannot become an attack vector.",
  },
  {
    title: "Stake and slash",
    body: "Claimants stake GEN; a rejected claim is slashed, a fulfilled one releases the escrow. Validators stake to participate and can be penalized for misbehavior.",
  },
  {
    title: "Tiered model routing",
    body: "Dispute level sets the validator count and model pool, so cost escalates only when a disagreement actually warrants heavier judgment.",
  },
  {
    title: "Ghost-contract escrow",
    body: "Capital can sit in an EVM escrow referenced from the GenLayer contract, settled through a two-phase signal once a verdict is reached.",
  },
];

export default function Features() {
  return (
    <section id="features" className="ht-band">
      <div className="ht-wrap">
        <div className="ht-section__head" data-reveal>
          <h2 className="ht-h2">Not a vote. A judgment.</h2>
          <p className="ht-lead">
            Oracles report numbers. HERMENEUT interprets language, and remembers
            how it ruled last time.
          </p>
        </div>

        <div className="ht-features" data-reveal>
          <article className="ht-feature ht-feature--lead ht-box">
            <span className="ht-corner-bl" /><span className="ht-corner-br" />
            <h3 className="ht-h3">{LEAD.title}</h3>
            <p>{LEAD.body}</p>
          </article>
          {FEATURES.map((f) => (
            <article key={f.title} className="ht-feature ht-box">
              <span className="ht-corner-bl" /><span className="ht-corner-br" />
              <h3 className="ht-h3">{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
