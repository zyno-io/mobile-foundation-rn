# useNavigationWithOptions

Set React Navigation screen options dynamically.

## useNavigationWithOptions

```ts
import { useNavigationWithOptions } from '@zyno-io/mobile-foundation-rn';

function MyScreen() {
    const navigation = useNavigationWithOptions({
        headerRight: () => <SaveButton />,
        headerStyle: { backgroundColor: '#fff' },
    });

    return <View>{/* ... */}</View>;
}
```

Calls `navigation.setOptions()` in a `useEffect` whenever the options or navigation object changes. Returns the navigation object.

## useNavigationWithTitle

Convenience wrapper for setting just the header title:

```ts
import { useNavigationWithTitle } from '@zyno-io/mobile-foundation-rn';

function ProfileScreen({ user }) {
    useNavigationWithTitle(user.name);
    return <View>{/* ... */}</View>;
}
```
