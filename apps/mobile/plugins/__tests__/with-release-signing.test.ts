import { applyReleaseSigning } from "../with-release-signing";

const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}`;

describe("with-release-signing", () => {
  it("adds an env driven release config and never debug signs release builds", () => {
    const out = applyReleaseSigning(TEMPLATE);
    expect(out).toContain('def bondcheckKeystore = System.getenv("BONDCHECK_KEYSTORE_PATH")');
    expect(out).toContain('signingConfig System.getenv("BONDCHECK_KEYSTORE_PATH") ? signingConfigs.release : null');
    // the debug build type keeps the debug key
    expect(out.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
    expect(out).not.toMatch(/storePassword\s+["'][^"']+["']\s*\n\s*keyAlias System/);
  });

  it("is idempotent", () => {
    const once = applyReleaseSigning(TEMPLATE);
    expect(applyReleaseSigning(once)).toBe(once);
  });

  it("fails loudly when the template changes shape", () => {
    expect(() => applyReleaseSigning("android {}")).toThrow(/signingConfigs/);
  });
});
