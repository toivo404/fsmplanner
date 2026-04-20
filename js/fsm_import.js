/* js/fsm_import.js — JSON import supporting rich and legacy formats */

const ImportFSM = (() => {

    function trigger() {
        document.getElementById('importFile').click();
    }

    function handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const raw  = JSON.parse(e.target.result);
                const data = normalize(raw);
                Core.loadFSMData(data);
            } catch (err) {
                alert('Failed to import: ' + err.message);
            }
            event.target.value = ''; // allow re-importing same file
        };
        reader.readAsText(file);
    }

    /**
     * Normalises any supported format into the rich canonical form:
     *   { states: [{id, label, x, y, initial}], transitions: [{id, source, target, guard}] }
     *
     * Supported input formats:
     *  - Rich:   states[].id present
     *  - Legacy: states[] is array of strings, transitions use {from, to, guard}
     */
    function normalize(raw) {
        if (!raw || typeof raw !== 'object') throw new Error('JSON must be an object');

        const statesRaw = raw.states || [];

        // ── Rich format ──────────────────────────────────────────────────────
        if (statesRaw.length > 0 && typeof statesRaw[0] === 'object' && statesRaw[0].id) {
            let tCounter = 0;
            const transitions = (raw.transitions || []).map(t => ({
                id:     t.id  || ('e' + (tCounter++)),
                source: t.source,
                target: t.target,
                guard:  t.guard != null ? String(t.guard) : ''
            }));
            return { states: statesRaw, transitions };
        }

        // ── Legacy format ────────────────────────────────────────────────────
        // states is an array of strings; transitions use {from, to, guard}
        const seen = new Set();
        for (const label of statesRaw) {
            if (typeof label !== 'string') throw new Error('Legacy format expects states to be strings');
            if (seen.has(label)) throw new Error(`Duplicate state label in legacy format: "${label}"`);
            seen.add(label);
        }

        const stateMap = {};
        let nCounter = 0;
        const states = statesRaw.map(label => {
            const id = 'n' + (nCounter++);
            stateMap[label] = id;
            return { id, label, x: (nCounter - 1) * 160 + 100, y: 250, initial: nCounter === 1 };
        });

        let tCounter = 0;
        const transitions = (raw.transitions || []).map(t => {
            const source = stateMap[t.from];
            const target = stateMap[t.to];
            if (!source) throw new Error(`Unknown state in transition from: "${t.from}"`);
            if (!target) throw new Error(`Unknown state in transition to: "${t.to}"`);
            return { id: 'e' + (tCounter++), source, target, guard: t.guard || '' };
        });

        return { states, transitions };
    }

    return { trigger, handleFile };
})();
