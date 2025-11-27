# Extension Icons

This folder should contain PNG icons for the extension. You need the following sizes:

- `icon-16.png` (16x16 pixels)
- `icon-32.png` (32x32 pixels)
- `icon-48.png` (48x48 pixels)
- `icon-128.png` (128x128 pixels)

## Quick Setup

You can copy and resize the existing logo from the project:

```bash
# If you have ImageMagick installed:
cd /path/to/job-postings-next
convert public/logo-dark.png -resize 16x16 extension/icons/icon-16.png
convert public/logo-dark.png -resize 32x32 extension/icons/icon-32.png
convert public/logo-dark.png -resize 48x48 extension/icons/icon-48.png
convert public/logo-dark.png -resize 128x128 extension/icons/icon-128.png
```

Or create simple placeholder icons using any image editor.

## Placeholder Icons

For development, you can use any square PNG image. The extension will still work without proper icons, but Chrome will show a default icon.

