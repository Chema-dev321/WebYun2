const fs = require('fs');
const file = '/Users/desarolloweb/WebYun/src/components/MapaTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the init map require
content = content.replace(
  `    const L = require("leaflet");\n    // @ts-ignore\n    if (typeof window !== "undefined") window.L = L;`,
  `    import("leaflet").then((LModule) => {\n      const L = LModule.default || LModule;\n      // @ts-ignore\n      if (typeof window !== "undefined") window.L = L;`
);

// We also need to close the then() block at the end of the init map useEffect. Wait, my previous multi_replace already completely destroyed the useEffect!
