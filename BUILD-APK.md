# Build your APK with GitHub Actions (no Android Studio needed on your phone)

This project includes `.github/workflows/build-apk.yml` to build a **debug APK** in GitHub's cloud runner.

1. Sign in or create a GitHub account at https://github.com/.
2. Create a new **private** repository, for example `jarvis-personal-ai`.
3. Upload the contents of this project ZIP into the repository, preserving folders including `.github/workflows/build-apk.yml`.
4. Open the repository's **Actions** tab. If prompted, enable workflows.
5. Select **Build JARVIS Android APK**, then press **Run workflow** (or push/commit to the main branch to trigger it).
6. Wait for the workflow to finish successfully. Open that run and find **Artifacts** at the bottom.
7. Download `jarvis-personal-ai-debug-apk.zip` and extract it. Inside is `app-debug.apk`.
8. Transfer `app-debug.apk` to your Android phone and tap it to install. Android may ask you to allow installs from that file manager/browser. Only install APKs you built from code you trust.

Notes:
- This is a **debug APK**, suitable for personal testing, not a signed Play Store release.
- The app's AI features remain disconnected until you configure a compatible endpoint/model in Settings. Avoid putting secret keys in a public repository or shared device.
- GitHub Actions is an external service; the source code will be stored in your GitHub repository. Use a private repository for a personal project.
- The workflow has not been run from this environment, so this is a build path, not a claim that an APK has already been produced.
