/* js/fsm_ui.js — Context menu, keyboard, node selection/connection, rename/delete */

const UI = (() => {
    let cy;
    let ctxMenu, ctxItems;

    function init(cyInstance) {
        cy = cyInstance;
        ctxMenu  = document.getElementById('ctx-menu');
        ctxItems = document.getElementById('ctx-items');
        setupContextMenu();
        setupNodeInteraction();
        setupEdgeInteraction();
        setupKeyboard();
    }

    // ── Context menu ─────────────────────────────────────────────────────────

    function showCtxMenu(x, y, items) {
        ctxItems.innerHTML = '';
        items.forEach(item => {
            if (item === 'sep') {
                const div = document.createElement('div');
                div.className = 'ctx-sep';
                ctxItems.appendChild(div);
                return;
            }
            const div = document.createElement('div');
            div.className = 'ctx-item';
            div.textContent = item.label;
            div.onclick = () => { hideCtxMenu(); item.action(); };
            ctxItems.appendChild(div);
        });
        // Keep menu inside viewport
        ctxMenu.style.left = x + 'px';
        ctxMenu.style.top  = y + 'px';
        ctxMenu.style.display = 'block';

        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right  > window.innerWidth)  ctxMenu.style.left = (x - rect.width)  + 'px';
        if (rect.bottom > window.innerHeight) ctxMenu.style.top  = (y - rect.height) + 'px';
    }

    function hideCtxMenu() { ctxMenu.style.display = 'none'; }

    document.addEventListener('click',       hideCtxMenu);
    document.addEventListener('contextmenu', e => { if (!e.target.closest('#cy')) hideCtxMenu(); });

    function setupContextMenu() {
        cy.on('cxttap', function(evt) {
            const e  = evt.originalEvent;
            const x  = e.clientX, y = e.clientY;

            if (evt.target === cy) {
                showCtxMenu(x, y, [
                    { label: '➕  Add State',  action: () => addStateAtPosition(evt.position) },
                    'sep',
                    { label: '🗑  Clear All',  action: () => { if (confirm('Clear the entire diagram?')) Core.clearAll(); } }
                ]);

            } else if (evt.target.isNode()) {
                const node = evt.target;
                showCtxMenu(x, y, [
                    { label: '✏  Rename',          action: () => renameNode(node) },
                    { label: node.data('initial')
                        ? '★  Unset Initial State'
                        : '★  Set as Initial State', action: () => toggleInitial(node) },
                    'sep',
                    { label: '🗑  Delete State',    action: () => deleteElement(node) }
                ]);

            } else if (evt.target.isEdge()) {
                const edge = evt.target;
                showCtxMenu(x, y, [
                    { label: '✏  Edit Guard',       action: () => editEdgeGuard(edge) },
                    'sep',
                    { label: '🗑  Delete Transition', action: () => deleteElement(edge) }
                ]);
            }
        });
    }

    // ── State / edge helpers ──────────────────────────────────────────────────

    function addStateDialog() {
        const name = prompt('State name?');
        if (!name || !name.trim()) return;
        const ext = cy.extent();
        const cx  = (ext.x1 + ext.x2) / 2 || 0;
        const cy2 = (ext.y1 + ext.y2) / 2 || 0;
        addStateAtPosition({ x: cx + (Math.random() - 0.5) * 120, y: cy2 + (Math.random() - 0.5) * 80 }, name.trim());
    }

    function addStateAtPosition(position, name) {
        const n = name !== undefined ? name : prompt('State name?');
        if (!n || !n.trim()) return;
        cy.add({ group: 'nodes', data: { id: Core.nextNodeId(), label: n.trim() }, position });
        Core.updateStats();
    }

    function renameNode(node) {
        const newName = prompt('Rename state:', node.data('label'));
        if (newName !== null && newName.trim()) {
            node.data('label', newName.trim());
        }
    }

    function toggleInitial(node) {
        if (node.data('initial')) {
            Core.setInitialState(null);
        } else {
            Core.setInitialState(node.id());
        }
    }

    function deleteElement(el) {
        if (el.isNode()) cy.remove(el.connectedEdges());
        cy.remove(el);
        Core.updateStats();
    }

    function editEdgeGuard(edge) {
        const val = prompt('Guard condition (blank = unconditional):', edge.data('label') || '');
        if (val !== null) edge.data('label', val.trim());
    }

    // ── Node tap — select first node then second to draw edge ─────────────────

    function setupNodeInteraction() {
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const sel  = Core.getSelectedNode();

            if (!sel) {
                Core.setSelectedNode(node);
                node.addClass('selecting');
            } else {
                sel.removeClass('selecting');
                if (sel.id() !== node.id()) {
                    const guard = prompt('Guard condition (blank = unconditional):', '');
                    if (guard !== null) {
                        cy.add({
                            group: 'edges',
                            data: {
                                id:     'e' + Date.now(),
                                source: sel.id(),
                                target: node.id(),
                                label:  guard.trim()
                            }
                        });
                        Core.updateStats();
                    }
                }
                Core.setSelectedNode(null);
            }
        });

        // Double-click a node to rename it (cancels any pending selection)
        cy.on('dbltap', 'node', function(evt) {
            const sel = Core.getSelectedNode();
            if (sel) { sel.removeClass('selecting'); Core.setSelectedNode(null); }
            renameNode(evt.target);
        });

        // Click on blank canvas cancels pending selection
        cy.on('tap', function(evt) {
            if (evt.target === cy) {
                const sel = Core.getSelectedNode();
                if (sel) { sel.removeClass('selecting'); Core.setSelectedNode(null); }
            }
        });
    }

    function setupEdgeInteraction() {
        cy.on('tap', 'edge', function(evt) {
            editEdgeGuard(evt.target);
        });
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

    function setupKeyboard() {
        document.addEventListener('keydown', e => {
            const tag = document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                cy.elements(':selected').forEach(el => deleteElement(el));
            }

            if (e.key === 'Escape') {
                const sel = Core.getSelectedNode();
                if (sel) { sel.removeClass('selecting'); Core.setSelectedNode(null); }
                hideCtxMenu();
            }
        });
    }

    return { init, addStateDialog, hideCtxMenu };
})();
