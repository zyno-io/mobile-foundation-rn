# MfText

Theme-aware text component. Uses the current color scheme's `text` color and the Inter font.

## Usage

```tsx
import { MfText } from '@zyno-io/mobile-foundation-rn';

<MfText>Hello, world</MfText>
<MfText style={{ fontSize: 24, fontWeight: 'bold' }}>Title</MfText>
```

## Props

Extends all standard React Native `TextProps`. No additional props.

## Features

- Applies `color` from the current theme's `text` key
- Sets `maxFontSizeMultiplier={1.5}` to prevent extreme Dynamic Type scaling
- Uses the Inter font family
- Forwards refs

## MfStatusTextView

Centered text view for status messages (loading states, empty states, etc.):

```tsx
import { MfStatusTextView } from '@zyno-io/mobile-foundation-rn';

<MfStatusTextView>No results found</MfStatusTextView>
```

Renders centered within its container with padding and uses `secondaryText` color.
