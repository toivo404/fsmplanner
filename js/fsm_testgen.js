/* js/fsm_testgen.js — Brute test-case rollout based on guards and transitions */

const TestGen = (() => {

    function showModal() {
        document.getElementById('modal-tests').style.display = 'flex';
        document.getElementById('test-output').textContent = generate();
    }

    function hideModal() {
        document.getElementById('modal-tests').style.display = 'none';
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(document.getElementById('test-output').textContent)
            .then(() => alert('Copied to clipboard!'));
    }

    function download() {
        const text = document.getElementById('test-output').textContent;
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'fsm_tests.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    /** BFS from initialId to find all reachable state IDs. */
    function bfsReachable(states, transitions, initialId) {
        if (!initialId) return new Set(states.map(s => s.id)); // no initial = treat all as reachable
        const visited = new Set();
        const queue   = [initialId];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            transitions.filter(t => t.source === id).forEach(t => {
                if (!visited.has(t.target)) queue.push(t.target);
            });
        }
        return visited;
    }

    function generate() {
        const { states, transitions } = Core.getFSMData();
        if (!states.length) return '// No states defined.';

        const initial    = states.find(s => s.initial);
        const reachable  = bfsReachable(states, transitions, initial ? initial.id : null);
        const allGuards  = [...new Set(transitions.map(t => t.guard).filter(g => g && g.trim() !== ''))];
        const unreachable = states.filter(s => !reachable.has(s.id));

        const lines  = [];
        let   tcNum  = 0;

        function tc(title, given, when, then, tags) {
            tcNum++;
            lines.push(`TC-${String(tcNum).padStart(3, '0')}: ${title}`);
            lines.push(`  GIVEN: ${given}`);
            lines.push(`  WHEN:  ${when}`);
            lines.push(`  THEN:  ${then}`);
            if (tags && tags.length) lines.push(`  TAGS:  [${tags.join(', ')}]`);
            lines.push('');
        }

        // ── Header ────────────────────────────────────────────────────────────
        lines.push('========================================');
        lines.push('  FSM Test Cases (Auto-generated)');
        lines.push('========================================');
        lines.push('');

        // ── Initial state ─────────────────────────────────────────────────────
        lines.push('--- INITIAL STATE ---');
        lines.push('');
        if (initial) {
            tc(
                'FSM starts in the declared initial state',
                'A new FSM instance is created with default constructor',
                'No transition is triggered',
                `State equals "${initial.label}"`,
                ['initial', 'smoke']
            );
        } else {
            lines.push('// WARNING: No initial state marked — set one via right-click → Set as Initial State\n');
        }

        // ── Positive: each transition fires when its guard is true ────────────
        lines.push('--- POSITIVE TRANSITIONS ---');
        lines.push('');
        transitions.forEach(t => {
            const src  = states.find(s => s.id === t.source);
            const tgt  = states.find(s => s.id === t.target);
            if (!src || !tgt) return;

            const guard    = t.guard && t.guard.trim() ? t.guard.trim() : null;
            const tags     = ['positive'];
            if (!reachable.has(src.id)) tags.push('unreachable-state');

            if (guard) {
                // Pass target guard=true; all sibling guarded transitions set to false
                // so first-match is deterministic for this test
                const siblings = transitions
                    .filter(x => x.source === t.source && x.id !== t.id && x.guard && x.guard.trim())
                    .map(x => `"${x.guard.trim()}"=false`);
                const whenParts = [`"${guard}"=true`, ...siblings];
                tc(
                    `"${src.label}" → "${tgt.label}" when guard "${guard}" is true`,
                    `FSM is in state "${src.label}"`,
                    `transition() called with { ${whenParts.join(', ')} }`,
                    `State changes to "${tgt.label}"`,
                    tags
                );
            } else {
                tc(
                    `"${src.label}" → "${tgt.label}" unconditional`,
                    `FSM is in state "${src.label}"`,
                    `transition() called (any or no guards)`,
                    `State changes to "${tgt.label}"`,
                    [...tags, 'unconditional']
                );
            }
        });

        if (!transitions.length) lines.push('// No transitions defined.\n');

        // ── Negative: all guards false → no transition ────────────────────────
        lines.push('--- NEGATIVE: GUARDS FALSE (no transition) ---');
        lines.push('');
        let hasNeg = false;
        states.forEach(src => {
            const outgoing         = transitions.filter(t => t.source === src.id);
            const guardedOutgoing  = outgoing.filter(t => t.guard && t.guard.trim() !== '');
            const hasUnconditional = outgoing.some(t => !t.guard || t.guard.trim() === '');

            // Skip: no guarded outgoing, or an unconditional exit exists (state cannot stay)
            if (!guardedOutgoing.length || hasUnconditional) return;
            hasNeg = true;

            const allFalse = guardedOutgoing.map(t => `"${t.guard.trim()}"=false`).join(', ');
            const tags     = ['negative'];
            if (!reachable.has(src.id)) tags.push('unreachable-state');

            tc(
                `"${src.label}" stays when all guards are false`,
                `FSM is in state "${src.label}"`,
                `transition() called with { ${allFalse} }`,
                `State remains "${src.label}"`,
                tags
            );
        });
        if (!hasNeg) lines.push('// No purely-guarded states (all either have unconditional exits or no outgoing transitions).\n');

        // ── Guard isolation: negate one guard at a time (multi-guarded states) ─
        lines.push('--- GUARD ISOLATION (one guard negated at a time) ---');
        lines.push('');
        let hasIso = false;
        states.forEach(src => {
            const guardedOutgoing = transitions.filter(t =>
                t.source === src.id && t.guard && t.guard.trim() !== ''
            );
            if (guardedOutgoing.length < 2) return;
            hasIso = true;

            guardedOutgoing.forEach(t => {
                const tgt = states.find(s => s.id === t.target);
                if (!tgt) return;
                const thisFalse  = `"${t.guard.trim()}"=false`;
                const otherTrue  = guardedOutgoing
                    .filter(x => x.id !== t.id)
                    .map(x => `"${x.guard.trim()}"=true`)
                    .join(', ');
                const tags = ['negative', 'guard-isolation'];
                if (!reachable.has(src.id)) tags.push('unreachable-state');

                tc(
                    `"${src.label}" does NOT go to "${tgt.label}" when "${t.guard.trim()}" is false`,
                    `FSM is in state "${src.label}"`,
                    `transition() called with { ${thisFalse}${otherTrue ? ', ' + otherTrue : ''} }`,
                    `State does NOT become "${tgt.label}"`,
                    tags
                );
            });
        });
        if (!hasIso) lines.push('// No states with 2+ guarded outgoing transitions — guard isolation not applicable.\n');

        // ── Priority: multiple guards true simultaneously ─────────────────────
        lines.push('--- PRIORITY (first-match wins when multiple guards true) ---');
        lines.push('');
        let hasPrio = false;
        states.forEach(src => {
            const guardedOutgoing = transitions.filter(t =>
                t.source === src.id && t.guard && t.guard.trim() !== ''
            );
            if (guardedOutgoing.length < 2) return;
            hasPrio = true;

            const allTrue      = guardedOutgoing.map(t => `"${t.guard.trim()}"=true`).join(', ');
            const firstTarget  = states.find(s => s.id === guardedOutgoing[0].target);
            const tags         = ['priority', 'first-match'];
            if (!reachable.has(src.id)) tags.push('unreachable-state');

            tc(
                `"${src.label}" takes FIRST matching transition when all guards true`,
                `FSM is in state "${src.label}"`,
                `transition() called with { ${allTrue} }`,
                `State changes to "${firstTarget ? firstTarget.label : '?'}" (first defined transition wins)`,
                tags
            );

            // Also test each consecutive pair
            for (let i = 0; i < guardedOutgoing.length - 1; i++) {
                const a   = guardedOutgoing[i];
                const b   = guardedOutgoing[i + 1];
                const tA  = states.find(s => s.id === a.target);
                const tB  = states.find(s => s.id === b.target);
                if (!tA || !tB) continue;
                tc(
                    `"${src.label}" prefers "${tA.label}" over "${tB.label}" (guard order)`,
                    `FSM is in state "${src.label}"`,
                    `transition() called with { "${a.guard.trim()}"=true, "${b.guard.trim()}"=true }`,
                    `State changes to "${tA.label}", NOT "${tB.label}"`,
                    ['priority', 'pairwise']
                );
            }
        });
        if (!hasPrio) lines.push('// No states with multiple guarded outgoing transitions — priority tests not applicable.\n');

        // ── Terminal states ───────────────────────────────────────────────────
        lines.push('--- TERMINAL STATES (no outgoing transitions) ---');
        lines.push('');
        const terminals = states.filter(s => !transitions.some(t => t.source === s.id));
        if (terminals.length) {
            terminals.forEach(s => {
                const tags = ['terminal', 'negative'];
                if (!reachable.has(s.id)) tags.push('unreachable-state');
                tc(
                    `Terminal state "${s.label}" ignores transition() calls`,
                    `FSM is in state "${s.label}"`,
                    `transition() called with any guards`,
                    `State remains "${s.label}"`,
                    tags
                );
            });
        } else {
            lines.push('// No terminal states — every state has at least one outgoing transition.\n');
        }

        // ── Self-loop tests ───────────────────────────────────────────────────
        const selfLoops = transitions.filter(t => t.source === t.target);
        if (selfLoops.length) {
            lines.push('--- SELF-LOOPS ---');
            lines.push('');
            selfLoops.forEach(t => {
                const src   = states.find(s => s.id === t.source);
                if (!src) return;
                const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                const tags  = ['self-loop'];
                if (!reachable.has(src.id)) tags.push('unreachable-state');
                if (guard) {
                    tc(
                        `Self-loop on "${src.label}" when "${guard}" is true`,
                        `FSM is in state "${src.label}"`,
                        `transition() called with { "${guard}"=true }`,
                        `State remains "${src.label}" (self-loop executed)`,
                        tags
                    );
                } else {
                    tc(
                        `Unconditional self-loop on "${src.label}"`,
                        `FSM is in state "${src.label}"`,
                        `transition() called`,
                        `State remains "${src.label}" (unconditional self-loop)`,
                        [...tags, 'unconditional']
                    );
                }
            });
        }

        // ── Unreachable state warnings ────────────────────────────────────────
        if (unreachable.length) {
            lines.push('--- WARNINGS: UNREACHABLE STATES ---');
            lines.push('');
            unreachable.forEach(s =>
                lines.push(`// WARN: State "${s.label}" (id=${s.id}) is unreachable from the initial state.`)
            );
            lines.push('');
        }

        // ── Summary ───────────────────────────────────────────────────────────
        lines.push('========================================');
        lines.push('  SUMMARY');
        lines.push('========================================');
        lines.push(`Total test cases : ${tcNum}`);
        lines.push(`States           : ${states.length}${initial ? `  (initial: "${initial.label}")` : '  (no initial defined)'}`);
        lines.push(`Transitions      : ${transitions.length}`);
        lines.push(`Unique guards    : ${allGuards.length}${allGuards.length ? '  — ' + allGuards.map(g => `"${g}"`).join(', ') : ''}`);
        lines.push(`Unreachable      : ${unreachable.length}${unreachable.length ? '  — ' + unreachable.map(s => `"${s.label}"`).join(', ') : ''}`);
        lines.push(`Terminal states  : ${terminals.length}${terminals.length ? '  — ' + terminals.map(s => `"${s.label}"`).join(', ') : ''}`);

        return lines.join('\n');
    }

    return { showModal, hideModal, copyToClipboard, download, generate };
})();
