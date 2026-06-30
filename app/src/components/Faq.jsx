/**
 * FAQ — native <details>/<summary> so it is keyboard- and screen-reader-
 * accessible with no JS and no dependency. Left-aligned, single column,
 * generous spacing.
 */
const QA = [
  {
    q: "What does HERMENEUT actually do?",
    a: "It escrows value against an obligation written in plain language, then resolves whether that obligation was met using a network of LLM validators instead of a single trusted oracle. The outcome releases or slashes the staked funds.",
  },
  {
    q: "How do validators reach a verdict?",
    a: "Each validator independently reads the claim's evidence and the relevant precedent, then produces a structured judgment (conclusion, confidence, cited precedents). For low-stake claims they must agree under an equivalence principle that tolerates wording differences; for high-stake claims a stricter programmatic gate enforces matching conclusions and bounded confidence and citation deltas.",
  },
  {
    q: "What is the Recursive Precedent Graph?",
    a: "A store of every past verdict, linked by weighted citation edges. New claims are evaluated in the light of related precedents, so the system builds a body of case law over time rather than judging each dispute in isolation.",
  },
  {
    q: "What happens to my stake?",
    a: "When you submit a claim you stake GEN. If validators rule the obligation fulfilled, the escrow is released and your stake returns. If they rule it unfulfilled, a portion of your stake is slashed, which discourages frivolous claims.",
  },
  {
    q: "Which wallet and network do I need?",
    a: "Sign in with Privy, which provisions a wallet for you. The protocol runs on the GenLayer Bradbury testnet (chain id 4221). Reads are free; registering, claiming, and evaluating are transactions that need a small amount of Bradbury GEN from the faucet.",
  },
  {
    q: "Is this production-ready?",
    a: "It is a working testnet deployment, not audited for mainnet value. The contract, the consensus flow, and the precedent graph are live and verifiable on the Bradbury explorer; treat it as a research-grade protocol.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="ht-section">
      <div className="ht-section__head">
        <h2 className="ht-display ht-h2">Questions worth asking.</h2>
        <p className="ht-lead">
          How the protocol behaves, what it costs you, and what it does not
          yet promise.
        </p>
      </div>

      <div className="ht-faq">
        {QA.map((item) => (
          <details key={item.q} className="ht-faq__item">
            <summary>
              <span>{item.q}</span>
              <span className="ht-faq__sign" aria-hidden />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
