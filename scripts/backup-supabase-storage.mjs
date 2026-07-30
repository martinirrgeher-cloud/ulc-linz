import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputRoot = path.resolve(process.argv[2] ?? "backup/storage");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safePart(value) {
  return value.replaceAll("\\", "_").replaceAll("/", "_").replaceAll("..", "_");
}

function safeTarget(bucketName, objectName) {
  const bucketRoot = path.join(outputRoot, safePart(bucketName));
  const target = path.resolve(bucketRoot, ...objectName.split("/").filter(Boolean));
  if (target !== bucketRoot && !target.startsWith(`${bucketRoot}${path.sep}`)) {
    throw new Error(`Unsicherer Storage-Pfad: ${bucketName}/${objectName}`);
  }
  return target;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function withRetry(label, action, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
    }
  }
  throw new Error(`${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function listFolder(bucketName, folder = "") {
  const objects = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const page = await withRetry(`Storage-Liste ${bucketName}/${folder}`, async () => {
      const { data, error } = await supabase.storage.from(bucketName).list(folder, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      return data ?? [];
    });

    for (const item of page) {
      const objectName = folder ? `${folder}/${item.name}` : item.name;
      const isFolder = item.id == null && item.metadata == null;
      if (isFolder) {
        objects.push(...await listFolder(bucketName, objectName));
      } else {
        objects.push({
          name: objectName,
          id: item.id ?? null,
          createdAt: item.created_at ?? null,
          updatedAt: item.updated_at ?? null,
          metadata: item.metadata ?? null,
        });
      }
    }

    if (page.length < limit) break;
    offset += limit;
  }

  return objects;
}

async function downloadObject(bucketName, objectName) {
  const target = safeTarget(bucketName, objectName);
  await mkdir(path.dirname(target), { recursive: true });

  await withRetry(`Storage-Download ${bucketName}/${objectName}`, async () => {
    const encodedObjectName = objectName
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    const objectUrl = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encodedObjectName}`;
    const response = await fetch(objectUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    try {
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(target, { flags: "w" }),
      );
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
  });

  const fileStat = await stat(target);
  return {
    target,
    localSize: fileStat.size,
    sha256: await hashFile(target),
  };
}

await mkdir(outputRoot, { recursive: true });

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) throw bucketError;

const manifest = {
  createdAt: new Date().toISOString(),
  supabaseUrl,
  buckets: [],
};

for (const bucket of buckets ?? []) {
  console.log(`Sichere Bucket: ${bucket.name}`);
  const objects = await listFolder(bucket.name);
  const bucketManifest = {
    id: bucket.id,
    name: bucket.name,
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? null,
    allowedMimeTypes: bucket.allowed_mime_types ?? null,
    objects: [],
  };

  for (const object of objects) {
    const downloaded = await downloadObject(bucket.name, object.name);
    bucketManifest.objects.push({
      ...object,
      localPath: path.relative(outputRoot, downloaded.target),
      localSize: downloaded.localSize,
      sha256: downloaded.sha256,
    });
  }

  manifest.buckets.push(bucketManifest);
}

await writeFile(
  path.join(outputRoot, "storage-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const fileCount = manifest.buckets.reduce((sum, bucket) => sum + bucket.objects.length, 0);
const totalBytes = manifest.buckets.reduce(
  (bucketSum, bucket) => bucketSum + bucket.objects.reduce((objectSum, object) => objectSum + object.localSize, 0),
  0,
);
console.log(`${manifest.buckets.length} Bucket(s), ${fileCount} Datei(en), ${totalBytes} Byte gesichert.`);
