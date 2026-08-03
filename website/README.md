# Godot Mini Game Website

Official landing page and generated API reference for
[Godot Mini Game](https://github.com/AnranS/godot_for_minigame). The site covers
WeChat, Douyin, and TikTok as first-class targets. TikTok uses the Native
runtime and its current support tier is beta.

Release identity and platform validation labels come from
`../support-matrix.json`. In particular, an `automated` export-smoke entry must
not be presented as DevTool or real-device certification. TikTok content uses
the `TTMinis.game` namespace, client 43.4.0+, and the pinned `ttmg dev` Native
compile/debug entry. First use requires setup/login, then `ttmg init` with the
same Client Key inside the export directory; `project.config.json.appid` does
not populate `~/.ttmgrc`. Native `ttmg build` is currently only a placeholder.
TikTok HTML runtime support is outside v0.3.

## Development

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

The static GitHub Pages output is generated in `dist/client`.

`npm run generate:data` regenerates both the release/platform data and the API
index. The API index is the full `MiniGameSDK` bridge surface, not a claim that
all methods are available on every host; the page explains capability gating
and provider-specific mappings.
