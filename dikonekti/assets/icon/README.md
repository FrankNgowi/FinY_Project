# App icon art

The Dikonekti mark: the white Material `volunteer_activism` glyph on the app's purple gradient
(`#6750A4` to `#9B7FE8`), the same as the login screen, the web favicon
(`dikonekti-web/src/app/icon.svg`) and the glyph path in `dikonekti-web/src/lib/brand.ts`.

| File | What it is |
|---|---|
| `app_icon.svg` / `app_icon.png` | Full-bleed 1024 px square, opaque. Used for iOS, macOS, Windows, web and the legacy Android icon |
| `app_icon_macos.svg` / `.png` | Rounded 824 px tile with a transparent margin. Used for macOS only, because macOS does not mask app icons the way iOS and Android do |
| `app_icon_foreground.svg` / `.png` | Transparent 1024 px layer with only the glyph, sized to stay inside Android's 66 dp safe circle. Used as the adaptive icon foreground (the background is the solid colour in `pubspec.yaml`) |

These files are not listed under `flutter: assets:`, so they are not bundled into the app. The platform
icon files are generated from them and committed, so building the app does not need any tool.

## Changing the logo

1. Edit the two SVGs, then redraw the PNGs at 1024 x 1024. Use a browser or `rsvg-convert`;
   ImageMagick's built-in SVG renderer drops the gradient.
2. `dart run flutter_launcher_icons` (configuration: `flutter_launcher_icons:` in `pubspec.yaml`).
3. Rebuild the Windows icon with all its sizes (the tool writes only 256 px, so Windows would scale the small sizes itself):
   `convert assets/icon/app_icon.png -define icon:auto-resize=256,128,64,48,32,16 windows/runner/resources/app_icon.ico`
4. Review `git status` and keep only icon changes. With `flutter_launcher_icons` 0.14.4 revert
   `ios/Runner.xcodeproj/project.pbxproj` (it wrongly rewrites a build setting), and revert
   `analysis_options.yaml` if `flutter analyze` auto-edited it.
5. Keep the three places in step: this art, the web icon, and the login screen's `Icons.volunteer_activism_rounded`.

The web manifest name and the HTML titles (`web/manifest.json`, `web/index.html`) are edited by hand; the tool only sets the manifest colours.
