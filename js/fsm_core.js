/* js/fsm_core.js — Cytoscape instance, global state, data management */

const Core = (() => {
    let cy;
    let nodeCounter = 0;
    let selectedNode = null;
    let initialStateId = null;

    function init() {
        cy = cytoscape({
            container: document.getElementById('cy'),
            elements: [],
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#0074D9',
                        'label': 'data(label)',
                        'color': '#fff',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'width': 'label',
                        'height': 'label',
                        'padding': '14px',
                        'text-wrap': 'wrap',
                        'text-max-width': '180px',
                        'shape': 'round-rectangle',
                        'font-size': 13
                    }
                },
                {
                    selector: 'node[?initial]',
                    style: {
                        'background-color': '#27ae60',
                        'border-width': 3,
                        'border-color': '#fff'
                    }
                },
                {
                    selector: 'node.selecting',
                    style: { 'background-color': '#e74c3c' }
                },
                {
                    selector: 'node:selected',
                    style: { 'border-width': 2, 'border-color': '#e74c3c' }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#556',
                        'target-arrow-color': '#556',
                        'target-arrow-shape': 'triangle',
                        'label': 'data(label)',
                        'font-size': 11,
                        'text-background-color': '#1a1a2e',
                        'text-background-opacity': 0.85,
                        'text-background-padding': '3px',
                        'color': '#b8e0ff',
                        'curve-style': 'bezier',
                        'control-point-step-size': 40,
                        'loop-direction': '-45deg',
                        'loop-sweep': '45deg'
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'line-color': '#e74c3c',
                        'target-arrow-color': '#e74c3c'
                    }
                }
            ],
            layout: { name: 'preset' }
        });
        return cy;
    }

    function getCy()           { return cy; }
    function nextNodeId()      { return 'n' + (nodeCounter++); }
    function getSelectedNode() { return selectedNode; }
    function setSelectedNode(n){ selectedNode = n; }
    function getInitialStateId(){ return initialStateId; }

    function setInitialState(id) {
        if (initialStateId) {
            const prev = cy.getElementById(initialStateId);
            if (prev.length) prev.data('initial', false);
        }
        initialStateId = id;
        if (id) cy.getElementById(id).data('initial', true);
        updateStats();
    }

    function getFSMData() {
        const states = [];
        const transitions = [];

        cy.nodes().forEach(n => {
            states.push({
                id:      n.id(),
                label:   n.data('label'),
                x:       Math.round(n.position('x')),
                y:       Math.round(n.position('y')),
                initial: !!n.data('initial')
            });
        });

        cy.edges().forEach(e => {
            transitions.push({
                id:     e.id(),
                source: e.data('source'),
                target: e.data('target'),
                guard:  e.data('label') || ''
            });
        });

        return { states, transitions };
    }

    function validateFSMData(data) {
        const errors = [];
        if (!Array.isArray(data.states))      { errors.push('Missing states array');      return errors; }
        if (!Array.isArray(data.transitions)) { errors.push('Missing transitions array'); return errors; }

        const ids = new Set();
        for (const s of data.states) {
            if (!s.id)    errors.push('A state is missing an id');
            if (!s.label) errors.push(`State "${s.id}" is missing a label`);
            if (ids.has(s.id)) errors.push(`Duplicate state id: "${s.id}"`);
            ids.add(s.id);
        }

        if (data.states.filter(s => s.initial).length > 1)
            errors.push('Multiple initial states defined — only one is allowed');

        const edgeIds = new Set();
        for (const t of data.transitions) {
            if (!t.id)            errors.push('A transition is missing an id');
            if (edgeIds.has(t.id)) errors.push(`Duplicate transition id: "${t.id}"`);
            edgeIds.add(t.id);
            if (!ids.has(t.source)) errors.push(`Transition "${t.id}" has unknown source: "${t.source}"`);
            if (!ids.has(t.target)) errors.push(`Transition "${t.id}" has unknown target: "${t.target}"`);
        }

        return errors;
    }

    function loadFSMData(data) {
        const errors = validateFSMData(data);
        if (errors.length) { alert('Import errors:\n' + errors.join('\n')); return false; }

        cy.elements().remove();
        nodeCounter = 0;
        initialStateId = null;

        const elements = [];
        data.states.forEach(s => {
            const num = parseInt(s.id.replace(/\D/g, ''), 10);
            if (!isNaN(num) && num >= nodeCounter) nodeCounter = num + 1;
            elements.push({
                group: 'nodes',
                data: { id: s.id, label: s.label, initial: !!s.initial },
                position: { x: s.x || 0, y: s.y || 0 }
            });
            if (s.initial) initialStateId = s.id;
        });

        data.transitions.forEach(t => {
            elements.push({
                group: 'edges',
                data: { id: t.id, source: t.source, target: t.target, label: t.guard || '' }
            });
        });

        cy.add(elements);
        cy.layout({ name: 'preset' }).run();
        updateStats();
        return true;
    }

    function clearAll() {
        cy.elements().remove();
        nodeCounter  = 0;
        selectedNode = null;
        initialStateId = null;
        updateStats();
    }

    function updateStats() {
        document.getElementById('stat-states').textContent      = cy.nodes().length;
        document.getElementById('stat-transitions').textContent = cy.edges().length;
        const init = initialStateId ? cy.getElementById(initialStateId) : null;
        document.getElementById('stat-initial').textContent =
            (init && init.length) ? init.data('label') : 'none';
    }

    return {
        init, getCy, nextNodeId,
        getSelectedNode, setSelectedNode,
        getInitialStateId, setInitialState,
        getFSMData, loadFSMData, clearAll, updateStats
    };
})();
