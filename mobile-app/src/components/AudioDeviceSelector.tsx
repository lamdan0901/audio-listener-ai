import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { AudioInputDevice, AudioSourceType } from '../hooks/useAudioRecorder';

interface AudioDeviceSelectorProps {
  audioDevices: AudioInputDevice[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string | null) => void;
  refreshDevices: () => Promise<AudioInputDevice[]>;
  audioSource: AudioSourceType;
  onSelectSource: (source: AudioSourceType) => void;
  isSystemAudioSupported: () => boolean;
}

const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  audioDevices,
  selectedDeviceId,
  onSelectDevice,
  refreshDevices,
  audioSource,
  onSelectSource,
  isSystemAudioSupported,
}) => {
  // Refresh devices on mount
  useEffect(() => {
    refreshDevices();
  }, []);

  // Handle audio source selection
  const handleSourceChange = (source: AudioSourceType) => {
    // If selecting system audio but it's not supported, the hook will handle the fallback
    onSelectSource(source);
  };

  return (
    <View style={styles.container}>
      {/* Audio Source Selection */}
      <View style={styles.sourceContainer}>
        <Text style={styles.label}>Audio Source:</Text>
        <View style={styles.sourceButtons}>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              audioSource === 'microphone' && styles.sourceButtonActive,
            ]}
            onPress={() => handleSourceChange('microphone')}
          >
            <Text
              style={[
                styles.sourceButtonText,
                audioSource === 'microphone' && styles.sourceButtonTextActive,
              ]}
            >
              Microphone
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sourceButton,
              audioSource === 'system' && styles.sourceButtonActive,
              !isSystemAudioSupported() && styles.sourceButtonDisabled,
            ]}
            onPress={() => handleSourceChange('system')}
            disabled={!isSystemAudioSupported()}
          >
            <Text
              style={[
                styles.sourceButtonText,
                audioSource === 'system' && styles.sourceButtonTextActive,
                !isSystemAudioSupported() && styles.sourceButtonTextDisabled,
              ]}
            >
              System Audio
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Audio Device Selection - Only show when microphone is selected */}
      {audioSource === 'microphone' && (
        <View style={styles.deviceContainer}>
          <View style={styles.deviceHeader}>
            <Text style={styles.label}>Audio Input Device:</Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshDevices}
            >
              <Text style={styles.refreshButtonText}>🔄</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedDeviceId || 'default'}
              onValueChange={(itemValue) => onSelectDevice(itemValue === 'default' ? null : itemValue)}
              style={styles.picker}
              dropdownIconColor="#007AFF"
            >
              {audioDevices.map((device) => (
                <Picker.Item
                  key={device.deviceId}
                  label={device.label}
                  value={device.deviceId}
                />
              ))}
              {audioDevices.length === 0 && (
                <Picker.Item
                  label="No devices found"
                  value="none"
                  enabled={false}
                />
              )}
            </Picker>
          </View>
          
          {Platform.OS === 'ios' || Platform.OS === 'android' ? (
            <Text style={styles.note}>
              Note: On mobile devices, audio device selection may be limited by the operating system.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  sourceContainer: {
    marginBottom: 10,
  },
  sourceButtons: {
    flexDirection: 'row',
    marginTop: 5,
  },
  sourceButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sourceButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#0062cc',
  },
  sourceButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
    opacity: 0.5,
  },
  sourceButtonText: {
    color: '#333',
  },
  sourceButtonTextActive: {
    color: 'white',
  },
  sourceButtonTextDisabled: {
    color: '#999',
  },
  deviceContainer: {
    marginTop: 10,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  refreshButton: {
    padding: 5,
  },
  refreshButtonText: {
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
});

export default AudioDeviceSelector;
