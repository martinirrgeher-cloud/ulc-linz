import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has("--apply");
const overwrite = args.has("--overwrite");
const verifyRemote = args.has("--verify");
const syncBuckets = args.has("--sync-buckets");
const sourceArgument = rawArgs.find((value) => !value.startsWith("--"));
const sourceRoot = path.resolve(sourceArgument ?? "backup/storage");
const manifestPath = path.join(sourceRoot, "storage-manifest.json");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (apply && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("Für --apply müssen SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY gesetzt sein.");
}
if (verifyRemote && !apply) {
  throw new Error("--verify kann nur gemeinsam mit --apply verwendet werden.");
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

function safeLocalPath(localPath) {
  const resolved = path.resolve(sourceRoot, localPath);
  if (resolved !== sourceRoot && !resolved.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`Unsicherer lokaler Pfad im Manifest: ${localPath}`);
  }
  return resolved;
}

function objectUrl(bucketName, objectName) {
  const encodedObjectName = objectName
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encodedObjectName}`;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function hashRemoteObject(bucketName, objectName) {
  const response = await fetch(objectUrl(bucketName, objectName), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`${bucketName}/${objectName}: HTTP ${response.status} beim Prüfen.`);
  }

  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    hash.update(buffer);
  }
  return { size, sha256: hash.digest("hex") };
}

let existingBuckets = [];
if (apply) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  existingBuckets = data ?? [];
}

let fileCount = 0;
let totalBytes = 0;

for (const bucket of manifest.buckets) {
  if (!bucket?.name || !Array.isArray(bucket.objects)) {
    throw new Error("Ungültiger Bucket-Eintrag im Storage-Manifest.");
  }

  if (apply) {
    const existingBucket = existingBuckets.find((item) => item.name === bucket.name);
    const bucketOptions = {
      public: Boolean(bucket.public),
      fileSizeLimit: bucket.fileSizeLimit ?? undefined,
      allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
    };
    if (!existingBucket) {
      const { error: createError } = await supabase.storage.createBucket(bucket.name, bucketOptions);
      if (createError) throw createError;
      existingBuckets.push({ name: bucket.name });
    } else if (syncBuckets) {
      const { error: updateError } = await supabase.storage.updateBucket(bucket.name, bucketOptions);
      if (updateError) throw updateError;
    }
  }

  for (const object of bucket.objects) {
    if (!object?.name || !object?.localPath) {
      throw new Error(`Ungültiger Storage-Eintrag in Bucket ${bucket.name}.`);
    }

    const localPath = safeLocalPath(object.localPath);
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) {
      throw new Error(`Lokale Storage-Datei fehlt: ${object.localPath}`);
    }
    if (Number.isFinite(object.localSize) && fileStat.size !== object.localSize) {
      throw new Error(`${bucket.name}/${object.name}: Lokale Dateigröße stimmt nicht mit dem Manifest überein.`);
    }
    if (typeof object.sha256 === "string" && object.sha256.length === 64) {
      const localHash = await hashFile(localPath);
      if (localHash !== object.sha256.toLowerCase()) {
        throw new Error(`${bucket.name}/${object.name}: Lokale Prüfsumme stimmt nicht mit dem Manifest überein.`);
      }
    }

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

    if (verifyRemote) {
      const remote = await hashRemoteObject(bucket.name, object.name);
      if (remote.size !== fileStat.size) {
        throw new Error(`${bucket.name}/${object.name}: Wiederhergestellte Dateigröße stimmt nicht.`);
      }
      if (typeof object.sha256 === "string" && object.sha256.length === 64 && remote.sha256 !== object.sha256.toLowerCase()) {
        throw new Error(`${bucket.name}/${object.name}: Wiederhergestellte Prüfsumme stimmt nicht.`);
      }
    }

    console.log(`[Wiederhergestellt${verifyRemote ? " und geprüft" : ""}] ${bucket.name}/${object.name}`);
  }
}

console.log(`${fileCount} Datei(en), ${totalBytes} Byte geprüft${apply ? " und hochgeladen" : ""}.`);
if (!apply) {
  console.log("Es wurde nichts verändert. Für die Wiederherstellung --apply ergänzen.");
}
