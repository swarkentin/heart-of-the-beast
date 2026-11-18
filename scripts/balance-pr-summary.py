#!/usr/bin/env python3
"""Build a compact PR balance dashboard comparing head with the branch point."""
import argparse
import json
from pathlib import Path


def read_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def pct(value):
    return f"{value * 100:+.1f} pp"


def chart(labels, values, title, axis, bounds=None):
    if not labels:
        return f"### {title}\n\n_No comparable data._\n"
    maximum = bounds if bounds is not None else max(1, max(values, default=0))
    quoted = ", ".join(json.dumps(label) for label in labels)
    nums = ", ".join(f"{value:.1f}" for value in values)
    return (f"### {title}\n\n```mermaid\nxychart-beta\n"
            f"    x-axis [{quoted}]\n    y-axis {axis} 0 --> {maximum}\n"
            f"    bar [{nums}]\n```\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-combat", required=True)
    parser.add_argument("--head-combat", required=True)
    parser.add_argument("--baseline-endless", required=True)
    parser.add_argument("--head-endless", required=True)
    parser.add_argument("--base-sha", required=True)
    parser.add_argument("--head-sha", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    before = read_json(args.baseline_combat)
    after = read_json(args.head_combat)
    before_endless = read_json(args.baseline_endless)
    after_endless = read_json(args.head_endless)

    before_scenarios = {s["id"]: s for s in before["scenarios"]}
    deltas = []
    for current in after["scenarios"]:
        previous = before_scenarios.get(current["id"])
        if previous is None:
            continue
        old = previous["summary"]["winRate"]
        new = current["summary"]["winRate"]
        deltas.append((current["id"], old, new, new - old))
    deltas.sort(key=lambda item: abs(item[3]), reverse=True)

    def solo_endless(report):
        return {
            scenario["party"][0]: scenario
            for scenario in report["scenarios"]
            if scenario.get("partySize") == 1
            and len(scenario.get("party", [])) == 1
            and scenario.get("policy") == "tactical"
        }

    old_endless = solo_endless(before_endless)
    new_endless = solo_endless(after_endless)
    classes = sorted(set(old_endless) & set(new_endless))
    depth_deltas = [
        new_endless[c]["medianDepth"] - old_endless[c]["medianDepth"]
        for c in classes
    ]
    clear_deltas = [
        (new_endless[c]["completed"] / new_endless[c]["runs"]
         - old_endless[c]["completed"] / old_endless[c]["runs"]) * 100
        if new_endless[c]["runs"] and old_endless[c]["runs"] else 0
        for c in classes
    ]

    lines = [
        "<!-- balance-regression-dashboard -->",
        "## Combat balance regression dashboard",
        "",
        f"Compared branch point `{args.base_sha[:10]}` with PR head `{args.head_sha[:10]}`.",
        "Both revisions use the same deterministic seed ranges and simulation settings.",
        "",
        "### Largest encounter win-rate changes",
        "",
        "| Scenario | Branch point | PR head | Change |",
        "|---|---:|---:|---:|",
    ]
    if deltas:
        for name, old, new, delta in deltas[:12]:
            lines.append(f"| {name} | {old:.0%} | {new:.0%} | {pct(delta)} |")
    else:
        lines.append("| _No matching scenarios_ | — | — | — |")

    class_labels = [c.replace("-", " ").title() for c in classes]
    lines.extend(["", chart(class_labels, depth_deltas,
                            "Change in solo endless median depth by class",
                            "Depth change", max(1, max([abs(v) for v in depth_deltas], default=1)))])
    # Mermaid's y-axis starts at zero; render signed deltas as offset values and
    # disclose the offset so negative changes remain visible.
    offset = max([abs(v) for v in depth_deltas], default=0)
    if classes:
        depth_plot = [v + offset for v in depth_deltas]
        lines[-1] = chart(class_labels, depth_plot,
                          "Solo endless median depth change (offset for negative values)",
                          "Depth delta + offset", max(1, 2 * offset))
        lines.append(f"_Chart values are offset by {offset}; subtract that amount to read the signed change._")
        lines.extend(["", "| Class | Branch point median depth | PR head median depth | Change | First-dungeon clear-rate change |",
                      "|---|---:|---:|---:|---:|"])
        for c, delta, clear_delta in zip(classes, depth_deltas, clear_deltas):
            lines.append(f"| {c} | {old_endless[c]['medianDepth']} | {new_endless[c]['medianDepth']} | {delta:+d} | {clear_delta:+.1f} pp |")

    lines.extend([
        "",
        "### Interpretation",
        "",
        "- Encounter changes are paired by scenario and use the same 30 seeds.",
        "- Endless changes use the same 12 seeds, party composition, random theme policy, and tactical decision policy.",
        "- These are small deterministic samples, not statistical proof; treat deltas as investigation signals and validate in playtests.",
        "- Missing or newly introduced scenarios are not silently treated as zero-change.",
        "",
        f"_Combat report: {after.get('version', 'unknown')} · seeds {after.get('firstSeed')}–{after.get('lastSeed')} · {len(after.get('scenarios', []))} scenarios._",
    ])
    Path(args.output).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
