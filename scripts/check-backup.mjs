import fs from "node:fs";

const path = process.argv[2];
const b = JSON.parse(fs.readFileSync(path, "utf8"));

console.log("version", b.version, "exportedAt", b.exportedAt);
console.log("event name:", b.event.name);
for (const k of [
  "accountGroups",
  "accounts",
  "categories",
  "suppliers",
  "transactions",
  "payments",
  "attachments",
]) {
  console.log(k, b[k].length);
}
