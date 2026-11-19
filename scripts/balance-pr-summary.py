#!/usr/bin/env python3
"""Build a PR balance dashboard with absolute results and branch-point deltas."""
import argparse
import json
from pathlib import Path


def read_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def chart(labels, title, subtitle, values):
    if not labels:
        return f"### {title}\n\n_No comparable data._\n"
    quoted = ", ".join(json.dumps(label) for label in labels)
    fence = chr(96) * 3
    lines = [
        f"### {title}",
        "",
        subtitle,
        "",
        fence + "mermaid",
        "xychart-beta",
        f"    x-axis [{quoted}]",
        '    y-axis "Rate (%)" 0 --> 100',
        f"    bar [{', '.join(f'{value:.1f}' for value in values)}]",
        fence,
        "",
        "**Values:** " + " · ".join(
            f"{label}: {value:.1f}%" for label, value in zip(labels, values)
        ),
        "",
    ]
    return "\n".join(lines)


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
        class_ids = scenario.get("classIds", [])
        if scenario.get("partySize") == 1 and len(class_ids) == 1:
            rates.setdefault(class_ids[0], []).append(scenario["summary"]["winRate"] * 100)
    return {class_id: sum(values) / len(values) for class_id, values in rates.items()}


def clear_rate(scenario):
    runs = scenario.get("runs", 0)
    return scenario.get("completed", 0) / runs * 100 if runs else 0.0


def initial_theme_summary(scenarios):
    """Group solo tactical first-dungeon outcomes by the actual seeded starting theme."""
    buckets = {}
    for scenario in scenarios:
        if scenario.get("partySize") != 1 or scenario.get("policy") != "tactical":
            continue
        for run in scenario.get("results", []):
            theme = run.get("initialThemeId") or run.get("themeId") or "unknown"
            bucket = buckets.setdefault(theme, {"runs": 0, "cleared": 0, "wiped": 0})
            bucket["runs"] += 1
            bucket["cleared"] += int(run.get("dungeonsCleared", 0) >= 1)
            bucket["wiped"] += int(bool(run.get("wiped")))
    return buckets



def depth_reach_summary(scenario):
    rates = {
        int(depth): float(rate) * 100
        for depth, rate in scenario.get("depthReachRates", {}).items()
    }
    if not rates:
        return "No depth data", "—", "—", "—"

    depths = sorted(rates)
    segments = []
    start = previous = depths[0]
    rate = rates[start]
    for depth in depths[1:]:
        if depth == previous + 1 and abs(rates[depth] - rate) < 0.01:
            previous = depth
            continue
        span = f"D{start}" if start == previous else f"D{start}–{previous}"
        segments.append(f"{span}: {rate:.1f}%")
        start = previous = depth
        rate = rates[depth]
    span = f"D{start}" if start == previous else f"D{start}–{previous}"
    segments.append(f"{span}: {rate:.1f}%")

    at_least_half = [depth for depth, value in rates.items() if value >= 50]
    half_depth = f"D{max(at_least_half)}" if at_least_half else "Below 50% at D1"

    largest_drop = (0.0, None, None)
    for depth in depths:
        next_rate = rates.get(depth + 1, 0.0)
        drop = rates[depth] - next_rate
        if drop > largest_drop[0]:
            largest_drop = (drop, depth, depth + 1)
    if largest_drop[1] is None:
        drop_text = "—"
    else:
        drop_text = f"D{largest_drop[1]}→D{largest_drop[2]} (−{largest_drop[0]:.1f} pp)"

    furthest = max(depths)
    reached_count = round(rates[furthest] * scenario.get("runs", 0) / 100)
    furthest_text = f"D{furthest} ({reached_count}/{scenario.get('runs', 0)} runs)"
    return " · ".join(segments), half_depth, drop_text, furthest_text


