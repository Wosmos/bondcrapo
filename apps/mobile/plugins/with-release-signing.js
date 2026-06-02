// Expo config plugin: release signing for `gradlew assembleRelease` without EAS.
//
// The prebuild template signs release builds with the shared debug key. This plugin replaces
// that with a `release` signing config read from environment variables at build time:
//
//   BONDCHECK_KEYSTORE_PATH, BONDCHECK_KEYSTORE_PASSWORD, BONDCHECK_KEY_ALIAS, BONDCHECK_KEY_PASSWORD
//
// When BONDCHECK_KEYSTORE_PATH is unset the release APK is left unsigned (never debug signed),
// so a build can never be mistaken for a real release. No secret is written into the project.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// bondcheck-release-signing";

const RELEASE_SIGNING = `
        release { ${MARKER}
            def bondcheckKeystore = System.getenv("BONDCHECK_KEYSTORE_PATH")
            if (bondcheckKeystore) {
                storeFile file(bondcheckKeystore)
                storePassword System.getenv("BONDCHECK_KEYSTORE_PASSWORD")
                keyAlias System.getenv("BONDCHECK_KEY_ALIAS")
                keyPassword System.getenv("BONDCHECK_KEY_PASSWORD")
            }
        }`;

const RELEASE_ASSIGNMENT = 'signingConfig System.getenv("BONDCHECK_KEYSTORE_PATH") ? signingConfigs.release : null';

function applyReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const signingStart = gradle.indexOf("signingConfigs {");
  if (signingStart === -1) throw new Error("with-release-signing: signingConfigs block not found in app/build.gradle");
  const insertAt = signingStart + "signingConfigs {".length;
  let out = gradle.slice(0, insertAt) + RELEASE_SIGNING + gradle.slice(insertAt);

  // Point the release build type at the new config (the template uses signingConfigs.debug).
  const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseType.test(out)) throw new Error("with-release-signing: release buildType signingConfig not found");
  out = out.replace(releaseType, `$1${RELEASE_ASSIGNMENT}`);
  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("with-release-signing: only the Groovy app/build.gradle is supported");
    }
    cfg.modResults.contents = applyReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
