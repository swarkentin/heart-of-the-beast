#!/usr/bin/env python3
"""Build a compact PR balance dashboard comparing head with the branch point."""
import argparse
import json
from pathlib import Path


def read_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def chart(labels, title, axis, series):
    if not labels:
        return f"### {title}\n\n_No comparable data._\n"
    quoted = ", ".join(json.dumps(label) for label in labels)
    lines = [f"### {title}", "", "```mermaid", "xychart-beta",
             f"    x-axis [{quoted}]", f"    y-axis {axis} 0 --> 100"]
    for kind, values in series:
        lines.append(f"    {kind} [{', '.join(f'{value:.1f}' for value in values)}]")
    lines.append("```")
    return "\n".join(lines) + "\n"


def solo_endless(report):
    return {
        scenario["party"][0]: scenario
        for scenario in report["scenarios"]
        if scenario.get("partySize") == 1
        and len(scenario.get("party", [])) == 1
        and scenario.get("policy") == "tactical"
    }


def class_combat_rates(report):
    rates = {}
    for scenario in report["scenarios"]:
        if scenario.get("partySize") == 1 and len(scenario.get("classIds", [])) == 1:
            rates.setdefault(scenario["classIds"][0], []).append(
                scenario["summary"]["winRate"] * 100
            )
    return {class_id: sum(values) / len(values) for class_id, values in rates.items()}


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
    changed_encounters = [item for item in deltas if abs(item[3]) >= 0.0001]
    changed_encounters.sort(key=lambda item: abs(item[3]), reverse=True)

    old_endless = solo_endless(before_endless)
    new_endless = solo_endless(after_endless)
    classes = sorted(set(old_endless) & set(new_endless) & set(class_combat_rates(after)))
    old_combat = class_combat_rates(before)
    new_combat = class_combat_rates(after)
    labels = [class_id.replace("-", " ").title() for class_id in classes]
    combat_values = [new_combat[class_id] for class_id in classes]
    completion_values = [
        new_endless[class_id]["completed"] / new_endless[class_id]["runs"] * 100
        if new_endless[class_id]["runs"] else 0
        for class_id in classes
    ]
    depth_values = [new_endless[class_id]["medianDepth"] for class_id in classes]

    lines = [
        "<!-- balance-regression-dashboard -->",
        "## Combat balance regression dashboard",
        "",
        f"Compared branch point `{args.base_sha[:10]}` with PR head `{args.head_sha[:10]}`.",
        "Both revisions use identical seed ranges and simulation settings.",
        "",
        chart(labels, "Current solo class performance: combat vs. endless completion",
              "Rate (%)", [("bar", combat_values), ("line", completion_values)]),
        "Bars: mean encounter win rate across the solo encounter suite. Line: endless first-dungeon clear rate (tactical policy).",
        "",
        chart(labels, "Current solo endless expedition median depth",
              f"Depth (max {max(depth_values, default=1)})",
              [("bar", depth_values)]),
        "### Changes since branch point",
        "",
        f"**Encounter win rate:** {len(changed_encounters)} of {len(deltas)} matched scenarios changed.",
        "",
        "| Scenario | Branch point | PR head | Change |",
        "|---|---:|---:|---:|",
    ]
    if changed_encounters:
        for name, old, new, delta in changed_encounters[:12]:
            lines.append(f"| {name} | {old:.0%} | {new:.0%} | {delta * 100:+.1f} pp |")
    else:
        lines.append("| _No encounter win-rate changes detected._ | — | — | 0.0 pp |")

    changed_endless = []
    for class_id in classes:
        old = old_endless[class_id]
        new = new_endless[class_id]
        old_clear = old["completed"] / old["runs"] if old["runs"] else 0
        new_clear = new["completed"] / new["runs"] if new["runs"] else 0
        depth_delta = new["medianDepth"] - old["medianDepth"]
        clear_delta = (new_clear - old_clear) * 100
        combat_delta = new_combat[class_id] - old_combat.get(class_id, new_combat[class_id])
        if depth_delta or abs(clear_delta) >= 0.0001 or abs(combat_delta) >= 0.0001:
            changed_endless.append((class_id, old, new, depth_delta, clear_delta, combat_delta))

    lines.extend(["", f"**Endless/class metrics:** {len(changed_endless)} of {len(classes)} classes changed.",
                  ""])
    if changed_endless:
        lines.extend(["| Class | Median depth change | Clear-rate change | Combat win-rate change |",
                      "|---|---:|---:|---:|"])
        for class_id, _, _, depth_delta, clear_delta, combat_delta in changed_endless:
            lines.append(f"| {class_id} | {depth_delta:+d} | {clear_delta:+.1f} pp | {combat_delta:+.1f} pp |")
    else:
        lines.append("No solo class metrics changed from the branch point.")

    lines.extend([
        "",
        "### Interpretation",
        "",
        "- Encounter comparisons pair matching scenarios with the same 30 seeds.",
        "- Endless comparisons use the same 12 seeds, party compositions, random theme selection, and tactical policy.",
        "- These are small deterministic samples, not statistical proof; treat changes as investigation signals and validate with playtests.",
        "- New or missing scenarios are excluded from deltas rather than treated as zero.",
        "",
        f"_Combat report v{after.get('version', 'unknown')} · seeds {after.get('firstSeed')}–{after.get('lastSeed')} · {len(after.get('scenarios', []))} scenarios._",
    ])
    Path(args.output).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
