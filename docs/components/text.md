# MFText

Theme-aware text component. Uses the current color scheme's `text` color and the Inter font.

## Usage

```tsx
import { MFText } from '@zyno-io/mobile-foundation-rn';

<MFText>Hello, world</MFText>
<MFText style={{ fontSize: 24, fontWeight: 'bold' }}>Title</MFText>
```

## Props

Extends all standard React Native `TextProps`. No additional props.

## Features

- Applies `color` from the current theme's `text` key
- Sets `maxFontSizeMultiplier={1.5}` to prevent extreme Dynamic Type scaling
- Uses the Inter font family
- Forwards refs

## MFStatusTextView

Centered text view for status messages (loading states, empty states, etc.):

```tsx
import { MFStatusTextView } from '@zyno-io/mobile-foundation-rn';

<MFStatusTextView>No results found</MFStatusTextView>
```

Renders centered within its container with padding and uses `secondaryText` color.
