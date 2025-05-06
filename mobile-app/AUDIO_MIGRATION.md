# Audio Module Migration Guide

## Current Issue

The mobile app was encountering the following error:
```
Failed to set audio mode TypeError: _expoAv.Audio.getAudioModeAsync is not a function (it is undefined)
```

This error occurred because the app is using `expo-av` version 15.1.4, which has deprecated some audio functionality. According to the Expo documentation, `expo-av` is deprecated and will be removed in SDK 54.

## Temporary Fix

We've modified the `useAudioRecorder.ts` hook to remove calls to the deprecated `Audio.getAudioModeAsync()` function. This allows the app to continue functioning with the current version of `expo-av`.

## Long-term Solution

For a more sustainable solution, the app should be migrated from `expo-av` to the new `expo-audio` package. This new package provides improved APIs for audio playback and recording.

### Migration Steps

1. Install the new package:
   ```bash
   npx expo install expo-audio
   ```

2. Update imports in your code:
   ```javascript
   // Old import
   import { Audio } from 'expo-av';
   
   // New import
   import { useAudioRecorder, RecordingOptions, AudioModule, RecordingPresets } from 'expo-audio';
   ```

3. Replace the custom `useAudioRecorder` hook with the one provided by `expo-audio`:
   ```javascript
   // Old usage with custom hook
   const recorder = useAudioRecorder();
   
   // New usage with expo-audio hook
   const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
   ```

4. Update permission requests:
   ```javascript
   // Old permission request
   const response = await Audio.requestPermissionsAsync();
   
   // New permission request
   const status = await AudioModule.requestRecordingPermissionsAsync();
   ```

5. Update recording methods to match the new API:
   ```javascript
   // Old recording start
   await recorder.startRecording();
   
   // New recording start
   await recorder.prepareToRecordAsync();
   recorder.record();
   ```

## References

- [Expo Audio (expo-audio) Documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
- [Expo AV (expo-av) Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
