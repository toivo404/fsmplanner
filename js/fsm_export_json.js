/* js/fsm_export_json.js — Download FSM as a JSON file */

const ExportJSON = (() => {

    function download() {
        const data = Core.getFSMData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'fsm.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    return { download };
})();