def depth_progression_chart(classes, scenarios):
    """Render one comparable reach-rate line per solo class."""
    if not classes:
        return "### Endless depth reached by class\n\n_No comparable data._\n"

    max_depth = max(
        (int(depth) for class_id in classes
         for depth in scenarios[class_id].get("depthReachRates", {})),
        default=0,
    )
    if max_depth == 0:
        return "### Endless depth reached by class\n\n_No depth data._\n"

    fence = chr(96) * 3
    lines = [
        "### Endless depth reached by class",
        "",
        "Share of solo tactical-policy runs that reach each depth. Each line is a class; a steeper drop means more runs are ending at that point.",
        "",
        fence + "mermaid",
        "xychart-beta",
        f'    x-axis "Endless depth" 1 --> {max_depth}',
        '    y-axis "Runs reaching depth (%)" 0 --> 100',
    ]
    for class_id in classes:
        rates = scenarios[class_id].get("depthReachRates", {})
        values = [
            float(rates.get(str(depth), rates.get(depth, 0))) * 100
            for depth in range(1, max_depth + 1)
        ]
        series = ", ".join(f"{value:.1f}" for value in values)
        label = class_id.replace("-", " ").title()
        lines.append(f'    line {json.dumps(label)} [{series}]')
    lines.extend([fence, ""])
    return "\n".join(lines)

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
        if previous is not None:
            old = previous["summary"]["winRate"]
            new = current["summary"]["winRate"]
            deltas.append((current["id"], old, new, new - old))
    changed_encounters = sorted(
        (item for item in deltas if abs(item[3]) >= 0.0001),
        key=lambda item: abs(item[3]), reverse=True,
    )

    old_endless = solo_endless(before_endless)
    new_endless = solo_endless(after_endless)
    old_combat = class_combat_rates(before)
    new_combat = class_combat_rates(after)
    classes = sorted(set(old_endless) & set(new_endless) & set(old_combat) & set(new_combat))
    labels = [class_id.replace("-", " ").title() for class_id in classes]

    current_combat = [new_combat[c] for c in classes]
    current_clear = [clear_rate(new_endless[c]) for c in classes]
    combat_encounters = len({
        scenario.get("encounterId")
        for scenario in after["scenarios"]
        if scenario.get("partySize") == 1
        and len(scenario.get("classIds", [])) == 1
    })
    combat_seeds = after.get("seedCount", 0)
    endless_runs = max((new_endless[c].get("runs", 0) for c in classes), default=0)

    lines = [
        "<!-- balance-regression-dashboard -->",
        "## Combat balance regression dashboard",
        "",
        f"Branch point: {args.base_sha[:10]} · PR head: {args.head_sha[:10]}.",
        "Both revisions were simulated with identical seed ranges and settings.",
        "",
        chart(
            labels,
            "Solo encounter win rate",
            f"Mean win rate across {combat_encounters} encounter types · "
            f"{combat_seeds} seeds each ({combat_encounters * combat_seeds} simulated fights per class).",
            current_combat,
        ),
        chart(
            labels,
            "Solo endless first-dungeon completion",
            f"Share of tactical-policy expeditions clearing dungeon one · "
            f"{endless_runs} seeded expeditions per class. At 100 runs, each run moves this rate by 1 percentage point.",
            current_clear,
        ),
        depth_progression_chart(classes, new_endless),
        "### Absolute results and changes by class",

        "",
        "| Class | Combat win rate: base → PR (Δ pp) | Endless clear: base → PR (Δ pp) | Median depth: base → PR (Δ) |",
        "|---|---:|---:|---:|",
    ]

    for class_id in classes:
        old_c, new_c = old_combat[class_id], new_combat[class_id]
        old_e, new_e = old_endless[class_id], new_endless[class_id]
        old_clear, new_clear = clear_rate(old_e), clear_rate(new_e)
        old_depth, new_depth = old_e["medianDepth"], new_e["medianDepth"]
        lines.append(
            f"| {class_id} | {old_c:.1f}% → {new_c:.1f}% ({new_c-old_c:+.1f}) "
            f"| {old_clear:.1f}% → {new_clear:.1f}% ({new_clear-old_clear:+.1f}) "
            f"| {old_depth} → {new_depth} ({new_depth-old_depth:+d}) |"
        )

    theme_buckets = initial_theme_summary(after_endless.get("scenarios", []))
    lines.extend([
        "",
        "### First-dungeon outcomes by seeded starting theme",
        "",
        "Solo tactical expeditions grouped by the actual first theme selected by the seed. This separates theme difficulty from the aggregate class result; counts are absolute, not percentages alone.",
        "",
        "| Starting theme | Expeditions | First dungeon cleared | Wiped |",
        "|---|---:|---:|---:|",
    ])
    for theme, bucket in sorted(theme_buckets.items()):
        total = bucket["runs"]
        cleared = bucket["cleared"]
        wiped = bucket["wiped"]
        lines.append(
            f"| {theme} | {total} | {cleared}/{total} ({cleared/total*100:.1f}%) "
            f"| {wiped}/{total} ({wiped/total*100:.1f}%) |"
        )

    lines.extend([
        "",
        "### Endless depth progression by class",
        "",
        "Percent of seeded solo expeditions reaching each depth (tactical policy). Equal consecutive rates are grouped into ranges. The 50% column is the deepest level reached by at least half the runs; the largest drop shows the sharpest one-depth loss.",
        "",
        "| Class | Reach rate by depth | At least 50% reach through | Largest one-depth drop | Furthest reached |",
        "|---|---|---:|---|---:|",
    ])
    for class_id in classes:
        progression, half_depth, largest_drop, furthest = depth_reach_summary(new_endless[class_id])
        lines.append(
            f"| {class_id} | {progression} | {half_depth} | {largest_drop} | {furthest} |"
        )

    lines.extend([
        "",
        "### Encounter-level changes",
        "",
        f"{len(changed_encounters)} of {len(deltas)} matched scenarios changed win rate.",
        "",
        "| Scenario | Branch point | PR head | Change |",
        "|---|---:|---:|---:|",
    ])
    if changed_encounters:
        for name, old, new, delta in changed_encounters[:15]:
            lines.append(f"| {name} | {old:.1%} | {new:.1%} | {delta*100:+.1f} pp |")
    else:
        lines.append("| _No encounter win-rate changes._ | — | — | 0.0 pp |")

    lines.extend([
        "",
        "### Interpretation",
        "",
        "- Combat win rates average each class's solo results across the encounter suite; encounter-level deltas above show scenario-specific movement.",
        "- Endless results use solo tactical-policy runs, 100 paired seeds per class, and randomized seeded themes; the table above breaks first-dungeon outcomes out by starting theme.",
        "- A 100-run rate is still an estimate, not proof. Do not change class stats from one dashboard movement: look for consistent paired-seed drift across themes and depth/survival metrics, then validate with playtests.",
        "- Newly added or removed scenarios/classes are not silently treated as zero; only matched data appears in paired comparisons.",
        "",
        f"_Combat report v{after.get('version', 'unknown')} · seeds {after.get('firstSeed')}–{after.get('lastSeed')} · {len(after.get('scenarios', []))} scenarios._",
    ])
    Path(args.output).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
