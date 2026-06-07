const SAMPLE_MANIFEST_SCHEMA_VERSION = 1;
const REQUIRED_MANIFEST_ENTRY_FIELDS = [
  "id",
  "matchId",
  "label",
  "champion",
  "publicAlias",
  "collectedDate",
  "theme",
  "normalizedPath",
  "analysisPath",
  "notesPath",
];
const MANIFEST_PUBLIC_SAMPLE_PREFIX = "/data/samples/";
const MANIFEST_ENTRY_PATH_FIELDS = ["normalizedPath", "analysisPath", "notesPath"];
const MANIFEST_ENTRY_RAW_PATH_PATTERN = /(?:^|\/)(?:raw-|manifest\.json$)/;

function manifestValidationError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  error.payload = {
    ok: false,
    code: "SAMPLE_MANIFEST_INVALID",
    error: message,
  };
  return error;
}

function hasUnsafePathSegments(relativePath) {
  return relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function sampleManifestPublicPathToStorageRelativePath(publicPath) {
  const rawPath = String(publicPath || "");
  if (!rawPath.startsWith(MANIFEST_PUBLIC_SAMPLE_PREFIX)) {
    return null;
  }
  const relativePath = rawPath.slice(MANIFEST_PUBLIC_SAMPLE_PREFIX.length);
  if (!relativePath || hasUnsafePathSegments(relativePath)) {
    return null;
  }
  return relativePath;
}

function validateManifestEntryPaths(sample) {
  const expectedPrefix = `/data/samples/${sample.id}/`;
  for (const field of MANIFEST_ENTRY_PATH_FIELDS) {
    const publicPath = sample[field].trim();
    const storageRelativePath = sampleManifestPublicPathToStorageRelativePath(publicPath);
    if (!storageRelativePath) {
      if (publicPath.split("/").some((segment) => segment === "." || segment === "..")) {
        return `Sample manifest entry path must not contain traversal segments: ${field}.`;
      }
      return `Sample manifest entry path must stay under ${expectedPrefix}: ${field}.`;
    }
    if (!publicPath.startsWith(expectedPrefix)) {
      return `Sample manifest entry path must stay under ${expectedPrefix}: ${field}.`;
    }
    if (MANIFEST_ENTRY_RAW_PATH_PATTERN.test(storageRelativePath)) {
      return `Sample manifest entry path must not expose raw/internal files: ${field}.`;
    }
  }
  return null;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw manifestValidationError("Sample manifest must be a JSON object.");
  }
  const hasSchemaVersion = Object.prototype.hasOwnProperty.call(manifest, "schemaVersion");
  const schemaVersion = hasSchemaVersion ? manifest.schemaVersion : SAMPLE_MANIFEST_SCHEMA_VERSION;
  if (schemaVersion !== SAMPLE_MANIFEST_SCHEMA_VERSION) {
    throw manifestValidationError(`Unsupported sample manifest schemaVersion: ${String(schemaVersion)}.`);
  }
  const versionedManifest = hasSchemaVersion ? manifest : { schemaVersion, ...manifest };

  if (!Array.isArray(manifest.samples)) {
    throw manifestValidationError("Sample manifest must include a samples array.");
  }

  let invalidEntryMessage = null;
  const hasInvalidEntry = versionedManifest.samples.some((sample) => {
    if (!sample || typeof sample !== "object") {
      return true;
    }
    const missingField = REQUIRED_MANIFEST_ENTRY_FIELDS.find((field) =>
      typeof sample[field] !== "string" || sample[field].trim() === ""
    );
    if (missingField) {
      invalidEntryMessage = `Sample manifest entry missing required field: ${missingField}.`;
      return true;
    }
    const pathError = validateManifestEntryPaths(sample);
    if (pathError) {
      invalidEntryMessage = pathError;
      return true;
    }
    return false;
  });
  if (hasInvalidEntry) {
    throw manifestValidationError(invalidEntryMessage || "Sample manifest contains an invalid sample entry.");
  }

  return versionedManifest;
}

module.exports = {
  MANIFEST_PUBLIC_SAMPLE_PREFIX,
  SAMPLE_MANIFEST_SCHEMA_VERSION,
  REQUIRED_MANIFEST_ENTRY_FIELDS,
  MANIFEST_ENTRY_PATH_FIELDS,
  MANIFEST_ENTRY_RAW_PATH_PATTERN,
  manifestValidationError,
  sampleManifestPublicPathToStorageRelativePath,
  validateManifestEntryPaths,
  validateManifest,
};
