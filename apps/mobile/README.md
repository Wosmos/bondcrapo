# apps/mobile

The BondCheck Android app (Expo SDK 58, React Native 0.88, expo-router, English and Urdu with a right to left layout). Part of the Bun workspace; see the root `README.md`, `docs/DEVELOPMENT.md` and `docs/MOBILE_RELEASE.md`.

It talks to the website's `/api/v1` and shares the contracts in `@bondcheck/shared`. Nothing is stored on a server except the anonymous wallet (ADR 0004); the wallet key lives in secure storage on the phone.

## Run it

The app needs a development build, not Expo Go: the bond scanner (ML Kit) and secure storage are native modules.

```
# once: Java and the Android SDK. Android Studio ships a JDK:
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME=~/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# an emulator (Android Studio, Device Manager) or a phone with USB debugging on, then:
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 bun run --cwd apps/mobile android   # emulator
EXPO_PUBLIC_API_BASE_URL=http://<your LAN address>:3000 bun run --cwd apps/mobile android   # real phone
```

`10.0.2.2` is how the Android emulator reaches the Mac's `localhost`. Start the website first (`bun run dev`). Plain `http://` base URLs are accepted only in development builds; release builds require `https://`. The first build takes 5 to 10 minutes; afterwards `bun run --cwd apps/mobile start` reloads changes instantly.

On a computer with 8 GB of RAM, close other heavy apps and use a small emulator (1.5 GB RAM), or a real phone.

## Scripts

```
bun run --cwd apps/mobile start        # Metro for an installed development build
bun run --cwd apps/mobile android      # build, install and start on a device or emulator
bun run --cwd apps/mobile test         # Jest + React Native Testing Library
bun run --cwd apps/mobile typecheck
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile messages     # copy the website's shared text into the app (see below)
bun run --cwd apps/mobile doctor       # expo-doctor
```

## Layout

```
src/app/            expo-router screens: (tabs) home, check, rates, draws, wallet; draws/, wallet/, settings, update
src/ui/             the app's building blocks (Text, Button, Card, Badge, Field, ListRow, Screen, Blocks)
src/components/rnr/ React Native Reusables components (shadcn style), added with its CLI
src/theme/          colors.ts (the palette), the ThemeProvider
src/i18n/           messages for en and ur, plus web/ (a copy of the website's shared text)
src/lib/            API client, settings, wallet, notifications, scanning, formatting
plugins/            Expo config plugins (release signing)
scripts/            sync-messages.mjs, release-manifest.mjs
```

## Design system

Styling is NativeWind (Tailwind 3) with the same indigo, neutral grey and gold palette as the website.

- `src/theme/colors.ts` is the single source of the palette and its contrast checks (WCAG 2.2 AA).
- `src/global.css` holds the same colours as `R G B` variables for NativeWind. If you change `colors.ts`, change `global.css` too: `src/theme/__tests__/global-css.test.ts` fails when they drift.
- `tailwind.config.js` maps both the app's names (`bg-surface`, `text-text-muted`) and the Reusables names (`bg-primary`, `text-muted-foreground`) onto those variables.
- Light and dark are the only modes. The first run follows the phone; the choice is then kept.
- Layout rules: gaps of 8, 12 or 16; the medium radius inside cards; rows at least 64 points tall; touch targets at least 48. Use `Notice`, `Panel`, `RowItem` and `Rows` from `src/ui/Blocks.tsx` rather than hand-written styles.
- Use logical properties (`ms-`, `pe-`, `text-start`) so Urdu mirrors correctly. Numbers and bond numbers stay left to right (`Num`).

## Shared text

The app's copy of `apps/web/messages/{en,ur}/common.json` lives in `src/i18n/web/`. After changing the website's `common.json`, run `bun run --cwd apps/mobile messages`. The test suite and the release workflow both fail when the copy is stale.

## Things that bite

- **Bun's isolated linker:** Babel resolves the NativeWind preset's plugins from this folder, so `babel-preset-expo`, `@babel/plugin-transform-react-jsx` and `react-native-css-interop` are direct dependencies on purpose. Do not remove them.
- **Jest:** `jest.config.js` transforms `@rn-primitives`, NativeWind and `lucide-react-native` (untranspiled JSX) and Bun's `node_modules/.bun` store.
- **React 19.3 here, 19.2 on the website:** keep each app's React as it is; the isolated linker keeps them apart.
- **Native modules:** adding one (Reanimated, Worklets and `react-native-svg` came with the new UI) needs a new development build, not a reload.

## Releases

Tagging `vX.Y.Z` builds, signs and publishes the APK through GitHub Actions. Pull requests and manual runs build a test APK signed with a throwaway key. Details, versioning and signing: `docs/MOBILE_RELEASE.md`.
