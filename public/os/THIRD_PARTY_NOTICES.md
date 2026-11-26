# Third-party notices

## Papirus Icon Theme

- Project: https://github.com/PapirusDevelopmentTeam/papirus-icon-theme
- Source directory: `Papirus/48x48/apps`, `Papirus/24x24/actions`
- License: GNU General Public License v3.0
- Local license: `assets/icons/PAPIRUS-LICENSE`
- Usage: unmodified SVG assets in `assets/icons/`; textual symlink entries in the upstream theme were resolved to their target SVG files.

Papirus is a free SVG icon theme for Linux. Application and action icons remain under their upstream license. Their inclusion as independent assets does not relicense the demo's original JavaScript or CSS.

## Anime.js 3.2.2

- Project: https://github.com/juliangarnier/anime
- Source: https://github.com/juliangarnier/anime/tree/v3.2.2
- License: MIT
- Local files: `vendor/anime.min.js`, `vendor/ANIME-LICENSE.md`
- Usage: interruptible FLIP transforms when windows enter or leave tiling mode.

## Rofi launcher themes

- Project: https://github.com/adi1090x/rofi
- Reference: `files/launchers/type-1/style-1.rasi`
- License: GNU General Public License v3.0
- Local reference and license: `references/rofi-style-1.rasi`, `references/ROFI-LICENSE`
- Usage: interaction and styling reference for a borderless launcher surface; the demo does not execute or include a complete Rofi configuration.

## Hyprland

- Project: https://github.com/hyprwm/Hyprland
- Documentation: https://wiki.hyprland.org/Configuring/Variables/
- Usage: floating/tiling interaction model, active border and workspace behavior. No Hyprland source code is bundled.

## Kitty themes

- Project: https://github.com/dexpota/kitty-themes
- Sources: `themes/Afterglow.conf`, `themes/AtelierSulphurpool.conf`
- License: MIT
- Local sources and license: `references/Afterglow.conf`, `references/AtelierSulphurpool.conf`, `references/KITTY-THEMES-LICENSE.md`
- Usage: terminal background, foreground, selection and ANSI color values. System window surfaces are derived separately rather than reusing terminal foreground colors for all text.

## Aashutosh31 dotfiles — Wallhaven / Omarchy

- Project: https://github.com/Aashutosh31/dotfiles
- Sources: `hypr/.config/hypr/looknfeel.lua`, `omarchy/.config/omarchy/themes/wallhaven/kitty.conf`, `omarchy/.config/omarchy/themes/wallhaven/colors.toml`, and the Astra Islands bar documentation.
- License: MIT
- Local sources and license: `references/Omarchy-looknfeel.lua`, `references/Wallhaven-kitty.conf`, `references/Wallhaven-colors.toml`, `references/AASHUTOSH31-LICENSE.txt`
- Usage: three-island bar composition, 10px window rounding, active border treatment adapted to the Wallhaven rose palette, terminal ANSI palette and blur/opacity parameters translated to CSS. Native Hyprland Lua and Quickshell QML are not executed by the demo.

## JetBrains Mono

- Project: https://github.com/JetBrains/JetBrainsMono
- Source: `fonts/webfonts/JetBrainsMono-Regular.woff2`, `fonts/webfonts/JetBrainsMono-Medium.woff2`
- License: SIL Open Font License 1.1
- Local files and license: `assets/fonts/`
- Usage: locally hosted Latin and numeric interface font for the Wallhaven / Omarchy theme; Chinese text continues to use the system font stack.

## User-supplied illustrations

- Local files: `wallpapers/ethereal.jpg`, `wallpapers/twilight.jpg`
- Original filenames: `ethereal-divine-radiance-monochrome-angelic-anime-girl-backiee-HD.jpg`, `twilight-gaze-over-the-cityscape-backiee-4K.jpg`
- Source: image files supplied directly by the user from the local Downloads directory.
- Usage: unmodified wallpaper choices in the local demo. No upstream license is asserted from the filename alone.

## Kali Linux wallpapers

- Project: https://gitlab.com/kalilinux/packages/kali-wallpapers
- Sources: `2026/backgrounds/kali/kali-glitch-16x9.jpg`, `kali-hack-16x9.jpg`, `kali-net-16x9.jpg` on the `kali/master` branch.
- License: GPL-3.0+
- Local files: `wallpapers/kali-glitch.jpg`, `wallpapers/kali-hack.jpg`, `wallpapers/kali-net.jpg`
- Local notices: `references/KALI-WALLPAPERS-COPYRIGHT.txt`, `references/KALI-WALLPAPERS-GPL-3.0.txt`
- Usage: unmodified 3840×2160 official wallpapers. The upstream notice also warns that some graphical elements are protected by trademark law; see https://www.kali.org/trademark-policy/. Kali branding is not used to imply endorsement of this demo.
