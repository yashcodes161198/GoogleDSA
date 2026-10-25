# Interior.dev adapters

These are deliberately adapted excerpts of the MIT-licensed [Interior.dev components](https://www.interior.dev/docs), not an installed Interior package. Upstream explicitly supports keeping the behavior or presentation that fits the host application.

Source: [ddoemonn/interior at b6b272307464ba79db7183cee0515846d7eb1f9c](https://github.com/ddoemonn/interior/tree/b6b272307464ba79db7183cee0515846d7eb1f9c/components/interior). Copyright (c) 2026 ozzy. The upstream [MIT license](./LICENSE) applies to the adapted portions.

The files retain upstream spring parameters, overlapping label faces, press cancellation, keyed value transitions, SVG morphs, star-burst geometry and reduced-motion handling. Styling uses Google DSA's palette tokens rather than Interior's hard-coded demo colors.

Application state remains outside these components. In particular, do not replace the existing session library's optimistic updates with Interior's optimistic-like hook, wrap server actions in a second async runner, replace native radio form values with button state, or replace native links with tabs. Native button props, refs, default submit behavior, disabled fieldsets, labels and click handlers pass through `PressButton`.

`Disclosure` animates arrival while keeping natural height: the question picker changes size and has an overflowing listbox. `SortIndicator` retains the native table and its existing three-way, domain-specific sorting. `PageNumber` retains Previous/Next and URL pagination instead of adding a new numbered-page interaction. `SkeletonSwap` introduces no minimum wait, scroll container, or mounted hidden forms. Tooltip timing is local to each trigger, preserving standalone usage. Popover placement, hover/pinning and dismissal remain owned by their existing hosts.

See [the catalog assessment](../../docs/INTERIOR_UI_MIGRATION.md) for every catalog entry and the acceptance checks.
