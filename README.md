# FSM Planner

A zero-dependency, browser-based **Finite State Machine designer**.  
Draw states and transitions visually, then export to code or generate test cases — all from a single HTML file you can open locally.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎨 **Visual editor** | Drag, pan, zoom on an infinite canvas powered by [Cytoscape.js](https://js.cytoscape.org/) |
| 📐 **Auto-sizing nodes** | Node width and height automatically scale to fit the label — no manual resizing needed |
| 🔗 **Guarded transitions** | Every edge carries an optional guard condition; blank guards become unconditional |
| 📂 **JSON import** | Load a saved diagram — supports both the rich format (with positions) and a simple legacy format |
| 💾 **JSON export** | Download the full diagram with positions so you can reload it later |
| ⚙️ **Code export** | Generate a working FSM skeleton in **C, C++, Python, JavaScript, Java, C#, PlantUML or Mermaid** |
| 🧪 **Test generation** | Brute-force rollout of GIVEN/WHEN/THEN test cases derived directly from your guards and transitions |
| ⌨️ **Keyboard shortcuts** | `Del` removes selected elements, `Esc` cancels pending actions |

---

## 🚀 Getting Started

No build step, no npm install, no server required.

```
git clone <repo>
# or just download the folder
open fsm_editor.html
```

> Works in any modern browser (Chrome, Firefox, Edge, Safari).  
> Cytoscape.js is loaded from a CDN — an internet connection is required on first load.  
> After that, browsers cache the library and it works offline.

---

## 🖱️ Editor Controls

### Adding states
| Method | How |
|---|---|
| Right-click on the canvas | Opens context menu → **Add State** |
| Toolbar **➕ State** button | Prompts for a name, places near the centre |

### Connecting states (transitions)
1. **Click** a source state — it turns red to indicate it is selected.  
2. **Click** a target state — you will be prompted for a guard condition.  
   Leave the guard blank for an **unconditional** transition.

### Editing
| Action | How |
|---|---|
| Rename state | Double-click the node, or right-click → **Rename** |
| Edit guard | Click the edge label, or right-click → **Edit Guard** |
| Set initial state | Right-click node → **Set as Initial State** (renders green with a white border) |
| Delete element | Select it and press `Del`, or right-click → **Delete** |
| Self-loop | Click a node twice (source = target) |
| Cancel selection | Press `Esc` or click an empty area of the canvas |

### Navigation
- **Pan** — click-and-drag the canvas background  
- **Zoom** — scroll wheel  
- **Multi-select** — drag a selection box; then `Del` removes all selected elements

---

## 📂 JSON Format

### Rich format (exported by this tool)

```json
{
  "states": [
    { "id": "n0", "label": "Idle",    "x": 150, "y": 200, "initial": true  },
    { "id": "n1", "label": "Running", "x": 400, "y": 200, "initial": false },
    { "id": "n2", "label": "Error",   "x": 275, "y": 380, "initial": false }
  ],
  "transitions": [
    { "id": "e0", "source": "n0", "target": "n1", "guard": "start"    },
    { "id": "e1", "source": "n1", "target": "n0", "guard": "stop"     },
    { "id": "e2", "source": "n1", "target": "n2", "guard": "fault"    },
    { "id": "e3", "source": "n2", "target": "n0", "guard": "reset"    }
  ]
}
```

### Legacy format (also accepted on import)

```json
{
  "states": ["Idle", "Running", "Error"],
  "transitions": [
    { "from": "Idle",    "to": "Running", "guard": "start" },
    { "from": "Running", "to": "Idle",    "guard": "stop"  },
    { "from": "Running", "to": "Error",   "guard": "fault" },
    { "from": "Error",   "to": "Idle",    "guard": "reset" }
  ]
}
```

> **Validation on import:** duplicate IDs, broken transition references, and multiple initial states are all caught and reported before loading.

---

## ⚙️ Code Export

Open **⚙ Export Code**, pick a language, then copy or download.

All generators share the same transition semantics:

- Guards are passed in as a **map / dictionary / struct** keyed by the guard string you typed in the editor.  
- When multiple guards on the same source state are `true` simultaneously, the **first-defined transition wins** (documented in every generated file).
- An unconditional transition (blank guard) always fires and stops evaluation of further outgoing edges.
- States with no outgoing transitions do nothing and stay put.

### Generated state identifiers

Labels are sanitised to valid identifiers: non-alphanumeric characters become `_`, and a `S_` prefix is added to prevent digit-leading names and reserved-word collisions.  
The original label is always preserved as an inline comment.

### Language reference

| Language | Enum type | Guards parameter | File |
|---|---|---|---|
| **C** | `typedef enum` | `Guards` struct | `fsm.c` |
| **C++** | `enum class State` | `unordered_map<string,bool>` | `fsm.cpp` |
| **Python** | `class State(Enum)` | `Dict[str, bool]` | `fsm.py` |
| **JavaScript** | `Object.freeze({…})` | plain object `{}` | `fsm.js` |
| **Java** | inner `enum State` | `Map<String,Boolean>` | `fsm.java` |
| **C#** | `enum State` | `Dictionary<string,bool>` | `fsm.cs` |
| **PlantUML** | state diagram | — | `fsm.puml` |
| **Mermaid** | `stateDiagram-v2` | — | `fsm.md` |

---

## 🧪 Test Case Generation

Click **🧪 Generate Tests** to produce a plain-text GIVEN/WHEN/THEN test suite.  
Every test case has a unique `TC-NNN` ID and one or more tags for easy filtering.

### Test categories

| Category | Tag | What it covers |
|---|---|---|
| **Initial state** | `initial` | FSM starts in the declared initial state |
| **Positive transitions** | `positive` | Each transition fires when its guard is `true` (sibling guards set to `false`) |
| **Negative (all-false)** | `negative` | Purely-guarded states stay put when every guard is `false` |
| **Guard isolation** | `guard-isolation` | Negating one guard at a time on states with ≥ 2 outgoing guarded transitions |
| **Priority / first-match** | `priority`, `first-match` | When multiple guards are `true` simultaneously, the first-defined transition wins |
| **Pairwise priority** | `pairwise` | Consecutive pairs of guards tested for ordering |
| **Terminal states** | `terminal` | States with no outgoing transitions ignore any `transition()` call |
| **Self-loops** | `self-loop` | Self-loop transitions leave state unchanged |
| **Unreachable states** | `unreachable-state` | Tests are still generated, but tagged as warnings |

A **summary block** at the end lists: total TCs, state count, unique guards, unreachable states, and terminal states.

### Example output (excerpt)

```
TC-001: FSM starts in the declared initial state
  GIVEN: A new FSM instance is created with default constructor
  WHEN:  No transition is triggered
  THEN:  State equals "Idle"
  TAGS:  [initial, smoke]

TC-002: "Idle" → "Running" when guard "start" is true
  GIVEN: FSM is in state "Idle"
  WHEN:  transition() called with { "start"=true }
  THEN:  State changes to "Running"
  TAGS:  [positive]
```

---

## 📁 File Structure

```
fsm_planner/
├── fsm_editor.html        # Main entry point — open this in a browser
├── fsm_style.css          # All styling (dark theme, modals, context menu)
└── js/
    ├── fsm_core.js        # Cytoscape init, data model, load/save, validation
    ├── fsm_ui.js          # Context menu, keyboard shortcuts, node interaction
    ├── fsm_import.js      # JSON import (rich + legacy format normalisation)
    ├── fsm_export_json.js # JSON download
    ├── fsm_export_code.js # Code generators (8 languages)
    ├── fsm_testgen.js     # Test case generation
    └── fsm_main.js        # Entry point — wires all modules together
```

---

## 🔒 Privacy

Everything runs entirely in your browser.  
No data is ever sent to a server. The only network request is loading Cytoscape.js from `unpkg.com` on startup.

---

## 📜 License

MIT
