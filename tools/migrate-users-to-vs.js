// tools/migrate-users-to-v2.js
import fs from "node:fs";
import bcrypt from "bcryptjs";

const input = JSON.parse(fs.readFileSync("users_legacy.json","utf8"));
const out = { version: 2, users: [] };

for (const u of input.users) {
  const pw = u.password ?? "changeme";
  const passwordHash = bcrypt.hashSync(pw, 10);
  out.users.push({
    username: u.username,
    displayName: u.displayName ?? u.username,
    modules: Array.isArray(u.modules) ? u.modules : [],
    passwordHash,
    active: u.active !== false,
    updatedAt: new Date().toISOString()
  });
}
fs.writeFileSync("users_v2.json", JSON.stringify(out,null,2));
console.log("users_v2.json geschrieben");
