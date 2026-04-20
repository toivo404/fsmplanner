/* js/fsm_export_code.js — Code generators: C, C++, Python, JavaScript, Java, C#, PlantUML, Mermaid */

const ExportCode = (() => {

    // ── Identifier helpers ────────────────────────────────────────────────────

    /** Convert a free-form label to a safe identifier for the target language.
     *  All generators prefix with S_ to avoid reserved-word collisions and
     *  digit-leading identifiers. PlantUML/Mermaid use a simpler form. */
    function toId(label, lang) {
        if (lang === 'plantuml' || lang === 'mermaid') {
            return label.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'S';
        }
        const base = label.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'S';
        return 'S_' + base;
    }

    /** Collect unique non-empty guard strings from transitions. */
    function collectGuards(transitions) {
        return [...new Set(transitions.map(t => t.guard).filter(g => g && g.trim() !== ''))];
    }

    /** Convert a guard string to a C-style field name. */
    function guardToField(guard) {
        return (guard.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'guard');
    }

    // ── Modal plumbing ────────────────────────────────────────────────────────

    function showModal() {
        document.getElementById('modal-code').style.display = 'flex';
        update();
    }

    function hideModal() {
        document.getElementById('modal-code').style.display = 'none';
    }

    function update() {
        const lang = document.getElementById('code-lang').value;
        const { states, transitions } = Core.getFSMData();
        const gen  = GENERATORS[lang];
        document.getElementById('code-output').textContent =
            gen ? gen(states, transitions) : '// Language not implemented';
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(document.getElementById('code-output').textContent)
            .then(() => alert('Copied to clipboard!'));
    }

    function downloadCode() {
        const lang = document.getElementById('code-lang').value;
        const exts = { c: 'c', cpp: 'cpp', python: 'py', javascript: 'js', java: 'java', csharp: 'cs', plantuml: 'puml', mermaid: 'md' };
        const text = document.getElementById('code-output').textContent;
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'fsm.' + (exts[lang] || 'txt');
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── C ─────────────────────────────────────────────────────────────────────

    function genC(states, transitions) {
        const L      = 'c';
        const guards = collectGuards(transitions);
        const L2     = states.map(s => toId(s.label, L));
        const out    = [];

        out.push('/* Auto-generated FSM — first-match semantics for ambiguous transitions */');
        out.push('');
        out.push('typedef enum {');
        L2.forEach((id, i) => out.push(`    ${id}${i < L2.length - 1 ? ',' : ''}  /* ${states[i].label} */`));
        out.push('} State;');
        out.push('');

        if (guards.length) {
            out.push('typedef struct {');
            guards.forEach(g => out.push(`    int ${guardToField(g)};  /* "${g}" */`));
            out.push('} Guards;');
            out.push('');
        }

        out.push('State fsm_transition(State current, Guards guards) {');
        out.push('    switch (current) {');
        states.forEach(s => {
            const outgoing = transitions.filter(t => t.source === s.id);
            if (!outgoing.length) return;
            out.push(`        case ${toId(s.label, L)}: /* ${s.label} */`);
            outgoing.forEach(t => {
                const tgt = states.find(x => x.id === t.target);
                if (!tgt) return;
                const g = t.guard && t.guard.trim() ? t.guard.trim() : null;
                if (g) {
                    out.push(`            if (guards.${guardToField(g)}) return ${toId(tgt.label, L)};`);
                } else {
                    out.push(`            return ${toId(tgt.label, L)};  /* unconditional */`);
                }
            });
            out.push(`            return ${toId(s.label, L)};  /* no match — stay */`);
        });
        out.push('        default: return current;');
        out.push('    }');
        out.push('}');
        return out.join('\n');
    }

    // ── C++ ───────────────────────────────────────────────────────────────────

    function genCpp(states, transitions) {
        const L   = 'cpp';
        const out = [];

        out.push('// Auto-generated FSM — first-match semantics for ambiguous transitions');
        out.push('#include <unordered_map>');
        out.push('#include <string>');
        out.push('');
        out.push('enum class State {');
        states.forEach((s, i) => out.push(`    ${toId(s.label, L)}${i < states.length - 1 ? ',' : ''}  // ${s.label}`));
        out.push('};');
        out.push('');
        out.push('class FSM {');
        out.push('public:');
        out.push('    State state;');
        out.push('');
        out.push('    explicit FSM(State initial) : state(initial) {}');
        out.push('');
        out.push('    // guards: map of guard-expression string → bool');
        out.push('    void transition(const std::unordered_map<std::string, bool>& guards) {');
        out.push('        auto g = [&](const std::string& key) -> bool {');
        out.push('            auto it = guards.find(key); return it != guards.end() && it->second;');
        out.push('        };');
        out.push('        switch (state) {');
        states.forEach(s => {
            const outgoing = transitions.filter(t => t.source === s.id);
            if (!outgoing.length) return;
            out.push(`        case State::${toId(s.label, L)}: // ${s.label}`);
            outgoing.forEach(t => {
                const tgt = states.find(x => x.id === t.target);
                if (!tgt) return;
                const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                if (guard) {
                    out.push(`            if (g("${guard}")) { state = State::${toId(tgt.label, L)}; return; }`);
                } else {
                    out.push(`            state = State::${toId(tgt.label, L)}; return; // unconditional`);
                }
            });
            out.push(`            break; // no match — stay`);
        });
        out.push('        default: break;');
        out.push('        }');
        out.push('    }');
        out.push('};');
        return out.join('\n');
    }

    // ── Python ────────────────────────────────────────────────────────────────

    function genPython(states, transitions) {
        const L   = 'python';
        const out = [];

        out.push('# Auto-generated FSM — first-match semantics for ambiguous transitions');
        out.push('from enum import Enum, auto');
        out.push('from typing import Dict');
        out.push('');
        out.push('class State(Enum):');
        states.forEach(s => out.push(`    ${toId(s.label, L)} = auto()  # ${s.label}`));
        out.push('');
        out.push('class FSM:');
        const initState = states.find(s => s.initial) || states[0];
        const initId    = initState ? `State.${toId(initState.label, L)}` : 'None';
        out.push(`    def __init__(self, state: State = ${initId}):`);
        out.push('        self.state = state');
        out.push('');
        out.push('    # guards: dict mapping guard-expression string → bool');
        out.push('    def transition(self, guards: Dict[str, bool]) -> None:');
        out.push('        g = lambda key: guards.get(key, False)');

        const withOut = states.filter(s => transitions.some(t => t.source === s.id));
        if (!withOut.length) {
            out.push('        pass  # no transitions defined');
        } else {
            withOut.forEach((s, i) => {
                const kw      = i === 0 ? 'if' : 'elif';
                const outgoing = transitions.filter(t => t.source === s.id);
                out.push(`        ${kw} self.state == State.${toId(s.label, L)}:  # ${s.label}`);
                outgoing.forEach(t => {
                    const tgt  = states.find(x => x.id === t.target);
                    if (!tgt) return;
                    const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                    if (guard) {
                        out.push(`            if g("${guard}"):`);
                        out.push(`                self.state = State.${toId(tgt.label, L)}`);
                        out.push('                return');
                    } else {
                        out.push(`            self.state = State.${toId(tgt.label, L)}  # unconditional`);
                        out.push('            return');
                    }
                });
                out.push('            pass  # no match — stay');
            });
        }
        return out.join('\n');
    }

    // ── JavaScript ───────────────────────────────────────────────────────────

    function genJavaScript(states, transitions) {
        const L   = 'javascript';
        const out = [];

        out.push('// Auto-generated FSM — first-match semantics for ambiguous transitions');
        out.push('');
        out.push('const State = Object.freeze({');
        states.forEach((s, i) =>
            out.push(`    ${toId(s.label, L)}: "${s.label}"${i < states.length - 1 ? ',' : ''}`)
        );
        out.push('});');
        out.push('');
        out.push('class FSM {');
        const initState = states.find(s => s.initial) || states[0];
        const initId    = initState ? `State.${toId(initState.label, L)}` : 'null';
        out.push(`    constructor(state = ${initId}) {`);
        out.push('        this.state = state;');
        out.push('    }');
        out.push('');
        out.push('    // guards: object mapping guard-expression string → boolean');
        out.push('    transition(guards = {}) {');
        out.push('        const g = key => !!guards[key];');
        out.push('        switch (this.state) {');
        states.forEach(s => {
            const outgoing = transitions.filter(t => t.source === s.id);
            if (!outgoing.length) return;
            out.push(`            case State.${toId(s.label, L)}: // ${s.label}`);
            outgoing.forEach(t => {
                const tgt  = states.find(x => x.id === t.target);
                if (!tgt) return;
                const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                if (guard) {
                    out.push(`                if (g("${guard}")) { this.state = State.${toId(tgt.label, L)}; return; }`);
                } else {
                    out.push(`                this.state = State.${toId(tgt.label, L)}; return; // unconditional`);
                }
            });
            out.push('                break; // no match — stay');
        });
        out.push('            default: break;');
        out.push('        }');
        out.push('    }');
        out.push('}');
        return out.join('\n');
    }

    // ── Java ─────────────────────────────────────────────────────────────────

    function genJava(states, transitions) {
        const L   = 'java';
        const out = [];

        out.push('// Auto-generated FSM — first-match semantics for ambiguous transitions');
        out.push('import java.util.Map;');
        out.push('');
        out.push('public class FSM {');
        out.push('');
        out.push('    public enum State {');
        states.forEach((s, i) =>
            out.push(`        ${toId(s.label, L)}${i < states.length - 1 ? ',' : ''}  // ${s.label}`)
        );
        out.push('    }');
        out.push('');
        out.push('    private State state;');
        out.push('');
        const initState = states.find(s => s.initial) || states[0];
        const initId    = initState ? `State.${toId(initState.label, L)}` : 'null';
        out.push(`    public FSM()                   { this.state = ${initId}; }`);
        out.push('    public FSM(State initial)      { this.state = initial; }');
        out.push('    public State getState()        { return state; }');
        out.push('');
        out.push('    // guards: map of guard-expression string → Boolean');
        out.push('    public void transition(Map<String, Boolean> guards) {');
        out.push('        switch (state) {');
        states.forEach(s => {
            const outgoing = transitions.filter(t => t.source === s.id);
            if (!outgoing.length) return;
            out.push(`            case ${toId(s.label, L)}: // ${s.label}`);
            outgoing.forEach(t => {
                const tgt  = states.find(x => x.id === t.target);
                if (!tgt) return;
                const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                if (guard) {
                    out.push(`                if (Boolean.TRUE.equals(guards.get("${guard}"))) { state = State.${toId(tgt.label, L)}; return; }`);
                } else {
                    out.push(`                state = State.${toId(tgt.label, L)}; return; // unconditional`);
                }
            });
            out.push('                break; // no match — stay');
        });
        out.push('            default: break;');
        out.push('        }');
        out.push('    }');
        out.push('}');
        return out.join('\n');
    }

    // ── C# ───────────────────────────────────────────────────────────────────

    function genCSharp(states, transitions) {
        const L   = 'csharp';
        const out = [];

        out.push('// Auto-generated FSM — first-match semantics for ambiguous transitions');
        out.push('using System.Collections.Generic;');
        out.push('');
        out.push('public enum State {');
        states.forEach((s, i) =>
            out.push(`    ${toId(s.label, L)}${i < states.length - 1 ? ',' : ''}  // ${s.label}`)
        );
        out.push('}');
        out.push('');
        out.push('public class FSM {');
        out.push('    public State State { get; private set; }');
        out.push('');
        const initState = states.find(s => s.initial) || states[0];
        const initId    = initState ? toId(initState.label, L) : 'default';
        out.push(`    public FSM(State initial = State.${initId}) => State = initial;`);
        out.push('');
        out.push('    // guards: dictionary of guard-expression string → bool');
        out.push('    public void Transition(Dictionary<string, bool> guards) {');
        out.push('        bool G(string key) => guards.TryGetValue(key, out var v) && v;');
        out.push('        switch (State) {');
        states.forEach(s => {
            const outgoing = transitions.filter(t => t.source === s.id);
            if (!outgoing.length) return;
            out.push(`            case State.${toId(s.label, L)}: // ${s.label}`);
            outgoing.forEach(t => {
                const tgt  = states.find(x => x.id === t.target);
                if (!tgt) return;
                const guard = t.guard && t.guard.trim() ? t.guard.trim() : null;
                if (guard) {
                    out.push(`                if (G("${guard}")) { State = State.${toId(tgt.label, L)}; return; }`);
                } else {
                    out.push(`                State = State.${toId(tgt.label, L)}; return; // unconditional`);
                }
            });
            out.push('                break; // no match — stay');
        });
        out.push('            default: break;');
        out.push('        }');
        out.push('    }');
        out.push('}');
        return out.join('\n');
    }

    // ── PlantUML ──────────────────────────────────────────────────────────────

    function genPlantUML(states, transitions) {
        const L   = 'plantuml';
        const out = [];

        out.push('@startuml');
        out.push('hide empty description');
        out.push('');

        const initial = states.find(s => s.initial);
        if (initial) out.push(`[*] --> ${toId(initial.label, L)}`);

        // Alias states whose label contains non-identifier characters
        states.forEach(s => {
            const id = toId(s.label, L);
            if (id !== s.label) out.push(`state "${s.label}" as ${id}`);
        });
        out.push('');

        transitions.forEach(t => {
            const src = states.find(x => x.id === t.source);
            const tgt = states.find(x => x.id === t.target);
            if (!src || !tgt) return;
            const guard = t.guard && t.guard.trim() ? ` : ${t.guard}` : '';
            out.push(`${toId(src.label, L)} --> ${toId(tgt.label, L)}${guard}`);
        });

        // Terminal states
        states.filter(s => !transitions.some(t => t.source === s.id)).forEach(s => {
            out.push(`${toId(s.label, L)} --> [*]`);
        });

        out.push('');
        out.push('@enduml');
        return out.join('\n');
    }

    // ── Mermaid ───────────────────────────────────────────────────────────────

    function genMermaid(states, transitions) {
        const L   = 'mermaid';
        const out = [];

        out.push('stateDiagram-v2');
        out.push('');

        const initial = states.find(s => s.initial);
        if (initial) out.push(`    [*] --> ${toId(initial.label, L)}`);

        transitions.forEach(t => {
            const src = states.find(x => x.id === t.source);
            const tgt = states.find(x => x.id === t.target);
            if (!src || !tgt) return;
            const guard = t.guard && t.guard.trim() ? ` : ${t.guard}` : '';
            out.push(`    ${toId(src.label, L)} --> ${toId(tgt.label, L)}${guard}`);
        });

        // Terminal states
        states.filter(s => !transitions.some(t => t.source === s.id)).forEach(s => {
            out.push(`    ${toId(s.label, L)} --> [*]`);
        });

        return out.join('\n');
    }

    // ── Generator dispatch table ──────────────────────────────────────────────

    const GENERATORS = { c: genC, cpp: genCpp, python: genPython, javascript: genJavaScript, java: genJava, csharp: genCSharp, plantuml: genPlantUML, mermaid: genMermaid };

    return { showModal, hideModal, update, copyToClipboard, downloadCode };
})();
