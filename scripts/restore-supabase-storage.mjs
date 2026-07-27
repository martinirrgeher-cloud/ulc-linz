import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const overwrite = args.has("--overwrite");
const sourceArgument = process.argv.slice(2).find((value) => !value.startsWith("--"));
const sourceRoot = path.resolve(sourceArgument ?? "backup/storage");
const manifestPath = path.join(sourceRoot, "storage-manifest.json");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (apply && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("Für --apply müssen SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY gesetzt sein.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.buckets)) {
  throw new Error("Das Storage-Manifest ist ungültig.");
}

const supabase = apply
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

let fileCount = 0;
let totalBytes = 0;

for (const bucket of manifest.buckets) {
  if (!bucket?.name || !Array.isArray(bucket.objects)) continue;

  if (apply) {
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;
    const exists = existingBuckets?.some((item) => item.name === bucket.name);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucket.name, {
        public: Boolean(bucket.public),
        fileSizeLimit: bucket.fileSizeLimit ?? undefined,
        allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
      });
      if (createError) throw createError;
    }
  }

  for (const object of bucket.objects) {
    const localPath = path.resolve(sourceRoot, object.localPath);
    if (!localPath.startsWith(`${sourceRoot}${path.sep}`)) {
      throw new Error(`Unsicherer lokaler Pfad im Manifest: ${object.localPath}`);
    }
    const fileStat = await stat(localPath);
    fileCount += 1;
    totalBytes += fileStat.size;

    if (!apply) {
      console.log(`[Vorschau] ${bucket.name}/${object.name} (${fileStat.size} Byte)`);
      continue;
    }

    const file = await readFile(localPath);
    const contentType = object.metadata?.mimetype || object.metadata?.contentType || undefined;
    const { error: uploadError } = await supabase.storage
      .from(bucket.name)
      .upload(object.name, file, {
        upsert: overwrite,
        contentType,
      });
    if (uploadError) {
      throw new Error(`${bucket.name}/${object.name}: ${uploadError.message}`);
    }
    console.log(`[Wiederhergestellt] ${bucket.name}/${object.name}`);
  }
}

console.log(`${fileCount} Datei(en), ${totalBytes} Byte geprüft${apply ? " und hochgeladen" : ""}.`);
if (!apply) {
  console.log("Es wurde nichts verändert. Für die Wiederherstellung --apply ergänzen.");
}
