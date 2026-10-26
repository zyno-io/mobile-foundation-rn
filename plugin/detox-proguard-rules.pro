# The app and the separate Detox test APK share these runtimes. App-only R8
# analysis cannot see calls made by the test APK, including calls to coroutine
# intrinsics and continuations. Preserve their binary API for instrumentation.
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
