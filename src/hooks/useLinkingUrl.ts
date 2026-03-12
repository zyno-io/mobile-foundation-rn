import * as Linking from 'expo-linking';

// Expo's Linking API provides Linking.useURL(), but the problem is that it changes while
// we're inside a function from a previous render cycle, so the change doesn't help us because
// the state is never updated in our context.
// Instead, we can track it globally and provide a function to return the latest value.

let linkingUrl: string | null;
Linking.getInitialURL().then(url => {
    linkingUrl = url;
});
Linking.addEventListener('url', ({ url }) => {
    linkingUrl = url;
});

export function getLinkingUrl() {
    return linkingUrl;
}
