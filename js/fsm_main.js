/* js/fsm_main.js — Entry point: wires all modules together */

(function () {
    const cy = Core.init();
    UI.init(cy);

    // Keep the status bar in sync whenever the graph changes
    cy.on('add remove data', () => Core.updateStats());

    // Prevent browser context menu from showing over the canvas
    document.getElementById('cy').addEventListener('contextmenu', e => e.preventDefault());

    // Close modals when clicking the dark backdrop
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    // Escape also closes any open modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }
    });

    Core.updateStats();
})();
