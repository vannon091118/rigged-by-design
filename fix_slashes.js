const fs = require("fs");
let content = fs.readFileSync("src/core/sim/asset-license-inventory.ts", "utf-8");
content = content.replace(/\\\\/g, "/");
fs.writeFileSync("src/core/sim/asset-license-inventory.ts", content);
console.log("Backslashes ersetzt.");

