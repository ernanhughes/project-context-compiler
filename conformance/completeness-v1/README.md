# completeness-v1

Constructed cases for the completeness question (not part of the compiler-v1 conformance corpus, and
not compared with any frozen Python output).

`greedy-false-refusal`: mandatory content A has two forms. Form a1 (100 tokens) depends on resolver r
(500 tokens); form a2 (300 tokens) has no dependency. Required content B (b1, 50 tokens) also depends on r.
The compiler admits mandatory forms first by lowest marginal cost: a1 costs 600 with its resolver, a2 costs 300,
so it takes a2, and b1 then cannot afford r. The bundle {a1, b1, r} satisfies the declared constraints and
fits the 800-token budget, so a legal bundle exists.

Run `node scripts/feasibility-oracle.mjs conformance/completeness-v1` to compare the compiler with an
exhaustive enumeration of legal subsets. The oracle shares the compiler's cost units and its
assumption that two forms of one content identity may not coexist.
